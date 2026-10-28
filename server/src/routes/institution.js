// Painel para instituições (Business Intelligence) e questionário de satisfação.
// Só expõe dados agregados: nenhum nome, telefone ou localização individual.
import { Router } from 'express'
import { many, one, q } from '../db.js'
import { requireAuth, requireRole } from '../lib/auth.js'
import { CATEGORIES, categoryName } from '../lib/categories.js'
import { STATUS_LABELS } from '../lib/contract-states.js'
import { fail, str } from '../lib/http.js'
import { BARRIERS } from './field.js'

const r = Router()

async function overview() {
  const [field, barriers, maps, providers, offersByCat, contracts, money, rating, satisfaction, weekly] = await Promise.all([
    one(
      `SELECT count(*)::int AS approached, count(*) FILTER (WHERE accepted)::int AS accepted,
              count(*) FILTER (WHERE appears_on_maps = 'nao')::int AS not_on_maps,
              count(*) FILTER (WHERE appears_on_maps = 'nao_sabe')::int AS maps_unknown
         FROM field_surveys`,
    ),
    many('SELECT b AS barrier, count(*)::int AS n FROM field_surveys, unnest(barriers) AS b GROUP BY b ORDER BY n DESC'),
    many('SELECT category, count(*)::int AS n, count(*) FILTER (WHERE appears_on_maps = $1)::int AS not_on_maps FROM field_surveys GROUP BY category', ['nao']),
    one(
      `SELECT count(DISTINCT o.provider_id)::int AS active_providers,
              (SELECT count(*)::int FROM users WHERE is_provider) AS providers,
              (SELECT count(*)::int FROM users WHERE assisted_by IS NOT NULL) AS assisted,
              (SELECT count(DISTINCT client_id)::int FROM conversations) AS active_clients
         FROM offers o WHERE o.status = 'ativa'`,
    ),
    many("SELECT category, count(*)::int AS n FROM offers WHERE status = 'ativa' GROUP BY category"),
    many('SELECT status, count(*)::int AS n FROM contracts GROUP BY status'),
    one('SELECT COALESCE(sum(gross_cents), 0)::int AS gross, COALESCE(sum(commission_cents), 0)::int AS commission, count(*)::int AS n FROM commissions'),
    one('SELECT round(avg(rating)::numeric, 2)::float8 AS avg, count(*)::int AS n FROM reviews'),
    many(
      `SELECT user_group, count(*)::int AS n, round(avg(score)::numeric, 2)::float8 AS score, round(avg(ease)::numeric, 2)::float8 AS ease,
              round(100.0 * avg(CASE WHEN will_continue THEN 1 ELSE 0 END), 1)::float8 AS continue_pct
         FROM satisfaction_surveys GROUP BY user_group`,
    ),
    many(
      `SELECT to_char(w, 'YYYY-MM-DD') AS week,
              (SELECT count(*)::int FROM contracts k WHERE k.status = 'concluida' AND k.concluded_at >= w AND k.concluded_at < w + interval '7 days') AS concluded,
              (SELECT count(*)::int FROM conversations c WHERE c.created_at >= w AND c.created_at < w + interval '7 days') AS contacts
         FROM generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') AS w
        ORDER BY w`,
    ),
  ])
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)
  const byCat = Object.fromEntries(offersByCat.map((x) => [x.category, x.n]))
  const mapsByCat = Object.fromEntries(maps.map((x) => [x.category, x]))
  return {
    field: {
      approached: field.approached,
      accepted: field.accepted,
      conversionPct: pct(field.accepted, field.approached),
      notOnMaps: field.not_on_maps,
      notOnMapsPct: pct(field.not_on_maps, field.approached),
      mapsUnknown: field.maps_unknown,
      barriers: barriers.map((b) => ({ id: b.barrier, label: BARRIERS[b.barrier] || b.barrier, count: b.n, pct: pct(b.n, field.approached) })),
    },
    platform: {
      ...providers,
      offersByCategory: CATEGORIES.map((c) => ({
        category: c.slug,
        name: c.name,
        offers: byCat[c.slug] || 0,
        surveyed: mapsByCat[c.slug]?.n || 0,
        notOnMaps: mapsByCat[c.slug]?.not_on_maps || 0,
      })).filter((c) => c.offers || c.surveyed),
      contractsByStatus: contracts.map((c) => ({ status: c.status, label: STATUS_LABELS[c.status], count: c.n })),
      concluded: money.n,
      grossCents: money.gross,
      commissionCents: money.commission,
      avgRating: rating.avg,
      reviews: rating.n,
    },
    satisfaction: satisfaction.map((s) => ({ group: s.user_group, responses: s.n, score: s.score, ease: s.ease, continuePct: s.continue_pct })),
    weekly,
  }
}

r.get('/institution/overview', requireRole('instituicao', 'moderador'), async (_req, res) => {
  res.json(await overview())
})

// Exportação para planilha. Separador ";" e BOM para abrir corretamente no Excel em português.
r.get('/institution/export.csv', requireRole('instituicao', 'moderador'), async (_req, res) => {
  const o = await overview()
  const lines = [['secao', 'indicador', 'valor']]
  lines.push(['campo', 'negocios abordados', o.field.approached])
  lines.push(['campo', 'cadastrados', o.field.accepted])
  lines.push(['campo', 'taxa de conversao (%)', o.field.conversionPct])
  lines.push(['campo', 'ausentes de mapas (%)', o.field.notOnMapsPct])
  for (const b of o.field.barriers) lines.push(['barreira declarada', b.label, b.count])
  for (const c of o.platform.offersByCategory) {
    lines.push(['ofertas ativas por categoria', c.name, c.offers])
    lines.push(['levantados em campo por categoria', c.name, c.surveyed])
  }
  for (const c of o.platform.contractsByStatus) lines.push(['contratacoes por estado', c.label, c.count])
  lines.push(['plataforma', 'volume concluido (R$)', (o.platform.grossCents / 100).toFixed(2).replace('.', ',')])
  lines.push(['plataforma', 'comissao apurada (R$)', (o.platform.commissionCents / 100).toFixed(2).replace('.', ',')])
  lines.push(['plataforma', 'avaliacao media', o.platform.avgRating ?? ''])
  for (const s of o.satisfaction) {
    lines.push([`satisfacao ${s.group}`, 'respostas', s.responses])
    lines.push([`satisfacao ${s.group}`, 'nota media', s.score])
    lines.push([`satisfacao ${s.group}`, 'intencao de continuar (%)', s.continuePct])
  }
  for (const w of o.weekly) lines.push(['semanal', `semana de ${w.week}`, `${w.contacts} contatos / ${w.concluded} concluidas`])
  const csv = '﻿' + lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="conectabairro-indicadores.csv"')
  res.send(csv)
})

// Plano de aplicação, etapa 3: questionário estruturado ao término do período de uso.
r.get('/satisfaction/mine', requireAuth, async (req, res) => {
  const row = await one('SELECT created_at FROM satisfaction_surveys WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [req.user.id])
  res.json({ answeredAt: row?.created_at || null })
})

r.post('/satisfaction', requireAuth, async (req, res) => {
  const b = req.body || {}
  const group = b.group === 'prestador' ? 'prestador' : 'contratante'
  const score = Number(b.score)
  const ease = Number(b.ease)
  if (![score, ease].every((n) => Number.isInteger(n) && n >= 1 && n <= 5)) fail(400, 'Responda as notas de 1 a 5')
  if (typeof b.willContinue !== 'boolean') fail(400, 'Responda se pretende continuar usando')
  await q('INSERT INTO satisfaction_surveys (user_id, user_group, score, ease, will_continue, comment) VALUES ($1, $2, $3, $4, $5, $6)', [
    req.user.id,
    group,
    score,
    ease,
    b.willContinue,
    str(b.comment, { max: 800, name: 'comentário' }),
  ])
  res.status(201).json({ ok: true })
})

export default r
