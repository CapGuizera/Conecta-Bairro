# 5. Rotas da API: cadastro, ofertas e busca

As rotas recebem as requisições do navegador. Padrão usado em todos os arquivos de rotas: cria-se um `Router` do Express,
cada `r.get`/`r.post`/... associa um endereço a uma função `async (req, res)`, e o arquivo exporta o roteador para o `app.js`.
`req.body` é o JSON enviado, `req.query` são os parâmetros da URL (depois do `?`), `req.params` são as partes variáveis do caminho (`:id`)
e `req.user` é o usuário logado (preenchido pelo `loadUser`). O `?.` (encadeamento opcional) evita erro quando o corpo não veio.

## `server/src/routes/auth.js`

Cadastro e login por telefone (RF01), dados do próprio usuário e ponto de atendimento do prestador (RF04).

**Linhas 1 a 10**

```js
// RF01: cadastro e login com telefone verificado, sem exigência de documento empresarial.
import { Router } from 'express'
import { config } from '../config.js'
import { one, q } from '../db.js'
import { generateCode, hashCode, signToken, selfUser, requireAuth } from '../lib/auth.js'
import { fail, str } from '../lib/http.js'
import { normalizePhone } from '../lib/text.js'
import { randomAnchor, validLatLng } from '../lib/geo.js'

const r = Router()
```

Comentário e importações. `const r = Router()` cria o roteador.

**Linhas 12 a 14**

```js
r.post('/auth/request-code', async (req, res) => {
  const phone = normalizePhone(req.body?.phone)
  if (!phone) fail(400, 'Informe um celular válido com DDD, por exemplo (15) 99876-5432')
```

**Pedir código.** Normaliza o telefone e recusa formatos inválidos.

**Linhas 15 a 19**

```js
  const recent = await one(
    "SELECT count(*)::int AS n FROM otp_codes WHERE phone = $1 AND created_at > now() - interval '1 hour'",
    [phone],
  )
  if (recent.n >= 6) fail(429, 'Muitos códigos solicitados. Aguarde alguns minutos e tente de novo')
```

Limite de 6 códigos por hora para o mesmo número (resposta 429, "muitas requisições"). Isso impede usar o sistema para disparar SMS em massa para um número.

**Linhas 20 a 25**

```js
  const code = generateCode()
  await q("UPDATE otp_codes SET used = true WHERE phone = $1 AND NOT used", [phone])
  await q("INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1, $2, now() + interval '10 minutes')", [
    phone,
    hashCode(phone, code),
  ])
```

Gera o código, invalida os códigos anteriores ainda não usados desse número e grava o novo (só o hash), válido por 10 minutos.

**Linhas 26 a 32**

```js
  if (config.smsMode === 'dev') {
    console.log(`[SMS de desenvolvimento] código para ${phone}: ${code}`)
    return res.json({ ok: true, devCode: code })
  }
  // Integração com provedor de SMS entra aqui (ex.: Twilio, Zenvia). Fora do escopo do protótipo.
  res.json({ ok: true })
})
```

No modo demonstração, mostra o código no terminal e o devolve na resposta, para a tela de login exibi-lo. Em produção, aqui entraria o envio por SMS, e o código nunca voltaria na resposta.

**Linhas 34 a 37**

```js
r.post('/auth/verify', async (req, res) => {
  const phone = normalizePhone(req.body?.phone)
  const code = String(req.body?.code || '').replace(/\D/g, '')
  if (!phone || code.length !== 6) fail(400, 'Telefone ou código inválido')
```

**Confirmar código.** Normaliza o telefone, mantém só os dígitos do código e exige exatamente 6.

**Linhas 38 a 47**

```js
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
```

Busca o código mais recente, não usado e dentro da validade. Depois de 5 tentativas erradas o código fica bloqueado.
Se o hash não bate, soma uma tentativa e responde "Código incorreto". Com 5 tentativas em 1 milhão de combinações, adivinhar é inviável.

**Linhas 49 a 59**

```js
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
```

Se o telefone ainda não tem conta, é um cadastro novo: exige o nome.
O detalhe importante está no comentário: com o código certo mas sem o nome, a rota responde `needsName` **sem consumir o código**, e a interface pede o nome e reenvia.
Só então cria o usuário, sem pedir CNPJ, CPF ou endereço (o artigo aponta a exigência de documentos como barreira de adesão).

**Linhas 60 a 63**

```js
  if (user.blocked) fail(403, 'Esta conta foi suspensa pela moderação')
  await q('UPDATE otp_codes SET used = true WHERE id = $1', [otp.id])
  res.json({ token: signToken(user), user: selfUser(user) })
})
```

Contas suspensas pela moderação não entram. O código é marcado como usado (não pode ser reaproveitado) e a resposta traz o token de sessão e os dados do usuário.

**Linhas 65 a 71**

```js
r.get('/me', requireAuth, async (req, res) => {
  const loc = await one('SELECT service_radius_km, updated_at FROM provider_locations WHERE user_id = $1', [req.user.id])
  res.json({
    user: selfUser(req.user),
    location: loc ? { hasLocation: true, serviceRadiusKm: Number(loc.service_radius_km), updatedAt: loc.updated_at } : { hasLocation: false },
  })
})
```

Dados do usuário logado. Sobre a localização, devolve **apenas** se ela existe e o raio de atendimento, nunca as coordenadas, nem para o próprio prestador.

**Linhas 73 a 85**

```js
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
```

Atualiza nome, apresentação e o "também ofereço serviços". Cada campo só muda se tiver sido enviado (`!== undefined`).

**Linhas 87 a 97**

```js
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
```

`saveProviderLocation` grava o ponto exato e gera o ponto público deslocado (`randomAnchor`).

- `ST_MakePoint(lng, lat)` cria o ponto: o PostGIS usa a ordem **longitude, latitude**, por isso os parâmetros aparecem invertidos.
- `ST_SetSRID(..., 4326)` diz que são coordenadas de GPS, e `::geography` faz as distâncias saírem em metros.
- `ON CONFLICT (user_id) DO UPDATE` é um *upsert*: cria se não existir, atualiza se já existir. Cada atualização sorteia um novo deslocamento.

A função recebe `run` como parâmetro para poder ser usada também dentro da transação do cadastro de campo.

**Linhas 99 a 107**

```js
r.put('/me/location', requireAuth, async (req, res) => {
  const lat = Number(req.body?.lat)
  const lng = Number(req.body?.lng)
  const radius = Number(req.body?.serviceRadiusKm ?? 3)
  if (!validLatLng(lat, lng)) fail(400, 'Localização inválida')
  if (!(radius >= 0.5 && radius <= 20)) fail(400, 'Raio de atendimento deve ficar entre 0,5 e 20 km')
  await saveProviderLocation(q, req.user.id, lat, lng, radius)
  res.json({ location: { hasLocation: true, serviceRadiusKm: radius } })
})
```

Rota que salva ponto e raio, validando as coordenadas e o raio (0,5 a 20 km). A resposta confirma o salvamento sem repetir as coordenadas.

**Linhas 109 a 115**

```js
r.patch('/me/location', requireAuth, async (req, res) => {
  const radius = Number(req.body?.serviceRadiusKm)
  if (!(radius >= 0.5 && radius <= 20)) fail(400, 'Raio de atendimento deve ficar entre 0,5 e 20 km')
  const row = await one('UPDATE provider_locations SET service_radius_km = $2 WHERE user_id = $1 RETURNING user_id', [req.user.id, radius])
  if (!row) fail(400, 'Defina primeiro o ponto de atendimento')
  res.json({ location: { hasLocation: true, serviceRadiusKm: radius } })
})
```

Muda só o raio de atendimento, sem mexer no ponto. Se o ponto ainda não existe, pede para defini-lo primeiro.

**Linha 117**

```js
export default r
```

Exporta o roteador.

---

## `server/src/routes/offers.js`

Busca por proximidade (RF05 e RF06), detalhe da oferta, perfil público (RF12), cadastro e edição de ofertas (RF02) e confirmação de atividade (RF16).

**Linhas 1 a 15**

```js
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
```

Importações e criação do roteador.

**Linhas 17 a 21**

```js
function readPoint(src) {
  const lat = Number(src.lat)
  const lng = Number(src.lng)
  return validLatLng(lat, lng) ? { lat, lng } : null
}
```

Lê `lat` e `lng` dos parâmetros da URL e devolve o ponto, ou `null` se forem inválidos.

**Linhas 23 a 30**

```js
// RF05 + RF06: busca por categoria e/ou necessidade, dentro do raio, ordenada por distância.
// Ofertas com plano de destaque ativo (RF13) aparecem primeiro.
r.get('/search', async (req, res) => {
  const point = readPoint(req.query) || { lat: config.pilot.lat, lng: config.pilot.lng }
  const radiusKm = Math.min(MAX_RADIUS_KM, Math.max(0.5, Number(req.query.radius) || 2))
  const category = CATEGORY_SLUGS.includes(req.query.category) ? req.query.category : null
  const tokens = searchTokens(req.query.q || '')
  let textMatch = 'false'
```

**Busca.** Prepara os filtros:

- ponto de busca: o enviado pelo navegador ou, na falta, o centro do bairro piloto;
- raio entre 0,5 e 10 km (2 km se não vier);
- categoria, aceita só se estiver na lista oficial;
- palavras da busca por necessidade.

**Linhas 32 a 38**

```js
  const params = [point.lat, point.lng, radiusKm * 1000, config.activity.hideAfterDays]
  const where = [
    "o.status = 'ativa'",
    'NOT u.blocked',
    "o.confirmed_at > now() - make_interval(days => $4::int)",
    'ST_DWithin(pl.anchor, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography, $3)',
  ]
```

Monta a consulta aos poucos. `params` guarda os valores e `where` as condições, sempre com `$n` (parâmetro numerado), nunca colando o texto do usuário no SQL.

Condições fixas:

- oferta ativa e prestador não bloqueado;
- confirmada nos últimos 45 dias (RF16);
- `ST_DWithin(anchor, ponto, metros)`: está dentro do raio. É aqui que o índice espacial trabalha. Repare que a medida usa o `anchor` (ponto deslocado), não o ponto exato.

**Linhas 39 a 42**

```js
  if (category) {
    params.push(category)
    where.push(`o.category = $${params.length}`)
  }
```

Filtro por categoria. `params.length` dá o número do próximo parâmetro.

**Linhas 43 a 56**

```js
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
```

Busca por texto: para cada palavra, uma condição `search_text LIKE '%palavra%'`.
`textMatch` guarda essas condições para a ordenação: quem cita a palavra aparece antes de quem só é da categoria relacionada.
Depois acrescenta as categorias ligadas às palavras (busca por necessidade) e junta tudo com `OR`: basta uma das condições.

**Linhas 58 a 72**

```js
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
```

Executa a consulta:

- `ST_Distance` calcula a distância até o ponto deslocado;
- traz nome do prestador, raio de atendimento, destaque, se cita o termo e a reputação;
- ordena por destaque, depois por citar o termo, depois **pela distância** (RF05), e por id para empates;
- limita a 60 resultados.

Cada linha passa por `serializeOffer`, que não tem como incluir coordenadas.

**Linhas 74 a 81**

```js
r.get('/offers/:id', async (req, res) => {
  const point = readPoint(req.query)
  const params = [Number(req.params.id) || 0]
  let distExpr = 'NULL::float8'
  if (point) {
    params.push(point.lat, point.lng)
    distExpr = 'ST_Distance(pl.anchor, ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography)::float8'
  }
```

**Detalhe da oferta.** Se o navegador mandou a posição, calcula a distância; senão, ela fica nula.

**Linhas 82 a 93**

```js
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
```

Busca a oferta com prestador, destaque e reputação. Ofertas removidas e prestadores bloqueados não aparecem; ofertas pausadas só para o próprio dono.

**Linhas 95 a 101**

```js
  // RF14: registra a visualização (uma por visitante por dia, sem contar o próprio prestador).
  if (!isOwner) {
    const viewer = req.user
      ? `u${req.user.id}`
      : `a${crypto.createHash('sha256').update(`${req.ip}|${req.headers['user-agent'] || ''}`).digest('hex').slice(0, 24)}`
    await q('INSERT INTO offer_views (offer_id, viewer_key) VALUES ($1, $2) ON CONFLICT DO NOTHING', [row.id, viewer])
  }
```

Registra uma visualização para o painel do prestador, sem contar o próprio dono. O visitante é identificado pelo id (logado) ou por um hash de IP com navegador (anônimo); o hash evita guardar o IP em si.
O `ON CONFLICT DO NOTHING` ignora a segunda visita do mesmo visitante no mesmo dia.

**Linhas 103 a 109**

```js
  let conversationId = null
  if (req.user && !isOwner) {
    const conv = await one('SELECT id FROM conversations WHERE offer_id = $1 AND client_id = $2', [row.id, req.user.id])
    conversationId = conv?.id || null
  }
  res.json({ offer: { ...serializeOffer(row), providerBio: row.provider_bio }, isOwner: Boolean(isOwner), conversationId })
})
```

Se o usuário logado já conversou sobre esta oferta, devolve o id da conversa: a tela mostra "Abrir conversa" em vez de criar outra.

**Linhas 111 a 117**

```js
// RF12: perfil público do prestador.
r.get('/providers/:id', async (req, res) => {
  const u = await one(
    `SELECT u.*, rep.* FROM users u ${REPUTATION_JOIN} WHERE u.id = $1 AND u.is_provider AND NOT u.blocked`,
    [Number(req.params.id) || 0],
  )
  if (!u) fail(404, 'Prestador não encontrado')
```

**Perfil público do prestador**: dados públicos e reputação.

**Linhas 118 a 144**

```js
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
```

Ofertas ativas do prestador e as últimas 30 avaliações recebidas como prestador, com o primeiro nome de quem avaliou e o título do serviço contratado.

**Linhas 146 a 157**

```js
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
```

Valida o formulário de oferta: título obrigatório (até 80 caracteres), descrição, categoria da lista, tipo, preços convertidos para centavos (máximo não pode ser menor que o mínimo) e unidade de preço.

**Linhas 159 a 167**

```js
export async function insertOffer(run, providerId, data, images) {
  const { rows } = await run(
    `INSERT INTO offers (provider_id, kind, title, description, category, price_min_cents, price_max_cents, price_unit, images, search_text)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10) RETURNING *`,
    [providerId, data.kind, data.title, data.description, data.category, data.priceMin, data.priceMax, data.priceUnit,
      JSON.stringify(images), buildSearchText(data)],
  )
  return rows[0]
}
```

Grava a oferta já com o texto de busca preparado. É exportada porque o cadastro de campo também cria ofertas, dentro da transação dele.

**Linhas 169 a 178**

```js
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
```

Ofertas do próprio prestador para o painel, com destaque vigente, data de término do destaque e total de visualizações.

**Linhas 180 a 185**

```js
r.post('/offers', requireProvider, async (req, res) => {
  const data = readOfferBody(req.body || {})
  const images = saveImages(req.body?.images || [])
  const row = await insertOffer(q, req.user.id, data, images)
  res.status(201).json({ offer: serializeOffer(row) })
})
```

Publica uma oferta: valida, salva as fotos e grava. Responde 201 ("criado").

**Linhas 187 a 194**

```js
async function ownOffer(req) {
  const row = await one("SELECT * FROM offers WHERE id = $1 AND provider_id = $2 AND status <> 'removida'", [
    Number(req.params.id) || 0,
    req.user.id,
  ])
  if (!row) fail(404, 'Oferta não encontrada')
  return row
}
```

Busca a oferta garantindo que ela pertence ao usuário logado (`provider_id = $2`). Um prestador não consegue editar a oferta de outro nem descobrir se ela existe.

**Linhas 196 a 208**

```js
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
```

Edita a oferta. Se as fotos não vierem no pedido, mantém as atuais. Editar também conta como confirmação de atividade (`confirmed_at = now()`).

**Linhas 210 a 216**

```js
r.patch('/offers/:id/status', requireProvider, async (req, res) => {
  const current = await ownOffer(req)
  const status = req.body?.status
  if (!['ativa', 'pausada', 'removida'].includes(status)) fail(400, 'Status inválido')
  const row = await one('UPDATE offers SET status = $2, updated_at = now() WHERE id = $1 RETURNING *', [current.id, status])
  res.json({ offer: serializeOffer(row) })
})
```

Pausa, reativa ou remove a oferta (a remoção é lógica: a linha continua para o histórico).

**Linhas 218 a 234**

```js
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
```

Confirmação de atividade (RF16), de uma oferta ou de todas de uma vez. Zera o aviso enviado para a contagem recomeçar.

**Linha 236**

```js
export default r
```

Exporta o roteador.

---
