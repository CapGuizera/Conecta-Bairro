// RF03 (cadastro assistido) e RF18 (operação offline): o agente de campo registra o levantamento
// e, com o consentimento do prestador, faz o cadastro em nome dele. Os registros feitos sem
// conexão chegam depois, em lote; o client_uuid garante que nada seja gravado duas vezes.
import { Router } from 'express'
import { db, many, one } from '../db.js'
import { requireRole } from '../lib/auth.js'
import { CATEGORY_SLUGS, categoryName } from '../lib/categories.js'
import { validLatLng } from '../lib/geo.js'
import { fail, str } from '../lib/http.js'
import { parseMoneyToCents } from '../lib/money.js'
import { normalizePhone } from '../lib/text.js'
import { saveProviderLocation } from './auth.js'
import { insertOffer } from './offers.js'

const r = Router()
r.use('/field', requireRole('agente', 'moderador'))

export const BARRIERS = {
  expor_endereco: 'Receio de expor o endereço',
  sem_cnpj: 'Não possui CNPJ ou registro',
  fiscalizacao: 'Receio de fiscalização',
  sem_tempo: 'Falta de tempo para manter perfil',
  nao_sabe_usar: 'Dificuldade com plataformas digitais',
  taxas_altas: 'Taxas das plataformas são altas',
  nao_precisa: 'Acredita que não precisa',
  outro: 'Outro motivo',
}

async function saveSurvey(agent, b) {
  const clientUuid = str(b.clientUuid, { max: 64, required: true, name: 'identificador' })
  const existing = await one('SELECT id, provider_id FROM field_surveys WHERE client_uuid = $1', [clientUuid])
  if (existing) return { id: existing.id, providerId: existing.provider_id, duplicate: true }

  const businessName = str(b.businessName, { max: 100, required: true, name: 'nome do negócio' })
  if (!CATEGORY_SLUGS.includes(b.category)) fail(400, 'Escolha a categoria do negócio')
  if (!['sim', 'nao', 'nao_sabe'].includes(b.appearsOnMaps)) fail(400, 'Informe se o negócio aparece em mapas digitais')
  const barriers = Array.isArray(b.barriers) ? b.barriers.filter((x) => BARRIERS[x]) : []
  const accepted = Boolean(b.accepted)
  const notes = str(b.notes, { max: 800, name: 'observações' })
  const collectedAt = b.collectedAt && !Number.isNaN(Date.parse(b.collectedAt)) ? new Date(b.collectedAt).toISOString() : new Date().toISOString()

  let provider = null
  if (accepted) {
    const p = b.provider || {}
    if (!p.consent) fail(400, 'É necessário registrar o consentimento do prestador')
    const name = str(p.name, { max: 80, required: true, name: 'nome do prestador' })
    const phone = normalizePhone(p.phone)
    if (!phone) fail(400, 'Celular do prestador inválido')
    const lat = Number(p.lat)
    const lng = Number(p.lng)
    if (!validLatLng(lat, lng)) fail(400, 'Registre a localização do ponto de atendimento')
    const radius = Math.min(20, Math.max(0.5, Number(p.serviceRadiusKm) || 2))
    const o = p.offer || {}
    const offer = {
      kind: o.kind === 'produto' ? 'produto' : 'servico',
      title: str(o.title, { max: 80, required: true, name: 'título da oferta' }),
      description: str(o.description, { max: 1500, name: 'descrição' }),
      category: CATEGORY_SLUGS.includes(o.category) ? o.category : b.category,
      priceMin: parseMoneyToCents(o.priceMin),
      priceMax: parseMoneyToCents(o.priceMax),
      priceUnit: str(o.priceUnit, { max: 30 }) || 'a combinar',
    }
    provider = { name, phone, lat, lng, radius, offer }
  }

  return db().transaction(async (tx) => {
    let providerId = null
    if (provider) {
      const found = (await tx.query('SELECT id FROM users WHERE phone = $1', [provider.phone])).rows[0]
      if (found) {
        providerId = found.id
        await tx.query('UPDATE users SET is_provider = true WHERE id = $1', [providerId])
      } else {
        providerId = (
          await tx.query('INSERT INTO users (phone, name, is_provider, assisted_by) VALUES ($1, $2, true, $3) RETURNING id', [
            provider.phone,
            provider.name,
            agent.id,
          ])
        ).rows[0].id
      }
      await saveProviderLocation(tx.query, providerId, provider.lat, provider.lng, provider.radius)
      await insertOffer(tx.query, providerId, provider.offer, [])
    }
    const { rows } = await tx.query(
      `INSERT INTO field_surveys (client_uuid, agent_id, business_name, category, appears_on_maps, barriers, accepted, provider_id, notes, collected_at)
       VALUES ($1, $2, $3, $4, $5, string_to_array($6, ','), $7, $8, $9, $10) RETURNING id`,
      [clientUuid, agent.id, businessName, b.category, b.appearsOnMaps, barriers.join(','), accepted, providerId, notes, collectedAt],
    )
    return { id: rows[0].id, providerId, duplicate: false }
  })
}

r.post('/field/surveys', async (req, res) => {
  res.status(201).json(await saveSurvey(req.user, req.body || {}))
})

// Sincronização em lote da fila offline: cada item é processado de forma independente.
r.post('/field/surveys/batch', async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 100) : []
  const results = []
  for (const item of items) {
    try {
      results.push({ clientUuid: item.clientUuid, ok: true, ...(await saveSurvey(req.user, item)) })
    } catch (err) {
      results.push({ clientUuid: item.clientUuid, ok: false, error: err.message })
    }
  }
  res.json({ results })
})

r.get('/field/surveys', async (req, res) => {
  const rows = await many(
    `SELECT s.*, u.name AS provider_name FROM field_surveys s LEFT JOIN users u ON u.id = s.provider_id
      WHERE s.agent_id = $1 ORDER BY s.collected_at DESC LIMIT 200`,
    [req.user.id],
  )
  res.json({
    surveys: rows.map((s) => ({
      id: s.id,
      businessName: s.business_name,
      category: s.category,
      categoryName: categoryName(s.category),
      appearsOnMaps: s.appears_on_maps,
      barriers: s.barriers,
      accepted: s.accepted,
      providerName: s.provider_name,
      collectedAt: s.collected_at,
      notes: s.notes,
    })),
  })
})

export default r
