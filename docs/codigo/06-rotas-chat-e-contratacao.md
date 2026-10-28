# 6. Rotas da API: chat, contratação, comissão e avaliação

O arquivo `server/src/routes/conversations.js` concentra o caminho principal do sistema: o morador conversa com o prestador (RF07),
solicita o serviço, recebe e aceita uma proposta (RF08), a contratação passa pelos estados (RF09), é concluída com apuração da comissão (RF10)
e os dois se avaliam (RF11). Tudo o que muda estado acontece dentro de **transações**, para nunca ficar pela metade.

## `server/src/routes/conversations.js`

Organizado em três partes: funções auxiliares, rotas de conversa e rotas de contratação.

**Linhas 1 a 12**

```js
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
```

Importações. Repare em `maskContacts` (filtro de contatos), `nextStatus` e `availableActions` (máquina de estados), `computeCommission` (comissão) e `emitTo` (tempo real).

**Linhas 14 a 15**

```js
const r = Router()
r.use(['/conversations', '/contracts'], requireAuth)
```

Cria o roteador e exige login em todas as rotas que começam com `/conversations` ou `/contracts`.

**Linhas 17 a 19**

```js
// ---------- helpers ----------

const localYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
```

`localYmd` monta a data local no formato `AAAA-MM-DD`. Usar a data local, e não a de Greenwich (UTC), evita que depois das 21h no horário de Brasília o sistema já considere "amanhã".

**Linhas 21 a 34**

```js
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
```

Converte uma mensagem do banco para o formato da interface. Mensagens de proposta levam junto os dados da proposta (valor, prazo, observações e situação), para virar um cartão no chat.

**Linhas 36 a 38**

```js
const MESSAGE_SELECT = `
  SELECT m.*, p.amount_cents AS p_amount, to_char(p.deadline, 'YYYY-MM-DD') AS p_deadline, p.notes AS p_notes, p.status AS p_status
    FROM messages m LEFT JOIN proposals p ON p.id = m.proposal_id`
```

Consulta-base das mensagens, já ligada à tabela de propostas. `to_char(p.deadline, 'YYYY-MM-DD')` devolve o prazo como texto, sem conversão de fuso.

**Linhas 40 a 53**

```js
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
```

Carrega a conversa com título e foto da oferta e os nomes das duas partes. **Controle de acesso**: se o usuário não for o contratante nem o prestador daquela conversa, responde "não encontrada" (404). Ninguém lê a conversa dos outros, e a resposta nem confirma que ela existe.

**Linhas 55 a 63**

```js
async function insertMessage(run, conversationId, senderId, kind, body, { masked = false, proposalId = null } = {}) {
  const { rows } = await run(
    `INSERT INTO messages (conversation_id, sender_id, kind, body, masked, proposal_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [conversationId, senderId, kind, body, masked, proposalId],
  )
  await run('UPDATE conversations SET last_message_at = now() WHERE id = $1', [conversationId])
  return rows[0].id
}
```

Grava uma mensagem e atualiza a data da última mensagem da conversa (que ordena a lista). Recebe `run` para funcionar dentro ou fora de uma transação.

**Linhas 65 a 71**

```js
async function broadcastMessage(conv, messageId) {
  const m = await one(`${MESSAGE_SELECT} WHERE m.id = $1`, [messageId])
  const payload = serializeMessage(m)
  emitTo(conv.client_id, 'message', payload)
  emitTo(conv.provider_id, 'message', payload)
  return payload
}
```

Lê a mensagem gravada e a envia em tempo real para as duas partes. Enviar também ao remetente mantém sincronizadas as outras abas ou aparelhos dele.

**Linhas 73 a 92**

```js
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
```

Converte a contratação para a interface **do ponto de vista de quem pede**: `side` diz se a pessoa é contratante ou prestador, `counterpart` é a outra parte e `actions` são os botões que ela pode usar agora.

**Linhas 94 a 100**

```js
const CONTRACT_SELECT = `
  SELECT k.*, to_char(k.deadline, 'YYYY-MM-DD') AS deadline_s, o.title AS offer_title,
         cu.name AS client_name, pu.name AS provider_name
    FROM contracts k
    JOIN offers o ON o.id = k.offer_id
    JOIN users cu ON cu.id = k.client_id
    JOIN users pu ON pu.id = k.provider_id`
```

Consulta-base das contratações, com título da oferta e nomes das partes.

**Linhas 102 a 106**

```js
async function loadContract(id, userId) {
  const c = await one(`${CONTRACT_SELECT} WHERE k.id = $1`, [Number(id) || 0])
  if (!c || (c.client_id !== userId && c.provider_id !== userId)) fail(404, 'Contratação não encontrada')
  return c
}
```

Carrega uma contratação com o mesmo controle de acesso da conversa: só as duas partes enxergam.

**Linhas 108 a 121**

```js
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
```

Monta o detalhe completo. O `Promise.all` executa as quatro consultas ao mesmo tempo: histórico de estados, propostas, comissão e avaliações.

**Linhas 122 a 147**

```js
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
```

Junta tudo:

- `events`: a linha do tempo da contratação;
- `proposals`: todas as propostas e a situação de cada uma;
- `commission`: os valores apurados, quando concluída;
- `myReview`, `counterpartReviewed` e `canReview`: se o usuário já avaliou, se a outra parte já avaliou e se a avaliação está liberada (só depois de concluída e uma vez por pessoa).

**Linhas 149 a 152**

```js
async function pushContractUpdate(c) {
  emitTo(c.client_id, 'contract', { id: c.id, conversationId: c.conversation_id })
  emitTo(c.provider_id, 'contract', { id: c.id, conversationId: c.conversation_id })
}
```

Avisa as duas partes, em tempo real, que a contratação mudou. A tela do chat recarrega os dados ao receber o aviso.

**Linhas 154 a 162**

```js
// ---------- conversas ----------

r.post('/conversations', async (req, res) => {
  const offer = await one(
    "SELECT o.* FROM offers o JOIN users u ON u.id = o.provider_id WHERE o.id = $1 AND o.status = 'ativa' AND NOT u.blocked",
    [Number(req.body?.offerId) || 0],
  )
  if (!offer) fail(404, 'Oferta não encontrada')
  if (offer.provider_id === req.user.id) fail(400, 'Você não pode iniciar conversa com a sua própria oferta')
```

**Iniciar conversa** sobre uma oferta. Recusa oferta inexistente, inativa ou de prestador bloqueado, e impede conversar com a própria oferta.

**Linhas 163 a 177**

```js
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
```

Se já existe conversa entre essa pessoa e essa oferta, reaproveita (a tabela também garante isso com `UNIQUE`). Se é nova, cria e notifica o prestador.
Cada conversa nova conta como "contato iniciado" no painel do prestador (RF14).

**Linhas 179 a 211**

```js
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
```

**Lista de conversas** do usuário, como contratante ou como prestador. Para cada uma: o nome da outra parte (o `CASE` escolhe qual), a última mensagem, quantas não foram lidas (mensagens da outra parte com id maior que o último lido) e o estado da contratação mais recente. Ordenada pela mensagem mais recente.

**Linhas 213 a 232**

```js
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
```

**Abrir conversa**: dados da conversa, todas as mensagens em ordem, a contratação mais recente com todos os detalhes e `canRequest`, que diz se o contratante pode solicitar o serviço (não há outra contratação em aberto).

**Linhas 234 a 238**

```js
r.post('/conversations/:id/messages', async (req, res) => {
  const conv = await loadConversation(req.params.id, req.user.id)
  const raw = str(req.body?.body, { max: 1000, required: true, name: 'mensagem' })
  const { text, masked } = maskContacts(raw)
  const id = await insertMessage(q, conv.id, req.user.id, 'texto', text, { masked })
```

**Enviar mensagem** (RF07). O texto é validado (até 1.000 caracteres) e passa pelo `maskContacts` **antes de ser gravado**: o telefone nunca chega ao banco nem ao destinatário.

**Linhas 239 a 245**

```js
  if (masked) {
    // RF15: tentativa de levar a negociação para fora gera sinalização automática para a moderação.
    await q(
      "INSERT INTO reports (reporter_id, target_type, target_id, reason, details) VALUES (NULL, 'mensagem', $1, 'negociacao_externa', $2)",
      [id, 'Sinalização automática: a mensagem continha dados de contato e foi mascarada.'],
    )
  }
```

Se algo foi removido, cria uma **denúncia automática** (sem denunciante, motivo "negociação externa") para a moderação acompanhar (RF15).

**Linhas 246 a 250**

```js
  await q(
    `INSERT INTO conversation_reads (conversation_id, user_id, last_read_id) VALUES ($1, $2, $3)
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET last_read_id = EXCLUDED.last_read_id`,
    [conv.id, req.user.id, id],
  )
```

Marca a própria mensagem como lida para quem enviou.

**Linhas 251 a 260**

```js
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
```

Envia a mensagem em tempo real e cria a notificação para a outra parte, com uma prévia de até 90 caracteres.

**Linhas 262 a 276**

```js
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
```

Marca a conversa como lida até a última mensagem e também as notificações que apontam para ela, zerando o número no sino.

**Linha 278**

```js
// ---------- contratação ----------
```

Separador das rotas de contratação.

**Linhas 280 a 289**

```js
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
```

**Solicitar serviço.** Só o contratante pode, e só se não houver outra contratação em aberto na conversa (409 se houver). A descrição do pedido também passa pelo filtro de contatos.

**Linhas 290 a 313**

```js
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
```

Numa única transação: cria a contratação no estado `solicitada`, registra o primeiro evento do histórico e grava a mensagem de sistema no chat.
Fora da transação (depois que tudo foi confirmado no banco), envia a mensagem em tempo real, notifica o prestador e avisa as duas telas.

**Linhas 315 a 327**

```js
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
```

**Enviar proposta.** `nextStatus(c.status, 'propor', side)` já recusa quem não é o prestador ou um estado inválido. Depois valida:

- valor de pelo menos R$ 1,00 e no máximo R$ 100.000,00;
- prazo em formato de data válido e não anterior a hoje;
- observações passando pelo filtro de contatos.

**Linhas 329 a 356**

```js
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
```

Na transação: marca como "substituída" a proposta anterior ainda pendente, grava a nova, muda o estado, registra o evento com valor e prazo e cria a mensagem do tipo `proposta`, que aparece como cartão no chat.
Depois notifica o contratante e atualiza as telas.

**Linhas 358 a 361**

```js
function receiptCode() {
  const d = localYmd(new Date()).replace(/-/g, '')
  return `CB-${d}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
}
```

Código do comprovante: `CB-` + data local + 6 caracteres aleatórios, por exemplo `CB-20261027-1F26CF`.

**Linhas 363 a 369**

```js
const ACTION_MESSAGES = {
  aceitar: 'Proposta aceita pelo contratante',
  recusar: 'Proposta recusada pelo contratante',
  iniciar: 'Serviço iniciado pelo prestador',
  concluir: 'Serviço concluído',
  cancelar: 'Contratação cancelada',
}
```

Texto da mensagem de sistema de cada ação.

**Linhas 371 a 375**

```js
// RF09: aceitar, recusar, iniciar, concluir, cancelar.
r.post('/contracts/:id/actions', async (req, res) => {
  const action = String(req.body?.action || '')
  if (action === 'propor') fail(400, 'Use o envio de proposta')
  const note = maskContacts(str(req.body?.note, { max: 300, name: 'observação' })).text
```

**Ações da contratação**: aceitar, recusar, iniciar, concluir e cancelar. Propor tem rota própria.

**Linhas 377 a 383**

```js
  const result = await db().transaction(async (tx) => {
    const { rows } = await tx.query('SELECT * FROM contracts WHERE id = $1 FOR UPDATE', [Number(req.params.id) || 0])
    const c = rows[0]
    if (!c || (c.client_id !== req.user.id && c.provider_id !== req.user.id)) fail(404, 'Contratação não encontrada')
    const side = c.client_id === req.user.id ? 'client' : 'provider'
    const to = nextStatus(c.status, action, side)
    const extra = { commission: null }
```

Tudo numa transação. O `SELECT ... FOR UPDATE` **trava a linha** da contratação até o fim: se as duas partes clicarem ao mesmo tempo (por exemplo, um cancela enquanto o outro conclui), a segunda espera a primeira terminar e então é validada sobre o estado já atualizado.
Em seguida confere o acesso, descobre o lado da pessoa e valida a ação com `nextStatus`.

**Linhas 385 a 392**

```js
    if (action === 'aceitar' || action === 'recusar') {
      const p = (await tx.query("SELECT * FROM proposals WHERE contract_id = $1 AND status = 'pendente' ORDER BY id DESC LIMIT 1", [c.id])).rows[0]
      if (!p) fail(409, 'Não há proposta pendente')
      await tx.query('UPDATE proposals SET status = $2 WHERE id = $1', [p.id, action === 'aceitar' ? 'aceita' : 'recusada'])
      if (action === 'aceitar') {
        await tx.query('UPDATE contracts SET amount_cents = $2, deadline = $3 WHERE id = $1', [c.id, p.amount_cents, p.deadline])
      }
    }
```

Aceitar ou recusar exige uma proposta pendente. Ao aceitar, o valor e o prazo da proposta passam a ser os da contratação.

**Linhas 393 a 395**

```js
    if (action === 'cancelar') {
      await tx.query("UPDATE proposals SET status = 'recusada' WHERE contract_id = $1 AND status = 'pendente'", [c.id])
    }
```

Ao cancelar, a proposta pendente (se houver) é encerrada como recusada.

**Linhas 396 a 416**

```js
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
```

**Conclusão com comissão (RF10).** Calcula a comissão de 6% sobre o valor aceito e grava valor bruto, taxa, comissão, líquido e o código do comprovante. Por estar na mesma transação da mudança de estado, não existe contratação concluída sem comissão nem comissão sem contratação concluída.

Depois, para qualquer ação: atualiza o estado (e a data de conclusão, se for o caso) e registra o evento no histórico.

**Linhas 417 a 422**

```js
    let body = ACTION_MESSAGES[action]
    if (action === 'concluir') body += `. Valor ${formatBRL(extra.commission.grossCents)}, comissão da plataforma ${formatBRL(extra.commission.commissionCents)}. Avaliem um ao outro.`
    if (note) body += ` (${note})`
    const messageId = await insertMessage(tx.query, c.conversation_id, null, 'sistema', body)
    return { c, to, messageId, extra }
  })
```

Monta a mensagem de sistema do chat. Na conclusão, ela informa valor e comissão e convida os dois a se avaliarem.

**Linhas 424 a 433**

```js
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
```

Depois da transação: envia a mensagem em tempo real e notifica a outra parte da mudança.

**Linhas 434 a 447**

```js
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
```

Na conclusão, as duas partes recebem a notificação pedindo a avaliação. Por fim, recarrega a contratação, avisa as telas e devolve o detalhe atualizado.

**Linhas 449 a 455**

```js
r.get('/contracts', async (req, res) => {
  const rows = await many(
    `${CONTRACT_SELECT} WHERE k.client_id = $1 OR k.provider_id = $1 ORDER BY k.updated_at DESC`,
    [req.user.id],
  )
  res.json({ contracts: rows.map((c) => serializeContract(c, req.user.id)) })
})
```

Lista de contratações do usuário, dos dois lados, da mais recente para a mais antiga.

**Linhas 457 a 460**

```js
r.get('/contracts/:id', async (req, res) => {
  const c = await loadContract(req.params.id, req.user.id)
  res.json({ contract: await contractDetails(c, req.user.id) })
})
```

Detalhe de uma contratação.

**Linhas 462 a 483**

```js
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
```

**Comprovante.** Só existe depois da conclusão (antes, responde 404 explicando). Disponível para as duas partes.

**Linhas 485 a 510**

```js
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
```

**Avaliação mútua.** Exige contratação concluída, nota inteira de 1 a 5 e uma única avaliação por pessoa. O comentário passa pelo filtro de contatos.
O avaliado é sempre a outra parte; ele recebe uma notificação com a nota.

**Linha 512**

```js
export default r
```

Exporta o roteador.

---
