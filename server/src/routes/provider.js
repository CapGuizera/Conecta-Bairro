// RF13 (plano de destaque) e RF14 (painel do prestador)
import crypto from 'node:crypto'
import { Router } from 'express'
import { db, many, one } from '../db.js'
import { requireProvider } from '../lib/auth.js'
import { categoryName } from '../lib/categories.js'
import { fail } from '../lib/http.js'
import { formatBRL } from '../lib/money.js'
import { notify } from '../lib/notify.js'

const r = Router()

export const HIGHLIGHT_PLANS = [
  { id: 'semanal', name: 'Semanal', days: 7, priceCents: 990 },
  { id: 'quinzenal', name: 'Quinzenal', days: 15, priceCents: 1790 },
  { id: 'mensal', name: 'Mensal', days: 30, priceCents: 2990 },
]

r.get('/my/highlights', requireProvider, async (req, res) => {
  const rows = await many(
    `SELECT h.*, o.title AS offer_title FROM highlights h JOIN offers o ON o.id = h.offer_id
      WHERE h.provider_id = $1 ORDER BY h.id DESC`,
    [req.user.id],
  )
  res.json({
    highlights: rows.map((h) => ({
      id: h.id,
      offerId: h.offer_id,
      offerTitle: h.offer_title,
      category: h.category,
      categoryName: categoryName(h.category),
      plan: h.plan,
      startsAt: h.starts_at,
      endsAt: h.ends_at,
      priceCents: h.price_cents,
      paymentCode: h.payment_code,
      active: new Date(h.ends_at) > new Date() && new Date(h.starts_at) <= new Date(),
    })),
  })
})

// Contratação do destaque. O pagamento é simulado no protótipo (PIX fictício confirmado na hora).
r.post('/highlights', requireProvider, async (req, res) => {
  const plan = HIGHLIGHT_PLANS.find((p) => p.id === req.body?.plan)
  if (!plan) fail(400, 'Escolha um plano')
  const offer = await one("SELECT * FROM offers WHERE id = $1 AND provider_id = $2 AND status = 'ativa'", [
    Number(req.body?.offerId) || 0,
    req.user.id,
  ])
  if (!offer) fail(404, 'Escolha uma oferta ativa')
  const h = await db().transaction(async (tx) => {
    // Se já houver destaque ativo, o novo período começa quando o atual termina.
    const cur = (await tx.query('SELECT max(ends_at) AS ends FROM highlights WHERE offer_id = $1 AND ends_at > now()', [offer.id])).rows[0]
    const start = cur?.ends ? new Date(cur.ends) : new Date()
    const end = new Date(start.getTime() + plan.days * 86_400_000)
    const code = `PIX-SIMULADO-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
    const { rows } = await tx.query(
      `INSERT INTO highlights (provider_id, offer_id, category, plan, starts_at, ends_at, price_cents, payment_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.user.id, offer.id, offer.category, plan.id, start.toISOString(), end.toISOString(), plan.priceCents, code],
    )
    return rows[0]
  })
  await notify(req.user.id, {
    kind: 'destaque',
    title: 'Destaque contratado',
    body: `"${offer.title}" em destaque na categoria ${categoryName(offer.category)} até ${new Date(h.ends_at).toLocaleDateString('pt-BR')} (${formatBRL(plan.priceCents)})`,
    link: '/painel',
  })
  res.status(201).json({ highlight: { id: h.id, endsAt: h.ends_at, startsAt: h.starts_at, paymentCode: h.payment_code } })
})

// RF14: métricas de visualização, contatos, contratações e receita.
r.get('/my/dashboard', requireProvider, async (req, res) => {
  const days = [7, 30, 90, 365].includes(Number(req.query.days)) ? Number(req.query.days) : 30
  const me = req.user.id
  const P = [me, days]
  const since = "now() - make_interval(days => $2::int)"
  const [totals, revenue, rating, open, series, perOffer] = await Promise.all([
    one(
      `SELECT
         (SELECT count(*)::int FROM offer_views v JOIN offers o ON o.id = v.offer_id WHERE o.provider_id = $1 AND v.day > (${since})::date) AS views,
         (SELECT count(*)::int FROM conversations c WHERE c.provider_id = $1 AND c.created_at > ${since}) AS contacts,
         (SELECT count(*)::int FROM contracts k WHERE k.provider_id = $1 AND k.status = 'concluida' AND k.concluded_at > ${since}) AS concluded,
         (SELECT count(*)::int FROM contracts k WHERE k.provider_id = $1 AND k.created_at > ${since}) AS requests`,
      P,
    ),
    one(
      `SELECT COALESCE(sum(m.gross_cents), 0)::int AS gross, COALESCE(sum(m.commission_cents), 0)::int AS commission,
              COALESCE(sum(m.net_cents), 0)::int AS net
         FROM commissions m JOIN contracts k ON k.id = m.contract_id
        WHERE k.provider_id = $1 AND k.concluded_at > ${since}`,
      P,
    ),
    one(
      `SELECT round(avg(rv.rating)::numeric, 1)::float8 AS avg, count(*)::int AS n
         FROM reviews rv JOIN contracts k ON k.id = rv.contract_id WHERE k.provider_id = $1 AND rv.reviewee_id = $1`,
      [me],
    ),
    one(
      `SELECT count(*) FILTER (WHERE status = 'solicitada')::int AS awaiting_proposal,
              count(*) FILTER (WHERE status IN ('aceita', 'em_andamento'))::int AS in_progress
         FROM contracts WHERE provider_id = $1`,
      [me],
    ),
    many(
      `SELECT to_char(d, 'YYYY-MM-DD') AS day,
              (SELECT count(*)::int FROM offer_views v JOIN offers o ON o.id = v.offer_id WHERE o.provider_id = $1 AND v.day = d::date) AS views,
              (SELECT count(*)::int FROM conversations c WHERE c.provider_id = $1 AND c.created_at::date = d::date) AS contacts
         FROM generate_series(current_date - (least($2::int, 30) - 1), current_date, interval '1 day') AS d
        ORDER BY d`,
      P,
    ),
    many(
      `SELECT o.id, o.title, o.status,
              (SELECT count(*)::int FROM offer_views v WHERE v.offer_id = o.id AND v.day > (${since})::date) AS views,
              (SELECT count(*)::int FROM conversations c WHERE c.offer_id = o.id AND c.created_at > ${since}) AS contacts,
              (SELECT count(*)::int FROM contracts k WHERE k.offer_id = o.id AND k.status = 'concluida' AND k.concluded_at > ${since}) AS concluded,
              (SELECT COALESCE(sum(m.gross_cents), 0)::int FROM commissions m JOIN contracts k ON k.id = m.contract_id
                 WHERE k.offer_id = o.id AND k.concluded_at > ${since}) AS gross
         FROM offers o WHERE o.provider_id = $1 AND o.status <> 'removida' ORDER BY o.id`,
      P,
    ),
  ])
  res.json({
    days,
    totals: {
      ...totals,
      conversion: totals.contacts ? Math.round((totals.concluded / totals.contacts) * 1000) / 10 : 0,
    },
    revenue,
    rating: { avg: rating.avg, count: rating.n },
    pending: { awaitingProposal: open.awaiting_proposal, inProgress: open.in_progress },
    series,
    perOffer,
  })
})

export default r
