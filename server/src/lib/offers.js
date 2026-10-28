// Consultas e serialização de ofertas compartilhadas entre as rotas.
import { config } from '../config.js'
import { categoryName } from './categories.js'
import { approxDistance } from './geo.js'
import { normalize } from './text.js'

// Reputação do prestador (RF12): só conta contratações em que ele foi o prestador.
export const REPUTATION_JOIN = `
  LEFT JOIN LATERAL (
    SELECT
      (SELECT count(*)::int FROM contracts c WHERE c.provider_id = u.id AND c.status = 'concluida') AS concluded,
      (SELECT round(avg(rv.rating)::numeric, 1)::float8 FROM reviews rv JOIN contracts c ON c.id = rv.contract_id
         WHERE c.provider_id = u.id AND rv.reviewee_id = u.id) AS avg_rating,
      (SELECT count(*)::int FROM reviews rv JOIN contracts c ON c.id = rv.contract_id
         WHERE c.provider_id = u.id AND rv.reviewee_id = u.id) AS n_reviews
  ) rep ON true`

export const HIGHLIGHT_EXPR = `EXISTS (SELECT 1 FROM highlights h WHERE h.offer_id = o.id AND now() BETWEEN h.starts_at AND h.ends_at)`

export function buildSearchText(offer) {
  return normalize(`${offer.title} ${offer.description} ${categoryName(offer.category)}`)
}

export function needsConfirmation(confirmedAt) {
  return Date.now() - new Date(confirmedAt).getTime() > config.activity.askAfterDays * 86_400_000
}

// Nunca inclui coordenadas: apenas a distância aproximada já arredondada.
export function serializeOffer(row) {
  const distance = row.dist_m !== undefined && row.dist_m !== null ? approxDistance(Number(row.dist_m)) : null
  const serviceRadiusKm = row.service_radius_km !== undefined && row.service_radius_km !== null ? Number(row.service_radius_km) : null
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    category: row.category,
    categoryName: categoryName(row.category),
    priceMinCents: row.price_min_cents,
    priceMaxCents: row.price_max_cents,
    priceUnit: row.price_unit,
    images: row.images || [],
    status: row.status,
    confirmedAt: row.confirmed_at,
    needsConfirmation: needsConfirmation(row.confirmed_at),
    createdAt: row.created_at,
    highlighted: Boolean(row.highlighted),
    distance,
    serviceRadiusKm,
    outsideServiceArea: Boolean(distance && serviceRadiusKm && Number(row.dist_m) > serviceRadiusKm * 1000),
    provider: row.provider_name
      ? { id: row.provider_id, name: row.provider_name, memberSince: row.provider_since }
      : { id: row.provider_id },
    reputation: row.concluded !== undefined
      ? { concluded: row.concluded, avgRating: row.avg_rating, reviews: row.n_reviews }
      : undefined,
  }
}
