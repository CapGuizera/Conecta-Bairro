// RF07 (chat interno), RF08 (proposta e aceite), RF09 (contratação), RF10 (comissão), RF11 (avaliação mútua)
import crypto from 'node:crypto'
import { Router } from 'express'
import { config } from '../config.js'
import { db, many, one, q } from '../db.js'
import { requireAuth } from '../lib/auth.js'
import { FINAL_STATUSES, STATUS_LABELS, availableActions, nextStatus } from '../lib/contract-states.js'
import { fail, str } from '../lib/http.js'
import { computeCommission, formatBRL, parseMoneyToCents } from '../lib/money.js'
import { notify } from '../lib/notify.js'
import { maskContacts } from '../lib/text.js'
import { emitTo } from '../realtime.js'

const r = Router()
r.use(['/conversations', '/contracts'], requireAuth)

// ---------- helpers ----------

const localYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function serializeMessage(m) {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    kind: m.kind,
    body: m.body,
    masked: m.masked,
    createdAt: m.created_at,
    proposal: m.proposal_id
      ? { id: m.proposal_id, amountCents: m.p_amount, deadline: m.p_deadline, notes: m.p_notes, status: m.p_status }
      : null,
  }
}

const MESSAGE_SELECT = `
  SELECT m.*, p.amount_cents AS p_amount, to_char(p.deadline, 'YYYY-MM-DD') AS p_deadline, p.notes AS p_notes, p.status AS p_status
    FROM messages m LEFT JOIN proposals p ON p.id = m.proposal_id`

async function loadConversation(id, userId) {
  const conv = await one(
    `SELECT c.*, o.title AS offer_title, o.images AS offer_images, o.category AS offer_category,
            cu.name AS client_name, pu.name AS provider_name
       FROM conversations c
       JOIN offers o ON o.id = c.offer_id
       JOIN users cu ON cu.id = c.client_id
       JOIN users pu ON pu.id = c.provider_id
      WHERE c.id = $1`,
    [Number(id) || 0],
  )
  if (!conv || (conv.client_id !== userId && conv.provider_id !== userId)) fail(404, 'Conversa não encontrada')
  return conv
}

async function insertMessage(run, conversationId, senderId, kind, body, { masked = false, proposalId = null } = {}) {
  const { rows } = await run(
    `INSERT INTO messages (conversation_id, sender_id, kind, body, masked, proposal_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [conversationId, senderId, kind, body, masked, proposalId],
  )
  await run('UPDATE conversations SET last_message_at = now() WHERE id = $1', [conversationId])
  return rows[0].id
}

async function broadcastMessage(conv, messageId) {
  const m = await one(`${MESSAGE_SELECT} WHERE m.id = $1`, [messageId])
  const payload = serializeMessage(m)
  emitTo(conv.client_id, 'message', payload)
  emitTo(conv.provider_id, 'message', payload)
  return payload
}

function serializeContract(c, userId) {
  const side = c.client_id === userId ? 'client' : 'provider'
  return {
    id: c.id,
    conversationId: c.conversation_id,
    offerId: c.offer_id,
    offerTitle: c.offer_title,
    status: c.status,
    statusLabel: STATUS_LABELS[c.status],
    requestNote: c.request_note,
    amountCents: c.amount_cents,
    deadline: c.deadline_s || null,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    concludedAt: c.concluded_at,
    side,
    counterpart: side === 'client' ? { id: c.provider_id, name: c.provider_name } : { id: c.client_id, name: c.client_name },
    actions: availableActions(c.status, side),
  }
}

const CONTRACT_SELECT = `
  SELECT k.*, to_char(k.deadline, 'YYYY-MM-DD') AS deadline_s, o.title AS offer_title,
         cu.name AS client_name, pu.name AS provider_name
    FROM contracts k
    JOIN offers o ON o.id = k.offer_id
    JOIN users cu ON cu.id = k.client_id
    JOIN users pu ON pu.id = k.provider_id`

async function loadContract(id, userId) {
  const c = await one(`${CONTRACT_SELECT} WHERE k.id = $1`, [Number(id) || 0])
  if (!c || (c.client_id !== userId && c.provider_id !== userId)) fail(404, 'Contratação não encontrada')
  return c
}

async function contractDetails(c, userId) {
  const [events, proposals, commission, reviews] = await Promise.all([
    many(
      `SELECT e.*, u.name AS actor_name FROM contract_events e LEFT JOIN users u ON u.id = e.actor_id
        WHERE e.contract_id = $1 ORDER BY e.id`,
      [c.id],
    ),
    many(
      "SELECT p.*, to_char(p.deadline, 'YYYY-MM-DD') AS deadline_s FROM proposals p WHERE p.contract_id = $1 ORDER BY p.id",
      [c.id],
    ),
    one('SELECT * FROM commissions WHERE contract_id = $1', [c.id]),
    many('SELECT * FROM reviews WHERE contract_id = $1', [c.id]),
  ])
  const base = serializeContract(c, userId)
  return {
    ...base,
    events: events.map((e) => ({
      fromStatus: e.from_status,
      toStatus: e.to_status,
      toLabel: STATUS_LABELS[e.to_status],
      actorName: e.actor_name,
      note: e.note,
      createdAt: e.created_at,
    })),
    proposals: proposals.map((p) => ({ id: p.id, amountCents: p.amount_cents, deadline: p.deadline_s, notes: p.notes, status: p.status, createdAt: p.created_at })),
    commission: commission
      ? {
          grossCents: commission.gross_cents,
          rate: Number(commission.rate),
          commissionCents: commission.commission_cents,
          netCents: commission.net_cents,
          receiptCode: commission.receipt_code,
        }
      : null,
    myReview: reviews.find((x) => x.reviewer_id === userId) ? { rating: reviews.find((x) => x.reviewer_id === userId).rating } : null,
    counterpartReviewed: reviews.some((x) => x.reviewer_id !== userId),
    canReview: c.status === 'concluida' && !reviews.some((x) => x.reviewer_id === userId),
  }
}

async function pushContractUpdate(c) {
  emitTo(c.client_id, 'contract', { id: c.id, conversationId: c.conversation_id })
  emitTo(c.provider_id, 'contract', { id: c.id, conversationId: c.conversation_id })
}

// ---------- conversas ----------

r.post('/conversations', async (req, res) => {
  const offer = await one(
    "SELECT o.* FROM offers o JOIN users u ON u.id = o.provider_id WHERE o.id = $1 AND o.status = 'ativa' AND NOT u.blocked",
    [Number(req.body?.offerId) || 0],
  )
  if (!offer) fail(404, 'Oferta não encontrada')
  if (offer.provider_id === req.user.id) fail(400, 'Você não pode iniciar conversa com a sua própria oferta')
  let conv = await one('SELECT * FROM conversations WHERE offer_id = $1 AND client_id = $2', [offer.id, req.user.id])
  if (!conv) {
    conv = await one(
      'INSERT INTO conversations (offer_id, client_id, provider_id) VALUES ($1, $2, $3) RETURNING *',
      [offer.id, req.user.id, offer.provider_id],
    )
    await notify(offer.provider_id, {
      kind: 'conversa',
      title: 'Novo contato',
      body: `${req.user.name.split(' ')[0]} quer conversar sobre "${offer.title}"`,
      link: `/conversas/${conv.id}`,
    })
  }
  res.status(201).json({ conversationId: conv.id })
})

r.get('/conversations', async (req, res) => {
  const rows = await many(
    `SELECT c.id, c.offer_id, c.client_id, c.provider_id, c.last_message_at, o.title AS offer_title, o.images AS offer_images,
            CASE WHEN c.client_id = $1 THEN pu.name ELSE cu.name END AS other_name,
            CASE WHEN c.client_id = $1 THEN 'client' ELSE 'provider' END AS side,
            (SELECT m.body FROM messages m WHERE m.conversation_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_body,
            (SELECT count(*)::int FROM messages m WHERE m.conversation_id = c.id AND m.sender_id IS DISTINCT FROM $1
                AND m.id > COALESCE((SELECT cr.last_read_id FROM conversation_reads cr WHERE cr.conversation_id = c.id AND cr.user_id = $1), 0)) AS unread,
            (SELECT k.status FROM contracts k WHERE k.conversation_id = c.id ORDER BY k.id DESC LIMIT 1) AS contract_status
       FROM conversations c
       JOIN offers o ON o.id = c.offer_id
       JOIN users cu ON cu.id = c.client_id
       JOIN users pu ON pu.id = c.provider_id
      WHERE c.client_id = $1 OR c.provider_id = $1
      ORDER BY c.last_message_at DESC`,
    [req.user.id],
  )
  res.json({
    conversations: rows.map((c) => ({
      id: c.id,
      offerId: c.offer_id,
      offerTitle: c.offer_title,
      offerImage: (c.offer_images || [])[0] || null,
      otherName: c.other_name,
      side: c.side,
      lastBody: c.last_body,
      lastMessageAt: c.last_message_at,
      unread: c.unread,
      contractStatus: c.contract_status,
      contractStatusLabel: c.contract_status ? STATUS_LABELS[c.contract_status] : null,
    })),
  })
})

r.get('/conversations/:id', async (req, res) => {
  const conv = await loadConversation(req.params.id, req.user.id)
  const messages = await many(`${MESSAGE_SELECT} WHERE m.conversation_id = $1 ORDER BY m.id`, [conv.id])
  const latest = await one(`${CONTRACT_SELECT} WHERE k.conversation_id = $1 ORDER BY k.id DESC LIMIT 1`, [conv.id])
  const side = conv.client_id === req.user.id ? 'client' : 'provider'
  res.json({
    conversation: {
      id: conv.id,
      offerId: conv.offer_id,
      offerTitle: conv.offer_title,
      offerImage: (conv.offer_images || [])[0] || null,
      side,
      me: req.user.id,
      other: side === 'client' ? { id: conv.provider_id, name: conv.provider_name, isProvider: true } : { id: conv.client_id, name: conv.client_name },
    },
    messages: messages.map(serializeMessage),
    contract: latest ? await contractDetails(latest, req.user.id) : null,
    canRequest: side === 'client' && (!latest || FINAL_STATUSES.includes(latest.status)),
  })
})

r.post('/conversations/:id/messages', async (req, res) => {
  const conv = await loadConversation(req.params.id, req.user.id)
  const raw = str(req.body?.body, { max: 1000, required: true, name: 'mensagem' })
  const { text, masked } = maskContacts(raw)
  const id = await insertMessage(q, conv.id, req.user.id, 'texto', text, { masked })
  if (masked) {
    // RF15: tentativa de levar a negociação para fora gera sinalização automática para a moderação.
    await q(
      "INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES (NULL, 'mensagem', $1, 'negociacao_externa', $2)",
      [id, 'Sinalização automática: a mensagem continha dados de contato e foi mascarada.'],
    )
  }
  await q(
    `INSERT INTO conversation_reads (conversation_id, user_id, last_read_id) VALUES ($1, $2, $3)
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_id = EXCLUDED.last_read_id`,
    [conv.id, req.user.id, id],
  )
  const message = await broadcastMessage(conv, id)
  const otherId = conv.client_id === req.user.id ? conv.provider_id : conv.client_id
  await notify(otherId, {
    kind: 'mensagem',
    title: `Mensagem de ${req.user.name.split(' ')[0]}`,
    body: text.length > 90 ? `${text.slice(0, 90)}...` : text,
    link: `/conversas/${conv.id}`,
  })
  res.status(201).json({ message })
})

r.post('/conversations/:id/read', async (req, res) => {
  const conv = await loadConversation(req.params.id, req.user.id)
  const last = await one('SELECT COALESCE(max(id), 0)::int AS id FROM messages WHERE conversation_id = $1', [conv.id])
  await q(
    `INSERT INTO conversation_reads (conversation_id, user_id, last_read_id) VALUES ($1, $2, $3)
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_id = EXCLUDED.last_read_id`,
    [conv.id, req.user.id, last.id],
  )
  // Marca como lidas as notificações desta conversa.
  await q("UPDATE notifications SET read_at = now() WHERE user_id = $1 AND link = $2 AND read_at IS NULL", [
    req.user.id,
    `/conversas/${conv.id}`,
  ])
  res.json({ ok: true })
})

// ---------- contratação ----------

// O contratante solicita o serviço; o prestador responde com proposta.
r.post('/conversations/:id/contracts', async (req, res) => {
  const conv = await loadConversation(req.params.id, req.user.id)
  if (conv.client_id !== req.user.id) fail(403, 'Somente o contratante pode solicitar o serviço')
  const note = maskContacts(str(req.body?.note, { max: 500, name: 'descrição do pedido' })).text
  const open = await one(
    "SELECT id FROM contracts WHERE conversation_id = $1 AND status NOT IN ('concluida', 'cancelada')",
    [conv.id],
  )
  if (open) fail(409, 'Já existe uma contratação em aberto nesta conversa')
  const { contractId, messageId } = await db().transaction(async (tx) => {
    const { rows } = await tx.query(
      'INSERT INTO contracts (conversation_id, offer_id, client_id, provider_id, request_note) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [conv.id, conv.offer_id, conv.client_id, conv.provider_id, note],
    )
    await tx.query("INSERT INTO contract_events (contract_id, to_status, actor_id, note) VALUES ($1, 'solicitada', $2, $3)", [
      rows[0].id,
      req.user.id,
      note,
    ])
    const messageId = await insertMessage(tx.query, conv.id, null, 'sistema', `Serviço solicitado${note ? `: ${note}` : ''}`)
    return { contractId: rows[0].id, messageId }
  })
  await broadcastMessage(conv, messageId)
  await notify(conv.provider_id, {
    kind: 'contratacao',
    title: 'Nova solicitação de serviço',
    body: `${req.user.name.split(' ')[0]} solicitou "${conv.offer_title}". Envie sua proposta.`,
    link: `/conversas/${conv.id}`,
  })
  const c = await loadContract(contractId, req.user.id)
  await pushContractUpdate(c)
  res.status(201).json({ contract: await contractDetails(c, req.user.id) })
})

// RF08: proposta com valor e prazo enviada pelo prestador.
r.post('/contracts/:id/proposals', async (req, res) => {
  const c = await loadContract(req.params.id, req.user.id)
  const side = c.client_id === req.user.id ? 'client' : 'provider'
  const to = nextStatus(c.status, 'propor', side)
  const amount = parseMoneyToCents(req.body?.amount)
  if (!amount || amount < 100) fail(400, 'Informe um valor de pelo menos R$ 1,00')
  if (amount > 10_000_000) fail(400, 'Valor acima do permitido')
  const deadline = String(req.body?.deadline || '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline) || Number.isNaN(Date.parse(deadline))) fail(400, 'Informe o prazo')
  const today = localYmd(new Date())
  if (deadline < today) fail(400, 'O prazo não pode estar no passado')
  const notes = maskContacts(str(req.body?.notes, { max: 500, name: 'observações' })).text

  const messageId = await db().transaction(async (tx) => {
    await tx.query("UPDATE proposals SET status = 'substituida' WHERE contract_id = $1 AND status = 'pendente'", [c.id])
    const { rows } = await tx.query(
      'INSERT INTO proposals (contract_id, amount_cents, deadline, notes) VALUES ($1, $2, $3, $4) RETURNING id',
      [c.id, amount, deadline, notes],
    )
    await tx.query('UPDATE contracts SET status = $2, updated_at = now() WHERE id = $1', [c.id, to])
    await tx.query('INSERT INTO contract_events (contract_id, from_status, to_status, actor_id, note) VALUES ($1, $2, $3, $4, $5)', [
      c.id,
      c.status,
      to,
      req.user.id,
      `${formatBRL(amount)} até ${deadline.split('-').reverse().join('/')}`,
    ])
    return insertMessage(tx.query, c.conversation_id, req.user.id, 'proposta', `Proposta: ${formatBRL(amount)}`, { proposalId: rows[0].id })
  })
  const conv = { id: c.conversation_id, client_id: c.client_id, provider_id: c.provider_id }
  await broadcastMessage(conv, messageId)
  await notify(c.client_id, {
    kind: 'proposta',
    title: 'Proposta recebida',
    body: `${c.provider_name.split(' ')[0]} enviou uma proposta de ${formatBRL(amount)} para "${c.offer_title}"`,
    link: `/conversas/${c.conversation_id}`,
  })
  const updated = await loadContract(c.id, req.user.id)
  await pushContractUpdate(updated)
  res.status(201).json({ contract: await contractDetails(updated, req.user.id) })
})

function receiptCode() {
  const d = localYmd(new Date()).replace(/-/g, '')
  return `CB-${d}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}

const ACTION_MESSAGES = {
  aceitar: 'Proposta aceita pelo contratante',
  recusar: 'Proposta recusada pelo contratante',
  iniciar: 'Serviço iniciado pelo prestador',
  concluir: 'Serviço concluído',
  cancelar: 'Contratação cancelada',
}

// RF09: aceitar, recusar, iniciar, concluir, cancelar.
r.post('/contracts/:id/actions', async (req, res) => {
  const action = String(req.body?.action || '')
  if (action === 'propor') fail(400, 'Use o envio de proposta')
  const note = maskContacts(str(req.body?.note, { max: 300, name: 'observação' })).text

  const result = await db().transaction(async (tx) => {
    const { rows } = await tx.query('SELECT * FROM contracts WHERE id = $1 FOR UPDATE', [Number(req.params.id) || 0])
    const c = rows[0]
    if (!c || (c.client_id !== req.user.id && c.provider_id !== req.user.id)) fail(404, 'Contratação não encontrada')
    const side = c.client_id === req.user.id ? 'client' : 'provider'
    const to = nextStatus(c.status, action, side)
    const extra = { commission: null }

    if (action === 'aceitar' || action === 'recusar') {
      const p = (await tx.query("SELECT * FROM proposals WHERE contract_id = $1 AND status = 'pendente' ORDER BY id DESC LIMIT 1", [c.id])).rows[0]
      if (!p) fail(409, 'Não há proposta pendente')
      await tx.query('UPDATE proposals SET status = $2 WHERE id = $1', [p.id, action === 'aceitar' ? 'aceita' : 'recusada'])
      if (action === 'aceitar') {
        await tx.query('UPDATE contracts SET amount_cents = $2, deadline = $3 WHERE id = $1', [c.id, p.amount_cents, p.deadline])
      }
    }
    if (action === 'cancelar') {
      await tx.query("UPDATE proposals SET status = 'recusada' WHERE contract_id = $1 AND status = 'pendente'", [c.id])
    }
    if (action === 'concluir') {
      // RF10: apuração automática da comissão de 6% e geração do comprovante.
      const calc = computeCommission(c.amount_cents, config.commissionRate)
      const code = receiptCode()
      await tx.query(
        'INSERT INTO commissions (contract_id, gross_cents, rate, commission_cents, net_cents, receipt_code) VALUES ($1, $2, $3, $4, $5, $6)',
        [c.id, calc.grossCents, calc.rate, calc.commissionCents, calc.netCents, code],
      )
      extra.commission = { ...calc, receiptCode: code }
    }
    await tx.query(
      `UPDATE contracts SET status = $2, updated_at = now(), concluded_at = CASE WHEN $2 = 'concluida' THEN now() ELSE concluded_at END WHERE id = $1`,
      [c.id, to],
    )
    await tx.query('INSERT INTO contract_events (contract_id, from_status, to_status, actor_id, note) VALUES ($1, $2, $3, $4, $5)', [
      c.id,
      c.status,
      to,
      req.user.id,
      note,
    ])
    let body = ACTION_MESSAGES[action]
    if (action === 'concluir') body += `. Valor ${formatBRL(extra.commission.grossCents)}, comissão da plataforma ${formatBRL(extra.commission.commissionCents)}. Avaliem um ao outro.`
    if (note) body += ` (${note})`
    const messageId = await insertMessage(tx.query, c.conversation_id, null, 'sistema', body)
    return { c, to, messageId, extra }
  })

  const { c, to, messageId } = result
  const conv = { id: c.conversation_id, client_id: c.client_id, provider_id: c.provider_id }
  await broadcastMessage(conv, messageId)
  const otherId = c.client_id === req.user.id ? c.provider_id : c.client_id
  await notify(otherId, {
    kind: 'contratacao',
    title: `Contratação: ${STATUS_LABELS[to]}`,
    body: ACTION_MESSAGES[action],
    link: `/conversas/${c.conversation_id}`,
  })
  if (to === 'concluida') {
    for (const userId of [c.client_id, c.provider_id]) {
      await notify(userId, {
        kind: 'avaliacao',
        title: 'Avalie a contratação',
        body: 'Sua avaliação ajuda os vizinhos a contratar com segurança.',
        link: `/conversas/${c.conversation_id}`,
      })
    }
  }
  const updated = await loadContract(c.id, req.user.id)
  await pushContractUpdate(updated)
  res.json({ contract: await contractDetails(updated, req.user.id) })
})

r.get('/contracts', async (req, res) => {
  const rows = await many(
    `${CONTRACT_SELECT} WHERE k.client_id = $1 OR k.provider_id = $1 ORDER BY k.updated_at DESC`,
    [req.user.id],
  )
  res.json({ contracts: rows.map((c) => serializeContract(c, req.user.id)) })
})

r.get('/contracts/:id', async (req, res) => {
  const c = await loadContract(req.params.id, req.user.id)
  res.json({ contract: await contractDetails(c, req.user.id) })
})

// RF10: comprovante da contratação concluída.
r.get('/contracts/:id/receipt', async (req, res) => {
  const c = await loadContract(req.params.id, req.user.id)
  const k = await one('SELECT * FROM commissions WHERE contract_id = $1', [c.id])
  if (!k) fail(404, 'O comprovante é gerado quando o serviço é concluído')
  res.json({
    receipt: {
      receiptCode: k.receipt_code,
      issuedAt: k.created_at,
      contractId: c.id,
      offerTitle: c.offer_title,
      providerName: c.provider_name,
      clientName: c.client_name,
      concludedAt: c.concluded_at,
      deadline: c.deadline_s,
      grossCents: k.gross_cents,
      rate: Number(k.rate),
      commissionCents: k.commission_cents,
      netCents: k.net_cents,
    },
  })
})

// RF11: avaliação recíproca após a conclusão.
r.post('/contracts/:id/review', async (req, res) => {
  const c = await loadContract(req.params.id, req.user.id)
  if (c.status !== 'concluida') fail(409, 'A avaliação fica disponível após a conclusão do serviço')
  const rating = Number(req.body?.rating)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail(400, 'Escolha uma nota de 1 a 5')
  const comment = maskContacts(str(req.body?.comment, { max: 500, name: 'comentário' })).text
  const revieweeId = c.client_id === req.user.id ? c.provider_id : c.client_id
  const exists = await one('SELECT id FROM reviews WHERE contract_id = $1 AND reviewer_id = $2', [c.id, req.user.id])
  if (exists) fail(409, 'Você já avaliou esta contratação')
  await q('INSERT INTO reviews (contract_id, reviewer_id, reviewee_id, rating, comment) VALUES ($1, $2, $3, $4, $5)', [
    c.id,
    req.user.id,
    revieweeId,
    rating,
    comment,
  ])
  await notify(revieweeId, {
    kind: 'avaliacao',
    title: 'Você recebeu uma avaliação',
    body: `Nota ${rating} de 5 em "${c.offer_title}"`,
    link: `/conversas/${c.conversation_id}`,
  })
  await pushContractUpdate(c)
  res.status(201).json({ contract: await contractDetails(c, req.user.id) })
})

// Avaliações recebidas pelo usuário como contratante (visíveis para o prestador ao negociar).
r.get('/conversations/:id/counterpart', async (req, res) => {
  const conv = await loadConversation(req.params.id, req.user.id)
  const otherId = conv.client_id === req.user.id ? conv.provider_id : conv.client_id
  const rep = await one(
    `SELECT count(*)::int AS n, round(avg(rating)::numeric, 1)::float8 AS avg FROM reviews WHERE reviewee_id = $1`,
    [otherId],
  )
  res.json({ reviews: rep.n, avgRating: rep.avg })
})

export default r
