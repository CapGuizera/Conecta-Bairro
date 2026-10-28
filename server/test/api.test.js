// Testes de integração da API com banco PGlite em memória.
// Cobre o fluxo completo e, principalmente, o requisito de que a localização do prestador nunca vaze.
import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'

process.env.NODE_ENV = 'test'
process.env.SMS_MODE = 'dev'
const { initDb, closeDb, one } = await import('../src/db.js')
const { createApp } = await import('../src/app.js')
const { runActivityCheck } = await import('../src/jobs.js')

const PROVIDER_POINT = { lat: -23.481234, lng: -47.421987 }
let base = ''
let server
const seen = [] // todas as respostas JSON, para a varredura de privacidade

async function api(method, path, { token, body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  seen.push({ path, data })
  return { status: res.status, data }
}

async function login(phone, name, isProvider = false) {
  const r1 = await api('POST', '/api/auth/request-code', { body: { phone } })
  assert.equal(r1.status, 200)
  const code = r1.data.devCode
  const r2 = await api('POST', '/api/auth/verify', { body: { phone, code } })
  if (r2.data.needsName) {
    const r3 = await api('POST', '/api/auth/verify', { body: { phone, code, name, isProvider } })
    assert.equal(r3.status, 200)
    return r3.data
  }
  return r2.data
}

test.before(async () => {
  await initDb({ memory: true })
  server = http.createServer(createApp())
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})

test.after(async () => {
  server.close()
  await closeDb()
})

const ctx = {}

test('RF01: cadastro com telefone verificado e sem documentação', async () => {
  const wrong = await api('POST', '/api/auth/request-code', { body: { phone: '123' } })
  assert.equal(wrong.status, 400)

  const r1 = await api('POST', '/api/auth/request-code', { body: { phone: '(15) 91111-0001' } })
  const bad = await api('POST', '/api/auth/verify', { body: { phone: '15911110001', code: r1.data.devCode === '000000' ? '111111' : '000000' } })
  assert.equal(bad.status, 400)
  const okButNoName = await api('POST', '/api/auth/verify', { body: { phone: '15911110001', code: r1.data.devCode } })
  assert.equal(okButNoName.data.needsName, true)

  const provider = await login('15911110001', 'Cleusa Teste', true)
  assert.ok(provider.token)
  assert.equal(provider.user.isProvider, true)
  ctx.provider = provider

  ctx.client = await login('15922220002', 'Thiago Teste')
  ctx.other = await login('15933330003', 'Intruso Teste')
  const again = await login('15922220002', 'ignorado')
  assert.equal(again.user.name, 'Thiago Teste', 'login repetido não recria a conta')
})

test('RF02 e RF04: prestador cadastra localização e oferta', async () => {
  const loc = await api('PUT', '/api/me/location', { token: ctx.provider.token, body: { ...PROVIDER_POINT, serviceRadiusKm: 3 } })
  assert.equal(loc.status, 200)
  assert.equal(loc.data.location.hasLocation, true)

  const notProvider = await api('POST', '/api/offers', { token: ctx.client.token, body: { title: 'x', category: 'outros' } })
  assert.equal(notProvider.status, 403)

  const created = await api('POST', '/api/offers', {
    token: ctx.provider.token,
    body: { title: 'Bolo de cenoura', description: 'Com cobertura de chocolate', category: 'alimentacao', kind: 'produto', priceMin: '40', priceMax: '80,00', priceUnit: 'por bolo' },
  })
  assert.equal(created.status, 201)
  assert.equal(created.data.offer.priceMinCents, 4000)
  ctx.offerId = created.data.offer.id
})

test('RF05 e RF06: busca por proximidade, necessidade e raio', async () => {
  const near = { lat: -23.4850, lng: -47.4250 }
  const r = await api('GET', `/api/search?lat=${near.lat}&lng=${near.lng}&radius=2&q=bolo`)
  assert.equal(r.status, 200)
  const hit = r.data.results.find((o) => o.id === ctx.offerId)
  assert.ok(hit, 'oferta encontrada pela necessidade')
  assert.ok(hit.distance.km >= 0.5 && hit.distance.km <= 1.2)

  const byNeed = await api('GET', `/api/search?lat=${near.lat}&lng=${near.lng}&radius=2&q=${encodeURIComponent('festa de aniversário')}`)
  assert.ok(byNeed.data.results.some((o) => o.id === ctx.offerId), 'necessidade mapeada para a categoria')

  const otherCategory = await api('GET', `/api/search?lat=${near.lat}&lng=${near.lng}&radius=2&category=beleza`)
  assert.ok(!otherCategory.data.results.some((o) => o.id === ctx.offerId))

  // ~ 6 km de distância: fora de um raio de 2 km, dentro de 10 km
  const far = { lat: -23.535, lng: -47.42 }
  const out = await api('GET', `/api/search?lat=${far.lat}&lng=${far.lng}&radius=2`)
  assert.ok(!out.data.results.some((o) => o.id === ctx.offerId))
  const wide = await api('GET', `/api/search?lat=${far.lat}&lng=${far.lng}&radius=10`)
  const w = wide.data.results.find((o) => o.id === ctx.offerId)
  assert.ok(w)
  assert.equal(w.outsideServiceArea, true, 'sinaliza que está além do raio de atendimento do prestador')
})

test('RF07: chat interno mascara contatos e gera sinalização automática', async () => {
  const conv = await api('POST', '/api/conversations', { token: ctx.client.token, body: { offerId: ctx.offerId } })
  assert.equal(conv.status, 201)
  ctx.convId = conv.data.conversationId
  const same = await api('POST', '/api/conversations', { token: ctx.client.token, body: { offerId: ctx.offerId } })
  assert.equal(same.data.conversationId, ctx.convId, 'não duplica conversa')

  const self = await api('POST', '/api/conversations', { token: ctx.provider.token, body: { offerId: ctx.offerId } })
  assert.equal(self.status, 400)

  const msg = await api('POST', `/api/conversations/${ctx.convId}/messages`, {
    token: ctx.client.token,
    body: { body: 'Oi! Me chama no whatsapp 15 99999-8888' },
  })
  assert.equal(msg.status, 201)
  assert.equal(msg.data.message.masked, true)
  assert.ok(!msg.data.message.body.includes('9999'))
  const auto = await one("SELECT count(*)::int AS n FROM reports WHERE reporter_id IS NULL AND reason = 'negociacao_externa'")
  assert.equal(auto.n, 1)

  const intruder = await api('GET', `/api/conversations/${ctx.convId}`, { token: ctx.other.token })
  assert.equal(intruder.status, 404, 'terceiros não leem a conversa')

  const view = await api('GET', `/api/conversations/${ctx.convId}`, { token: ctx.provider.token })
  assert.equal(view.data.messages.length, 1)
  assert.equal(JSON.stringify(view.data).includes('15922220002'), false, 'telefone do contratante não aparece')
})

test('RF08, RF09 e RF10: proposta, aceite, estados e comissão de 6%', async () => {
  const req = await api('POST', `/api/conversations/${ctx.convId}/contracts`, { token: ctx.client.token, body: { note: 'Bolo para sábado' } })
  assert.equal(req.status, 201)
  const id = req.data.contract.id
  ctx.contractId = id
  assert.equal(req.data.contract.status, 'solicitada')

  const dup = await api('POST', `/api/conversations/${ctx.convId}/contracts`, { token: ctx.client.token, body: {} })
  assert.equal(dup.status, 409)

  const t = new Date(Date.now() + 86_400_000)
  const tomorrow = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
  const byClient = await api('POST', `/api/contracts/${id}/proposals`, { token: ctx.client.token, body: { amount: '100', deadline: tomorrow } })
  assert.equal(byClient.status, 403, 'contratante não envia proposta')

  const p1 = await api('POST', `/api/contracts/${id}/proposals`, { token: ctx.provider.token, body: { amount: '90', deadline: tomorrow } })
  assert.equal(p1.data.contract.status, 'proposta_enviada')
  const rej = await api('POST', `/api/contracts/${id}/actions`, { token: ctx.client.token, body: { action: 'recusar' } })
  assert.equal(rej.data.contract.status, 'solicitada')

  const p2 = await api('POST', `/api/contracts/${id}/proposals`, { token: ctx.provider.token, body: { amount: '123,45', deadline: tomorrow, notes: 'Com entrega' } })
  assert.equal(p2.status, 201)
  const tooEarly = await api('POST', `/api/contracts/${id}/actions`, { token: ctx.provider.token, body: { action: 'concluir' } })
  assert.equal(tooEarly.status, 409, 'não conclui com proposta pendente')
  const providerAccept = await api('POST', `/api/contracts/${id}/actions`, { token: ctx.provider.token, body: { action: 'aceitar' } })
  assert.equal(providerAccept.status, 403)

  const acc = await api('POST', `/api/contracts/${id}/actions`, { token: ctx.client.token, body: { action: 'aceitar' } })
  assert.equal(acc.data.contract.status, 'aceita')
  assert.equal(acc.data.contract.amountCents, 12345)

  const skip = await api('POST', `/api/contracts/${id}/actions`, { token: ctx.provider.token, body: { action: 'concluir' } })
  assert.equal(skip.status, 409, 'não conclui sem iniciar')

  await api('POST', `/api/contracts/${id}/actions`, { token: ctx.provider.token, body: { action: 'iniciar' } })
  const done = await api('POST', `/api/contracts/${id}/actions`, { token: ctx.provider.token, body: { action: 'concluir' } })
  assert.equal(done.data.contract.status, 'concluida')
  assert.equal(done.data.contract.commission.commissionCents, 741) // 6% de 123,45 = 7,407
  assert.equal(done.data.contract.commission.netCents, 12345 - 741)
  assert.match(done.data.contract.commission.receiptCode, /^CB-\d{8}-[0-9A-F]{6}$/)

  const statuses = done.data.contract.events.map((e) => e.toStatus)
  assert.deepEqual(statuses, ['solicitada', 'proposta_enviada', 'solicitada', 'proposta_enviada', 'aceita', 'em_andamento', 'concluida'])

  const receipt = await api('GET', `/api/contracts/${id}/receipt`, { token: ctx.client.token })
  assert.equal(receipt.data.receipt.grossCents, 12345)
  const intruder = await api('GET', `/api/contracts/${id}/receipt`, { token: ctx.other.token })
  assert.equal(intruder.status, 404)

  const cancelAfter = await api('POST', `/api/contracts/${id}/actions`, { token: ctx.client.token, body: { action: 'cancelar' } })
  assert.equal(cancelAfter.status, 409, 'estado final não muda')
})

test('RF11 e RF12: avaliação mútua e reputação', async () => {
  const id = ctx.contractId
  const r1 = await api('POST', `/api/contracts/${id}/review`, { token: ctx.client.token, body: { rating: 5, comment: 'Delicioso' } })
  assert.equal(r1.status, 201)
  const again = await api('POST', `/api/contracts/${id}/review`, { token: ctx.client.token, body: { rating: 1 } })
  assert.equal(again.status, 409)
  const r2 = await api('POST', `/api/contracts/${id}/review`, { token: ctx.provider.token, body: { rating: 4 } })
  assert.equal(r2.status, 201)

  const profile = await api('GET', `/api/providers/${ctx.provider.user.id}`)
  assert.equal(profile.data.reputation.concluded, 1)
  assert.equal(profile.data.reputation.avgRating, 5, 'reputação do prestador ignora a nota que ele deu')
})

test('RF13 e RF14: destaque aparece primeiro e painel soma receita', async () => {
  const p2 = await login('15944440004', 'Concorrente Teste', true)
  await api('PUT', '/api/me/location', { token: p2.token, body: { lat: -23.4851, lng: -47.4251, serviceRadiusKm: 3 } })
  const o2 = await api('POST', '/api/offers', { token: p2.token, body: { title: 'Bolo de pote', category: 'alimentacao' } })
  const near = { lat: -23.4852, lng: -47.4252 }
  const before = await api('GET', `/api/search?lat=${near.lat}&lng=${near.lng}&radius=3&category=alimentacao`)
  assert.equal(before.data.results[0].id, o2.data.offer.id, 'sem destaque, o mais perto vem primeiro')

  const h = await api('POST', '/api/highlights', { token: ctx.provider.token, body: { offerId: ctx.offerId, plan: 'semanal' } })
  assert.equal(h.status, 201)
  const after = await api('GET', `/api/search?lat=${near.lat}&lng=${near.lng}&radius=3&category=alimentacao`)
  assert.equal(after.data.results[0].id, ctx.offerId)
  assert.equal(after.data.results[0].highlighted, true)

  const dash = await api('GET', '/api/my/dashboard?days=30', { token: ctx.provider.token })
  assert.equal(dash.data.totals.concluded, 1)
  assert.equal(dash.data.totals.contacts, 1)
  assert.equal(dash.data.revenue.gross, 12345)
  assert.equal(dash.data.revenue.commission, 741)
})

test('RF15: denúncia e moderação', async () => {
  const rep = await api('POST', '/api/reports', { token: ctx.other.token, body: { targetType: 'oferta', targetId: ctx.offerId, reason: 'informacao_incorreta' } })
  assert.equal(rep.status, 201)
  const noAccess = await api('GET', '/api/moderation/reports', { token: ctx.other.token })
  assert.equal(noAccess.status, 403)
})

test('RF16: oferta sem confirmação gera aviso e sai da busca após 45 dias', async () => {
  await one("UPDATE offers SET confirmed_at = now() - interval '31 days' WHERE id = $1 RETURNING id", [ctx.offerId])
  assert.equal(await runActivityCheck(), 1)
  assert.equal(await runActivityCheck(), 0, 'não repete o aviso no mesmo período')
  const notes = await api('GET', '/api/notifications', { token: ctx.provider.token })
  assert.ok(notes.data.notifications.some((n) => n.kind === 'confirmacao'))

  await one("UPDATE offers SET confirmed_at = now() - interval '46 days' WHERE id = $1 RETURNING id", [ctx.offerId])
  const hidden = await api('GET', `/api/search?lat=${PROVIDER_POINT.lat}&lng=${PROVIDER_POINT.lng}&radius=3`)
  assert.ok(!hidden.data.results.some((o) => o.id === ctx.offerId))
  await api('POST', `/api/offers/${ctx.offerId}/confirm`, { token: ctx.provider.token })
  const back = await api('GET', `/api/search?lat=${PROVIDER_POINT.lat}&lng=${PROVIDER_POINT.lng}&radius=3`)
  assert.ok(back.data.results.some((o) => o.id === ctx.offerId))
})

test('RF03 e RF18: cadastro assistido idempotente (fila offline reenviada)', async () => {
  await one("UPDATE users SET role = 'agente' WHERE id = $1 RETURNING id", [ctx.other.user.id])
  const item = {
    clientUuid: 'teste-uuid-1',
    businessName: 'Costuras da Vera',
    category: 'costura',
    appearsOnMaps: 'nao',
    barriers: ['expor_endereco', 'sem_cnpj'],
    accepted: true,
    collectedAt: new Date().toISOString(),
    provider: { consent: true, name: 'Vera', phone: '15955550005', lat: -23.48, lng: -47.42, serviceRadiusKm: 2, offer: { title: 'Ajustes de roupa' } },
  }
  const b1 = await api('POST', '/api/field/surveys/batch', { token: ctx.other.token, body: { items: [item, { ...item, clientUuid: 'teste-uuid-2', accepted: false, provider: undefined }] } })
  assert.equal(b1.data.results.every((x) => x.ok), true)
  const b2 = await api('POST', '/api/field/surveys/batch', { token: ctx.other.token, body: { items: [item] } })
  assert.equal(b2.data.results[0].duplicate, true)
  const n = await one("SELECT count(*)::int AS n FROM users WHERE phone = '+5515955550005' AND assisted_by IS NOT NULL")
  assert.equal(n.n, 1)
  const noConsent = await api('POST', '/api/field/surveys', { token: ctx.other.token, body: { ...item, clientUuid: 'teste-uuid-3', provider: { ...item.provider, consent: false } } })
  assert.equal(noConsent.status, 400)

  // O prestador cadastrado em campo entra depois com o próprio celular.
  const vera = await login('15955550005', 'x')
  assert.equal(vera.user.name, 'Vera')
  assert.equal(vera.user.isProvider, true)
})

test('privacidade: nenhuma resposta da API contém coordenadas do prestador', async () => {
  // Varre todas as respostas recebidas durante os testes acima.
  const forbiddenKeys = /^(lat|lng|lon|latitude|longitude|exact|anchor|location_point|geom|geography|coordinates)$/i
  const offenders = []
  const near = (v, ref) => typeof v === 'number' && Math.abs(v - ref) < 0.01
  const walk = (node, path) => {
    if (Array.isArray(node)) return node.forEach((x, i) => walk(x, `${path}[${i}]`))
    if (node && typeof node === 'object') {
      for (const [k, v] of Object.entries(node)) {
        if (forbiddenKeys.test(k) && !path.endsWith('pilot')) offenders.push(`${path}.${k}`)
        walk(v, `${path}.${k}`)
      }
      return
    }
    if (near(node, PROVIDER_POINT.lat) || near(node, PROVIDER_POINT.lng)) offenders.push(`${path}=${node}`)
    if (typeof node === 'string' && /-23\.48\d{2,}|-47\.42\d{2,}/.test(node)) offenders.push(`${path}="${node}"`)
  }
  for (const { path, data } of seen) walk(data, path)
  assert.deepEqual(offenders, [])
  assert.ok(seen.length > 40, 'a varredura cobriu as respostas do fluxo completo')

  // E a distância exibida é calculada a partir do ponto deslocado, não do endereço real.
  const row = await one(
    'SELECT ST_Distance(exact, anchor)::float8 AS d FROM provider_locations WHERE user_id = $1',
    [ctx.provider.user.id],
  )
  assert.ok(row.d >= 99 && row.d <= 301)
})
