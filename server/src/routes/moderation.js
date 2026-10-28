// RF15: denúncia e moderação
import { Router } from 'express'
import { many, one, q } from '../db.js'
import { requireAuth, requireRole } from '../lib/auth.js'
import { fail, str } from '../lib/http.js'
import { notify } from '../lib/notify.js'

const r = Router()

export const REPORT_REASONS = {
  conteudo_improprio: 'Conteúdo impróprio',
  informacao_incorreta: 'Informação incorreta',
  negociacao_externa: 'Tentativa de negociar fora da plataforma',
  outro: 'Outro motivo',
}

r.post('/reports', requireAuth, async (req, res) => {
  const targetType = req.body?.targetType
  const targetId = Number(req.body?.targetId) || 0
  const reason = req.body?.reason
  if (!['oferta', 'usuario', 'mensagem'].includes(targetType)) fail(400, 'Alvo inválido')
  if (!REPORT_REASONS[reason]) fail(400, 'Escolha o motivo')
  const details = str(req.body?.details, { max: 800, name: 'detalhes' })
  const table = { oferta: 'offers', usuario: 'users', mensagem: 'messages' }[targetType]
  const exists = await one(`SELECT id FROM ${table} WHERE id = $1`, [targetId])
  if (!exists) fail(404, 'Item denunciado não encontrado')
  if (targetType === 'mensagem') {
    // Só quem participa da conversa pode denunciar a mensagem.
    const ok = await one(
      `SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE m.id = $1 AND (c.client_id = $2 OR c.provider_id = $2)`,
      [targetId, req.user.id],
    )
    if (!ok) fail(404, 'Item denunciado não encontrado')
  }
  const dup = await one(
    "SELECT id FROM reports WHERE reporter_id = $1 AND target_type = $2 AND target_id = $3 AND status = 'aberta'",
    [req.user.id, targetType, targetId],
  )
  if (dup) return res.json({ ok: true, duplicate: true })
  await q('INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES ($1, $2, $3, $4, $5)', [
    req.user.id,
    targetType,
    targetId,
    reason,
    details,
  ])
  res.status(201).json({ ok: true })
})

async function describeTarget(rep) {
  if (rep.target_type === 'oferta') {
    const o = await one('SELECT o.id, o.title, o.description, o.status, o.provider_id, u.name FROM offers o JOIN users u ON u.id = o.provider_id WHERE o.id = $1', [rep.target_id])
    return o && { title: o.title, text: o.description, status: o.status, ownerId: o.provider_id, ownerName: o.name, link: `/oferta/${o.id}` }
  }
  if (rep.target_type === 'usuario') {
    const u = await one('SELECT id, name, bio, blocked FROM users WHERE id = $1', [rep.target_id])
    return u && { title: u.name, text: u.bio, status: u.blocked ? 'bloqueado' : 'ativo', ownerId: u.id, ownerName: u.name, link: `/prestador/${u.id}` }
  }
  const m = await one('SELECT m.id, m.body, m.sender_id, u.name FROM messages m LEFT JOIN users u ON u.id = m.sender_id WHERE m.id = $1', [rep.target_id])
  return m && { title: 'Mensagem no chat', text: m.body, status: 'publicada', ownerId: m.sender_id, ownerName: m.name, link: null }
}

r.get('/moderation/reports', requireRole('moderador'), async (req, res) => {
  const status = ['aberta', 'procedente', 'improcedente'].includes(req.query.status) ? req.query.status : 'aberta'
  const rows = await many(
    `SELECT r.*, u.name AS reporter_name FROM reports r LEFT JOIN users u ON u.id = r.reporter_id
      WHERE r.status = $1 ORDER BY r.id DESC LIMIT 100`,
    [status],
  )
  const counts = await one(
    "SELECT count(*) FILTER (WHERE status = 'aberta')::int AS aberta, count(*) FILTER (WHERE status <> 'aberta')::int AS resolvidas FROM reports",
  )
  const reports = []
  for (const rep of rows) {
    reports.push({
      id: rep.id,
      targetType: rep.target_type,
      targetId: rep.target_id,
      reason: rep.reason,
      reasonLabel: REPORT_REASONS[rep.reason],
      details: rep.details,
      reporterName: rep.reporter_name || 'Sistema (automático)',
      status: rep.status,
      resolution: rep.resolution,
      createdAt: rep.created_at,
      resolvedAt: rep.resolved_at,
      target: await describeTarget(rep),
    })
  }
  res.json({ reports, counts })
})

r.post('/moderation/reports/:id/resolve', requireRole('moderador'), async (req, res) => {
  const rep = await one('SELECT * FROM reports WHERE id = $1', [Number(req.params.id) || 0])
  if (!rep) fail(404, 'Denúncia não encontrada')
  if (rep.status !== 'aberta') fail(409, 'Denúncia já resolvida')
  const decision = req.body?.decision
  if (!['procedente', 'improcedente'].includes(decision)) fail(400, 'Decisão inválida')
  const action = req.body?.action || 'nenhuma'
  const resolution = str(req.body?.resolution, { max: 500, name: 'justificativa' })
  const target = await describeTarget(rep)

  if (decision === 'procedente') {
    if (action === 'remover_oferta') {
      if (rep.target_type !== 'oferta') fail(400, 'Ação válida apenas para ofertas')
      await q("UPDATE offers SET status = 'removida' WHERE id = $1", [rep.target_id])
      await notify(target.ownerId, {
        kind: 'moderacao',
        title: 'Oferta removida pela moderação',
        body: `"${target.title}" foi removida. ${resolution}`.trim(),
        link: '/painel',
      })
    } else if (action === 'ocultar_mensagem') {
      if (rep.target_type !== 'mensagem') fail(400, 'Ação válida apenas para mensagens')
      await q("UPDATE messages SET body = '[mensagem removida pela moderação]', masked = true WHERE id = $1", [rep.target_id])
    } else if (action === 'bloquear_usuario') {
      if (!target?.ownerId) fail(400, 'Usuário não identificado')
      await q('UPDATE users SET blocked = true WHERE id = $1 AND role = $2', [target.ownerId, 'usuario'])
    } else if (action === 'advertir' && target?.ownerId) {
      await notify(target.ownerId, {
        kind: 'moderacao',
        title: 'Aviso da moderação',
        body: resolution || 'Mantenha a negociação dentro da plataforma e respeite as regras de uso.',
      })
    }
  }
  await q('UPDATE reports SET status = $2, resolution = $3, resolved_by = $4, resolved_at = now() WHERE id = $1', [
    rep.id,
    decision,
    [action !== 'nenhuma' ? `Ação: ${action}.` : '', resolution].filter(Boolean).join(' '),
    req.user.id,
  ])
  if (rep.reporter_id) {
    await notify(rep.reporter_id, {
      kind: 'moderacao',
      title: 'Sua denúncia foi analisada',
      body: decision === 'procedente' ? 'Obrigado. Tomamos as providências cabíveis.' : 'Não identificamos violação das regras.',
    })
  }
  res.json({ ok: true })
})

export default r
