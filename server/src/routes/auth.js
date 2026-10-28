// RF01: cadastro e login com telefone verificado, sem exigência de documento empresarial.
import { Router } from 'express'
import { config } from '../config.js'
import { one, q } from '../db.js'
import { generateCode, hashCode, signToken, selfUser, requireAuth } from '../lib/auth.js'
import { fail, str } from '../lib/http.js'
import { normalizePhone } from '../lib/text.js'
import { randomAnchor, validLatLng } from '../lib/geo.js'

const r = Router()

r.post('/auth/request-code', async (req, res) => {
  const phone = normalizePhone(req.body?.phone)
  if (!phone) fail(400, 'Informe um celular válido com DDD, por exemplo (15) 99876-5432')
  const recent = await one(
    "SELECT count(*)::int AS n FROM otp_codes WHERE phone = $1 AND created_at > now() - interval '1 hour'",
    [phone],
  )
  if (recent.n >= 6) fail(429, 'Muitos códigos solicitados. Aguarde alguns minutos e tente de novo')
  const code = generateCode()
  await q("UPDATE otp_codes SET used = true WHERE phone = $1 AND NOT used", [phone])
  await q("INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')", [
    phone,
    hashCode(phone, code),
  ])
  if (config.smsMode === 'dev') {
    console.log(`[SMS de desenvolvimento] código para ${phone}: ${code}`)
    return res.json({ ok: true, devCode: code })
  }
  // Integração com provedor de SMS entra aqui (ex.: Twilio, Zenvia). Fora do escopo do protótipo.
  res.json({ ok: true })
})

r.post('/auth/verify', async (req, res) => {
  const phone = normalizePhone(req.body?.phone)
  const code = String(req.body?.code || '').replace(/\D/g, '')
  if (!phone || code.length !== 6) fail(400, 'Telefone ou código inválido')
  const otp = await one(
    'SELECT * FROM otp_codes WHERE phone = $1 AND NOT used AND expires_at > now() ORDER BY id DESC LIMIT 1',
    [phone],
  )
  if (!otp) fail(400, 'Código expirado. Peça um novo código')
  if (otp.attempts >= 5) fail(429, 'Tentativas esgotadas. Peça um novo código')
  if (otp.code_hash !== hashCode(phone, code)) {
    await q('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [otp.id])
    fail(400, 'Código incorreto')
  }

  let user = await one('SELECT * FROM users WHERE phone = $1', [phone])
  if (!user) {
    const name = str(req.body?.name, { max: 80, name: 'nome' })
    // Código correto, mas ainda falta o nome: não consome o código para a interface pedir o nome.
    if (!name) return res.json({ needsName: true })
    user = await one('INSERT INTO users (phone, name, is_provider) VALUES ($1, $2, $3) RETURNING *', [
      phone,
      name,
      Boolean(req.body?.isProvider),
    ])
  }
  if (user.blocked) fail(403, 'Esta conta foi suspensa pela moderação')
  await q('UPDATE otp_codes SET used = true WHERE id = $1', [otp.id])
  res.json({ token: signToken(user), user: selfUser(user) })
})

r.get('/me', requireAuth, async (req, res) => {
  const loc = await one('SELECT service_radius_km, updated_at FROM provider_locations WHERE user_id = $1', [req.user.id])
  res.json({
    user: selfUser(req.user),
    location: loc ? { hasLocation: true, serviceRadiusKm: Number(loc.service_radius_km), updatedAt: loc.updated_at } : { hasLocation: false },
  })
})

r.patch('/me', requireAuth, async (req, res) => {
  const b = req.body || {}
  const name = b.name !== undefined ? str(b.name, { max: 80, required: true, name: 'nome' }) : req.user.name
  const bio = b.bio !== undefined ? str(b.bio, { max: 400, name: 'apresentação' }) : req.user.bio
  const isProvider = b.isProvider !== undefined ? Boolean(b.isProvider) : req.user.is_provider
  const user = await one('UPDATE users SET name = $2, bio = $3, is_provider = $4 WHERE id = $1 RETURNING *', [
    req.user.id,
    name,
    bio,
    isProvider,
  ])
  res.json({ user: selfUser(user) })
})

// RF04: o prestador informa onde atende. A resposta nunca devolve as coordenadas.
export async function saveProviderLocation(run, userId, lat, lng, radiusKm) {
  const anchor = randomAnchor(lat, lng)
  await run(
    `INSERT INTO provider_locations (user_id, exact, anchor, service_radius_km, updated_at)
     VALUES ($1, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography, ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography, $6, now())
     ON CONFLICT (user_id) DO UPDATE SET exact = EXCLUDED.exact, anchor = EXCLUDED.anchor,
       service_radius_km = EXCLUDED.service_radius_km, updated_at = now()`,
    [userId, lat, lng, anchor.lat, anchor.lng, radiusKm],
  )
}

r.put('/me/location', requireAuth, async (req, res) => {
  const lat = Number(req.body?.lat)
  const lng = Number(req.body?.lng)
  const radius = Number(req.body?.serviceRadiusKm ?? 3)
  if (!validLatLng(lat, lng)) fail(400, 'Localização inválida')
  if (!(radius >= 0.5 && radius <= 20)) fail(400, 'Raio de atendimento deve ficar entre 0,5 e 20 km')
  await saveProviderLocation(q, req.user.id, lat, lng, radius)
  res.json({ location: { hasLocation: true, serviceRadiusKm: radius } })
})

r.patch('/me/location', requireAuth, async (req, res) => {
  const radius = Number(req.body?.serviceRadiusKm)
  if (!(radius >= 0.5 && radius <= 20)) fail(400, 'Raio de atendimento deve ficar entre 0,5 e 20 km')
  const row = await one('UPDATE provider_locations SET service_radius_km = $2 WHERE user_id = $1 RETURNING user_id', [req.user.id, radius])
  if (!row) fail(400, 'Defina primeiro o ponto de atendimento')
  res.json({ location: { hasLocation: true, serviceRadiusKm: radius } })
})

export default r
