# 7. Rotas da API: painel, destaque, notificações, moderação, campo e indicadores

Rotas que atendem aos requisitos de apoio (RF13 a RF17) e ao Plano de Aplicação do artigo (levantamento de campo, indicadores e questionário).

## `server/src/routes/provider.js`

Plano de destaque (RF13) e painel do prestador (RF14).

**Linhas 1 a 11**

```js
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
```

Importações e roteador.

**Linhas 13 a 17**

```js
export const HIGHLIGHT_PLANS = [
  { id: 'semanal', name: 'Semanal', days: 7, priceCents: 990 },
  { id: 'quinzenal', name: 'Quinzenal', days: 15, priceCents: 1790 },
  { id: 'mensal', name: 'Mensal', days: 30, priceCents: 2990 },
]
```

Os três planos de destaque com duração e preço em centavos. Também são enviados à interface pela rota `/meta`.

**Linhas 19 a 40**

```js
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
```

Histórico de destaques do prestador, indicando quais estão vigentes agora.

**Linhas 42 a 50**

```js
// Contratação do destaque. O pagamento é simulado no protótipo (PIX fictício confirmado na hora).
r.post('/highlights', requireProvider, async (req, res) => {
  const plan = HIGHLIGHT_PLANS.find((p) => p.id === req.body?.plan)
  if (!plan) fail(400, 'Escolha um plano')
  const offer = await one("SELECT * FROM offers WHERE id = $1 AND provider_id = $2 AND status = 'ativa'", [
    Number(req.body?.offerId) || 0,
    req.user.id,
  ])
  if (!offer) fail(404, 'Escolha uma oferta ativa')
```

**Contratar destaque.** Valida o plano e confere que a oferta é ativa e do próprio prestador.

**Linhas 51 a 63**

```js
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
```

Se a oferta já está em destaque, o novo período começa quando o atual acabar (os períodos se somam, nada é perdido).
O código de pagamento é fictício (`PIX-SIMULADO-...`), já que o protótipo não processa pagamentos reais. A categoria do destaque é a da oferta: o destaque vale "por categoria", como pede o RF13.

**Linhas 64 a 71**

```js
  await notify(req.user.id, {
    kind: 'destaque',
    title: 'Destaque contratado',
    body: `"${offer.title}" em destaque na categoria ${categoryName(offer.category)} até ${new Date(h.ends_at).toLocaleDateString('pt-BR')} (${formatBRL(plan.priceCents)})`,
    link: '/painel',
  })
  res.status(201).json({ highlight: { id: h.id, endsAt: h.ends_at, startsAt: h.starts_at, paymentCode: h.payment_code } })
})
```

Confirma ao prestador por notificação, com a data de término e o valor.

**Linhas 73 a 124**

```js
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
```

**Painel do prestador.** O período aceito é 7, 30, 90 ou 365 dias (30 por padrão). As seis consultas rodam em paralelo (`Promise.all`):

1. `totals`: visualizações, contatos iniciados, contratações concluídas e pedidos recebidos no período;
2. `revenue`: soma do valor bruto, da comissão e do líquido das contratações concluídas;
3. `rating`: média e quantidade de avaliações recebidas como prestador;
4. `open`: pedidos aguardando proposta e serviços em andamento (os alertas do topo do painel);
5. `series`: visualizações e contatos de cada dia, para o gráfico. `generate_series` cria uma linha por dia, mesmo nos dias sem movimento (até 30 dias no gráfico);
6. `perOffer`: os mesmos números separados por oferta.

`COALESCE(sum(...), 0)` faz a soma valer 0 em vez de nulo quando não há nada.

**Linhas 125 a 139**

```js
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
```

Monta a resposta e calcula a **taxa de conversão** (contratações concluídas dividido por contatos), com uma casa decimal.

---

## `server/src/routes/notifications.js`

Central de notificações (RF17).

**Linhas 1 a 8**

```js
// RF17
import { Router } from 'express'
import { many, q } from '../db.js'
import { requireAuth } from '../lib/auth.js'
import { serializeNotification, unreadCount } from '../lib/notify.js'

const r = Router()
r.use('/notifications', requireAuth)
```

Importações e exigência de login em `/notifications`.

**Linhas 10 a 13**

```js
r.get('/notifications', async (req, res) => {
  const rows = await many('SELECT * FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 100', [req.user.id])
  res.json({ notifications: rows.map(serializeNotification), unread: await unreadCount(req.user.id) })
})
```

As 100 notificações mais recentes e o total não lido.

**Linhas 15 a 17**

```js
r.get('/notifications/unread-count', async (req, res) => {
  res.json({ unread: await unreadCount(req.user.id) })
})
```

Só o número de não lidas, para o sino da barra superior.

**Linhas 19 a 22**

```js
r.post('/notifications/read-all', async (req, res) => {
  await q('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id])
  res.json({ unread: 0 })
})
```

Marca todas como lidas.

**Linhas 24 a 32**

```js
r.post('/notifications/:id/read', async (req, res) => {
  await q('UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL', [
    Number(req.params.id) || 0,
    req.user.id,
  ])
  res.json({ unread: await unreadCount(req.user.id) })
})

export default r
```

Marca uma como lida. O `user_id = $2` garante que só se marque a própria notificação.

---

## `server/src/routes/moderation.js`

Denúncia e moderação (RF15).

**Linhas 1 a 8**

```js
// RF15: denúncia e moderação
import { Router } from 'express'
import { many, one, q } from '../db.js'
import { requireAuth, requireRole } from '../lib/auth.js'
import { fail, str } from '../lib/http.js'
import { notify } from '../lib/notify.js'

const r = Router()
```

Importações e roteador.

**Linhas 10 a 15**

```js
export const REPORT_REASONS = {
  conteudo_improprio: 'Conteúdo impróprio',
  informacao_incorreta: 'Informação incorreta',
  negociacao_externa: 'Tentativa de negociar fora da plataforma',
  outro: 'Outro motivo',
}
```

Os motivos de denúncia e seus textos. "Tentativa de negociar fora da plataforma" é o mesmo motivo usado na sinalização automática do chat.

**Linhas 17 a 23**

```js
r.post('/reports', requireAuth, async (req, res) => {
  const targetType = req.body?.targetType
  const targetId = Number(req.body?.targetId) || 0
  const reason = req.body?.reason
  if (!['oferta', 'usuario', 'mensagem'].includes(targetType)) fail(400, 'Alvo inválido')
  if (!REPORT_REASONS[reason]) fail(400, 'Escolha o motivo')
  const details = str(req.body?.details, { max: 800, name: 'detalhes' })
```

**Denunciar.** Valida o tipo do alvo e o motivo.

**Linhas 24 a 26**

```js
  const table = { oferta: 'offers', usuario: 'users', mensagem: 'messages' }[targetType]
  const exists = await one(`SELECT id FROM ${table} WHERE id = $1`, [targetId])
  if (!exists) fail(404, 'Item denunciado não encontrado')
```

Confere se o item denunciado existe. O nome da tabela vem de um mapa fixo no código, nunca do usuário, então montar o SQL com ele é seguro.

**Linhas 27 a 35**

```js
  if (targetType === 'mensagem') {
    // Só quem participa da conversa pode denunciar a mensagem.
    const ok = await one(
      `SELECT 1 FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE m.id = $1 AND (c.client_id = $2 OR c.provider_id = $2)`,
      [targetId, req.user.id],
    )
    if (!ok) fail(404, 'Item denunciado não encontrado')
  }
```

Mensagens só podem ser denunciadas por quem participa da conversa. Para os outros, a resposta é a mesma de "não encontrado".

**Linhas 36 a 49**

```js
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
```

Evita denúncias repetidas: se a mesma pessoa já denunciou o mesmo item e a denúncia ainda está aberta, só confirma. Senão, grava.

**Linhas 51 a 62**

```js
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
```

Monta o resumo do item denunciado para o moderador: título, texto, situação, dono e link para a tela correspondente. Funciona para os três tipos de alvo.

**Linhas 64 a 92**

```js
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
```

**Fila da moderação** (só para o perfil moderador), filtrada por situação, com a contagem de abertas e resolvidas. Sinalizações automáticas aparecem como "Sistema (automático)".

**Linhas 94 a 102**

```js
r.post('/moderation/reports/:id/resolve', requireRole('moderador'), async (req, res) => {
  const rep = await one('SELECT * FROM reports WHERE id = $1', [Number(req.params.id) || 0])
  if (!rep) fail(404, 'Denúncia não encontrada')
  if (rep.status !== 'aberta') fail(409, 'Denúncia já resolvida')
  const decision = req.body?.decision
  if (!['procedente', 'improcedente'].includes(decision)) fail(400, 'Decisão inválida')
  const action = req.body?.action || 'nenhuma'
  const resolution = str(req.body?.resolution, { max: 500, name: 'justificativa' })
  const target = await describeTarget(rep)
```

**Decidir uma denúncia.** Só denúncias abertas, com decisão "procedente" ou "improcedente", providência e justificativa.

**Linhas 104 a 127**

```js
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
```

Providências possíveis quando a denúncia procede:

- `remover_oferta`: remove a oferta e avisa o prestador com a justificativa;
- `ocultar_mensagem`: troca o texto da mensagem por "[mensagem removida pela moderação]";
- `bloquear_usuario`: suspende a conta. O filtro `role = 'usuario'` impede bloquear contas da equipe (agentes, moderação, instituição);
- `advertir`: envia um aviso ao responsável.

**Linhas 128 a 144**

```js
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
```

Registra a decisão, a providência, quem decidiu e quando. Quem denunciou (se não foi automática) recebe uma notificação com o resultado.

---

## `server/src/routes/field.js`

Cadastro de campo: levantamento dos negócios (etapa 1 do Plano de Aplicação), cadastro assistido (RF03) e recebimento da fila offline (RF18).

**Linhas 1 a 13**

```js
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
```

Comentário sobre o funcionamento e importações. Repare que reaproveita `saveProviderLocation` e `insertOffer` das outras rotas, para o cadastro assistido seguir exatamente as mesmas regras do cadastro normal.

**Linhas 15 a 16**

```js
const r = Router()
r.use('/field', requireRole('agente', 'moderador'))
```

Só agentes de campo e moderadores acessam estas rotas.

**Linhas 18 a 27**

```js
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
```

Lista das barreiras que o agente pode marcar: os motivos que os prestadores declaram para não estar em plataformas digitais (objetivo específico "a" do artigo).

**Linhas 29 a 32**

```js
async function saveSurvey(agent, b) {
  const clientUuid = str(b.clientUuid, { max: 64, required: true, name: 'identificador' })
  const existing = await one('SELECT id, provider_id FROM field_surveys WHERE client_uuid = $1', [clientUuid])
  if (existing) return { id: existing.id, providerId: existing.provider_id, duplicate: true }
```

**Idempotência**: antes de tudo, procura o `clientUuid`. Se o registro já chegou antes (a fila offline pode reenviar quando a conexão oscila), devolve o que existe com `duplicate: true` e não grava de novo.

**Linhas 34 a 40**

```js
  const businessName = str(b.businessName, { max: 100, required: true, name: 'nome do negócio' })
  if (!CATEGORY_SLUGS.includes(b.category)) fail(400, 'Escolha a categoria do negócio')
  if (!['sim', 'nao', 'nao_sabe'].includes(b.appearsOnMaps)) fail(400, 'Informe se o negócio aparece em mapas digitais')
  const barriers = Array.isArray(b.barriers) ? b.barriers.filter((x) => BARRIERS[x]) : []
  const accepted = Boolean(b.accepted)
  const notes = str(b.notes, { max: 800, name: 'observações' })
  const collectedAt = b.collectedAt && !Number.isNaN(Date.parse(b.collectedAt)) ? new Date(b.collectedAt).toISOString() : new Date().toISOString()
```

Valida o levantamento: nome do negócio, categoria, se aparece em mapas (`sim`, `nao` ou `nao_sabe`), barreiras (só as da lista), se aceitou o cadastro, observações e a data da coleta.
A data da coleta é a do aparelho, porque o registro pode ter sido feito sem internet horas antes de chegar ao servidor.

**Linhas 42 a 64**

```js
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
```

Se o prestador aceitou o cadastro, valida os dados dele:

- **o consentimento registrado é obrigatório** (cadastro em nome de outra pessoa exige autorização);
- nome, celular e o ponto de atendimento (normalmente o GPS do agente, que está no local);
- raio de atendimento, limitado entre 0,5 e 20 km;
- a primeira oferta, que usa o nome do negócio quando o título não é informado.

**Linhas 66 a 92**

```js
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
```

Grava tudo numa transação:

- se o celular já tem conta, só a transforma em prestadora; senão, cria a conta registrando o agente em `assisted_by`;
- salva o ponto de atendimento (com o deslocamento de privacidade) e a oferta;
- grava o levantamento. `string_to_array($6, ',')` transforma "a,b" na lista do PostgreSQL.

Depois, o prestador entra com o próprio celular e encontra a conta pronta.

**Linhas 94 a 96**

```js
r.post('/field/surveys', async (req, res) => {
  res.status(201).json(await saveSurvey(req.user, req.body || {}))
})
```

Envio de um registro, quando há conexão.

**Linhas 98 a 110**

```js
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
```

**Envio em lote da fila offline** (até 100 itens). Cada item é processado separadamente: um registro com erro não impede os outros. A resposta diz o resultado de cada um, e a interface mantém na fila só os que falharam, com a mensagem de erro.

**Linhas 112 a 134**

```js
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
```

Os registros feitos pelo próprio agente, para a lista "Registros enviados".

---

## `server/src/routes/institution.js`

Painel de indicadores para instituições parceiras e questionário de satisfação. Implementa os indicadores da Tabela 5 do artigo e o painel de Business Intelligence citado na Seção 5.5.

**Linhas 1 a 11**

```js
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
```

Comentário com a regra principal (só dados agregados) e importações.

**Linhas 13 a 46**

```js
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
```

Dez consultas em paralelo:

- `field`: negócios abordados, quantos aceitaram, quantos não aparecem em mapas e quantos não souberam responder;
- `barriers`: quantas vezes cada barreira foi citada. `unnest(barriers)` transforma a lista de cada registro em linhas, para contar;
- `maps`: levantamentos por categoria e quantos estão fora dos mapas;
- `providers`: prestadores com oferta ativa, total de prestadores, quantos vieram do cadastro assistido e quantos moradores iniciaram conversa;
- `offersByCat`: ofertas ativas por categoria;
- `contracts`: contratações por estado;
- `money`: volume concluído e comissão total;
- `rating`: média geral das avaliações;
- `satisfaction`: média de satisfação e de facilidade e porcentagem que pretende continuar, por grupo;
- `weekly`: contatos e contratações concluídas por semana nas últimas 12 semanas.

Nenhuma consulta devolve nome, telefone ou localização.

**Linhas 47 a 79**

```js
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
```

Calcula as porcentagens (com uma casa decimal e protegidas contra divisão por zero) e organiza a resposta. A lista por categoria junta ofertas ativas e levantamentos de campo, omitindo categorias sem nenhum dos dois.

**Linhas 81 a 83**

```js
r.get('/institution/overview', requireRole('instituicao', 'moderador'), async (_req, res) => {
  res.json(await overview())
})
```

Rota do painel, para os perfis instituição e moderador.

**Linhas 85 a 107**

```js
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
```

**Exportação CSV** para análise em planilha. Cada indicador vira uma linha (seção, indicador, valor).

**Linhas 108 a 112**

```js
  const csv = '\uFEFF' + lines.map((l) => l.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="conectabairro-indicadores.csv"')
  res.send(csv)
})
```

Detalhes para o arquivo abrir certo no **Excel em português no Windows**:

- `\uFEFF` (BOM) no início avisa que o arquivo é UTF-8; sem ele o Excel embaralha os acentos;
- separador `;` (o Excel brasileiro usa vírgula como decimal, então espera ponto e vírgula entre colunas);
- valores entre aspas, com aspas internas duplicadas;
- quebra de linha `\r\n`, padrão do Windows.

O cabeçalho `Content-Disposition: attachment` faz o navegador baixar o arquivo com o nome indicado.

**Linhas 114 a 118**

```js
// Plano de aplicação, etapa 3: questionário estruturado ao término do período de uso.
r.get('/satisfaction/mine', requireAuth, async (req, res) => {
  const row = await one('SELECT created_at FROM satisfaction_surveys WHERE user_id = $1 ORDER BY id DESC LIMIT 1', [req.user.id])
  res.json({ answeredAt: row?.created_at || null })
})
```

Diz à tela de perfil se o usuário já respondeu o questionário.

**Linhas 120 a 138**

```js
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
```

Grava as respostas do questionário: grupo, satisfação e facilidade de 1 a 5, intenção de continuar (sim ou não, obrigatória) e comentário.

---

## `server/src/routes/meta.js`

Informações fixas que a interface precisa ao abrir.

**Linhas 1 a 9**

```js
import { Router } from 'express'
import { config } from '../config.js'
import { CATEGORIES } from '../lib/categories.js'
import { RADIUS_OPTIONS_KM } from '../lib/geo.js'
import { BARRIERS } from './field.js'
import { REPORT_REASONS } from './moderation.js'
import { HIGHLIGHT_PLANS } from './provider.js'

const r = Router()
```

Importações.

**Linhas 11 a 18**

```js
const DEMO_ACCOUNTS = [
  { phone: '(15) 90000-0001', name: 'Cleusa Batista', label: 'Persona 1: prestadora (bolos e salgados)' },
  { phone: '(15) 90000-0002', name: 'Thiago Nunes', label: 'Persona 2: morador contratante' },
  { phone: '(15) 90000-0003', name: 'Marcelo Duarte', label: 'Persona 3: prestador técnico' },
  { phone: '(15) 90000-0005', name: 'Agente de campo', label: 'Cadastro assistido e levantamento' },
  { phone: '(15) 90000-0006', name: 'Moderação', label: 'Denúncias' },
  { phone: '(15) 90000-0007', name: 'Associação de Moradores', label: 'Painel de indicadores' },
]
```

Atalhos da tela de login com as personas do artigo e os perfis de equipe.

**Linhas 20 a 35**

```js
r.get('/meta', (_req, res) => {
  res.json({
    categories: CATEGORIES.map(({ slug, name }) => ({ slug, name })),
    pilot: config.pilot,
    radiusOptionsKm: RADIUS_OPTIONS_KM,
    commissionRate: config.commissionRate,
    highlightPlans: HIGHLIGHT_PLANS,
    barriers: BARRIERS,
    reportReasons: REPORT_REASONS,
    smsMode: config.smsMode,
    // Atalhos da tela de login no modo demonstração (sem SMS real).
    demoAccounts: config.smsMode === 'dev' ? DEMO_ACCOUNTS : [],
  })
})

export default r
```

Devolve categorias, bairro piloto, opções de raio, taxa de comissão, planos de destaque, barreiras e motivos de denúncia. Com isso a interface não repete essas listas e tudo se mantém sincronizado com o servidor.
As contas de demonstração só são enviadas no modo `dev`.

---
