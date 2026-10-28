// RF02, RF04, RF05, RF06, RF12, RF16
import crypto from 'node:crypto'
import { Router } from 'express'
import { config } from '../config.js'
import { many, one, q } from '../db.js'
import { publicUser, requireProvider } from '../lib/auth.js'
import { CATEGORY_SLUGS, categoriesForTokens } from '../lib/categories.js'
import { MAX_RADIUS_KM, validLatLng } from '../lib/geo.js'
import { fail, str } from '../lib/http.js'
import { saveImages } from '../lib/images.js'
import { parseMoneyToCents } from '../lib/money.js'
import { HIGHLIGHT_EXPR, REPUTATION_JOIN, buildSearchText, serializeOffer } from '../lib/offers.js'
import { searchTokens } from '../lib/text.js'

const r = Router()

function readPoint(src) {
  const lat = Number(src.lat)
  const lng = Number(src.lng)
  return validLatLng(lat, lng) ? { lat, lng } : null
}

// RF05 + RF06: busca por categoria e/ou necessidade, dentro do raio, ordenada por distância.
// Ofertas com plano de destaque ativo (RF13) aparecem primeiro.
r.get('/search', async (req, res) => {
  const point = readPoint(req.query) || { lat: config.pilot.lat, lng: config.pilot.lng }
  const radiusKm = Math.min(MAX_RADIUS_KM, Math.max(0.5, Number(req.query.radius) || 2))
  const category = CATEGORY_SLUGS.includes(req.query.category) ? req.query.category : null
  const tokens = searchTokens(req.query.q || '')
  let textMatch = 'false'

  const params = [point.lat, point.lng, radiusKm * 1000, config.activity.hideAfterDays]
  const where = [
    "o.status = 'ativa'",
    'NOT u.blocked',
    "o.confirmed_at > now() - make_interval(days => $4::int)",
    'ST_DWithin(pl.anchor, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)',
  ]
  if (category) {
    params.push(category)
    where.push(`o.category = $${params.length}`)
  }
  if (tokens.length) {
    const ors = tokens.map((t) => {
      params.push(`%${t}%`)
      return `o.search_text LIKE $${params.length}`
    })
    // Quem cita o termo vem antes de quem só pertence à categoria relacionada.
    textMatch = `(${ors.join(' OR ')})`
    const cats = categoriesForTokens(tokens)
    if (cats.length) {
      params.push(cats.join(','))
      ors.push(`o.category = ANY (string_to_array($${params.length}, ','))`)
    }
    where.push(`(${ors.join(' OR ')})`)
  }

  const rows = await many(
    `SELECT o.*, u.name AS provider_name, u.created_at AS provider_since, pl.service_radius_km,
            ST_Distance(pl.anchor, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)::float8 AS dist_m,
            ${HIGHLIGHT_EXPR} AS highlighted, ${textMatch} AS text_match, rep.*
       FROM offers o
       JOIN users u ON u.id = o.provider_id
       JOIN provider_locations pl ON pl.user_id = o.provider_id
       ${REPUTATION_JOIN}
      WHERE ${where.join(' AND ')}
      ORDER BY highlighted DESC, text_match DESC, dist_m ASC, o.id ASC
      LIMIT 60`,
    params,
  )
  res.json({ radiusKm, results: rows.map(serializeOffer) })
})

r.get('/offers/:id', async (req, res) => {
  const point = readPoint(req.query)
  const params = [Number(req.params.id) || 0]
  let distExpr = 'NULL::float8'
  if (point) {
    params.push(point.lat, point.lng)
    distExpr = 'ST_Distance(pl.anchor, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography)::float8'
  }
  const row = await one(
    `SELECT o.*, u.name AS provider_name, u.created_at AS provider_since, u.bio AS provider_bio, pl.service_radius_km,
            ${distExpr} AS dist_m, ${HIGHLIGHT_EXPR} AS highlighted, rep.*
       FROM offers o
       JOIN users u ON u.id = o.provider_id
       LEFT JOIN provider_locations pl ON pl.user_id = o.provider_id
       ${REPUTATION_JOIN}
      WHERE o.id = $1 AND o.status <> 'removida' AND NOT u.blocked`,
    params,
  )
  const isOwner = req.user && req.user.id === row?.provider_id
  if (!row || (row.status === 'pausada' && !isOwner)) fail(404, 'Oferta não encontrada')

  // RF14: registra a visualização (uma por visitante por dia, sem contar o próprio prestador).
  if (!isOwner) {
    const viewer = req.user
      ? `u${req.user.id}`
      : `a${crypto.createHash('sha256').update(`${req.ip}|${req.headers['user-agent'] || ''}`).digest('hex').slice(0, 24)}`
    await q('INSERT INTO offer_views (offer_id, viewer_key) VALUES ($1, $2) ON CONFLICT DO NOTHING', [row.id, viewer])
  }

  let conversationId = null
  if (req.user && !isOwner) {
    const conv = await one('SELECT id FROM conversations WHERE offer_id = $1 AND client_id = $2', [row.id, req.user.id])
    conversationId = conv?.id || null
  }
  res.json({ offer: { ...serializeOffer(row), providerBio: row.provider_bio }, isOwner: Boolean(isOwner), conversationId })
})

// RF12: perfil público do prestador.
r.get('/providers/:id', async (req, res) => {
  const u = await one(
    `SELECT u.*, rep.* FROM users u ${REPUTATION_JOIN} WHERE u.id = $1 AND u.is_provider AND NOT u.blocked`,
    [Number(req.params.id) || 0],
  )
  if (!u) fail(404, 'Prestador não encontrado')
  const offers = await many(
    `SELECT o.*, ${HIGHLIGHT_EXPR} AS highlighted FROM offers o WHERE o.provider_id = $1 AND o.status = 'ativa' ORDER BY o.id DESC`,
    [u.id],
  )
  const reviews = await many(
    `SELECT rv.rating, rv.comment, rv.created_at, rw.name AS reviewer_name, o.title AS offer_title
       FROM reviews rv
       JOIN contracts c ON c.id = rv.contract_id
       JOIN users rw ON rw.id = rv.reviewer_id
       JOIN offers o ON o.id = c.offer_id
      WHERE c.provider_id = $1 AND rv.reviewee_id = $1
      ORDER BY rv.id DESC LIMIT 30`,
    [u.id],
  )
  res.json({
    provider: { ...publicUser(u), bio: u.bio },
    reputation: { concluded: u.concluded, avgRating: u.avg_rating, reviews: u.n_reviews },
    offers: offers.map(serializeOffer),
    reviews: reviews.map((x) => ({
      rating: x.rating,
      comment: x.comment,
      createdAt: x.created_at,
      reviewerName: x.reviewer_name.split(' ')[0],
      offerTitle: x.offer_title,
    })),
  })
})

function readOfferBody(b) {
  const title = str(b.title, { max: 80, required: true, name: 'título' })
  const description = str(b.description, { max: 1500, name: 'descrição' })
  if (!CATEGORY_SLUGS.includes(b.category)) fail(400, 'Escolha uma categoria')
  const kind = b.kind === 'produto' ? 'produto' : 'servico'
  const priceMin = parseMoneyToCents(b.priceMin)
  const priceMax = parseMoneyToCents(b.priceMax)
  if (priceMin !== null && priceMin < 0) fail(400, 'Preço inválido')
  if (priceMin !== null && priceMax !== null && priceMax < priceMin) fail(400, 'O preço máximo deve ser maior que o mínimo')
  const priceUnit = str(b.priceUnit, { max: 30, name: 'unidade de preço' }) || 'a combinar'
  return { title, description, category: b.category, kind, priceMin, priceMax, priceUnit }
}

export async function insertOffer(run, providerId, data, images) {
  const { rows } = await run(
    `INSERT INTO offers (provider_id, kind, title, description, category, price_min_cents, price_max_cents, price_unit, images, search_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10) RETURNING *`,
    [providerId, data.kind, data.title, data.description, data.category, data.priceMin, data.priceMax, data.priceUnit,
      JSON.stringify(images), buildSearchText(data)],
  )
  return rows[0]
}

r.get('/my/offers', requireProvider, async (req, res) => {
  const rows = await many(
    `SELECT o.*, ${HIGHLIGHT_EXPR} AS highlighted,
            (SELECT max(h.ends_at) FROM highlights h WHERE h.offer_id = o.id AND h.ends_at > now()) AS highlight_until,
            (SELECT count(*)::int FROM offer_views v WHERE v.offer_id = o.id) AS views
       FROM offers o WHERE o.provider_id = $1 AND o.status <> 'removida' ORDER BY o.id DESC`,
    [req.user.id],
  )
  res.json({ offers: rows.map((row) => ({ ...serializeOffer(row), views: row.views, highlightUntil: row.highlight_until })) })
})

r.post('/offers', requireProvider, async (req, res) => {
  const data = readOfferBody(req.body || {})
  const images = saveImages(req.body?.images || [])
  const row = await insertOffer(q, req.user.id, data, images)
  res.status(201).json({ offer: serializeOffer(row) })
})

async function ownOffer(req) {
  const row = await one("SELECT * FROM offers WHERE id = $1 AND provider_id = $2 AND status <> 'removida'", [
    Number(req.params.id) || 0,
    req.user.id,
  ])
  if (!row) fail(404, 'Oferta não encontrada')
  return row
}

r.put('/offers/:id', requireProvider, async (req, res) => {
  const current = await ownOffer(req)
  const data = readOfferBody(req.body || {})
  const images = req.body?.images !== undefined ? saveImages(req.body.images) : current.images
  const row = await one(
    `UPDATE offers SET kind = $2, title = $3, description = $4, category = $5, price_min_cents = $6, price_max_cents = $7,
            price_unit = $8, images = $9::jsonb, search_text = $10, updated_at = now(), confirmed_at = now()
      WHERE id = $1 RETURNING *`,
    [current.id, data.kind, data.title, data.description, data.category, data.priceMin, data.priceMax, data.priceUnit,
      JSON.stringify(images), buildSearchText(data)],
  )
  res.json({ offer: serializeOffer(row) })
})

r.patch('/offers/:id/status', requireProvider, async (req, res) => {
  const current = await ownOffer(req)
  const status = req.body?.status
  if (!['ativa', 'pausada', 'removida'].includes(status)) fail(400, 'Status inválido')
  const row = await one('UPDATE offers SET status = $2, updated_at = now() WHERE id = $1 RETURNING *', [current.id, status])
  res.json({ offer: serializeOffer(row) })
})

// RF16: o prestador confirma que a oferta continua ativa.
r.post('/offers/:id/confirm', requireProvider, async (req, res) => {
  const current = await ownOffer(req)
  const row = await one(
    'UPDATE offers SET confirmed_at = now(), confirm_notified_at = NULL WHERE id = $1 RETURNING *',
    [current.id],
  )
  res.json({ offer: serializeOffer(row) })
})

r.post('/my/offers/confirm-all', requireProvider, async (req, res) => {
  const { rows } = await q(
    "UPDATE offers SET confirmed_at = now(), confirm_notified_at = NULL WHERE provider_id = $1 AND status <> 'removida' RETURNING id",
    [req.user.id],
  )
  res.json({ confirmed: rows.length })
})

export default r
