# 4. Regras de negócio (server/src/lib)

Funções "puras" ou quase puras, que não dependem de requisição HTTP. É aqui que estão as regras mais sensíveis citadas na Seção 5.5 do artigo:
cálculo da comissão, consistência dos estados da contratação e controle de exposição da localização. Por serem isoladas, são as mais fáceis de testar (ver `server/test/unit.test.js`).

## `server/src/lib/money.js`

Dinheiro (RF10). Regra de ouro: valores sempre em **centavos inteiros**. Em JavaScript, `0.1 + 0.2` dá `0.30000000000000004`; com inteiros esse problema não existe.

**Linha 1**

```js
// RF10: valores sempre em centavos (inteiros) para não haver erro de ponto flutuante.
```

Comentário com a regra do arquivo.

**Linhas 3 a 11**

```js
// Comissão com arredondamento "meio para cima" no centavo.
export function computeCommission(grossCents, rate) {
  if (!Number.isInteger(grossCents) || grossCents <= 0) throw new Error('Valor bruto inválido')
  if (!(rate >= 0 && rate < 1)) throw new Error('Taxa inválida')
  // Trabalha em milionésimos de centavo para a taxa não introduzir erro binário (0.06 * 100 = 6.000000000000001)
  const ratePpm = Math.round(rate * 1_000_000)
  const commissionCents = Math.floor((grossCents * ratePpm + 500_000) / 1_000_000)
  return { grossCents, rate, commissionCents, netCents: grossCents - commissionCents }
}
```

`computeCommission` recebe o valor bruto em centavos e a taxa (0,06).

- As duas primeiras verificações recusam valor não inteiro, zero, negativo ou taxa fora de 0 a 1.
- A taxa vira "partes por milhão" (`0.06` vira `60000`), um inteiro. Até `0.06 * 100` dá `6.000000000000001` em ponto flutuante, por isso a conta é feita com inteiros.
- `(bruto * ppm + 500000) / 1000000` com `Math.floor` é o arredondamento **meio para cima**: somar meio milhão antes de truncar faz 1,5 centavo virar 2 e 1,44 virar 1.
- O líquido é calculado por subtração, garantindo que **bruto = comissão + líquido** sempre, sem centavo perdido.

**Linhas 13 a 15**

```js
export function formatBRL(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
```

Formata centavos como moeda brasileira (`15000` vira `R$ 150,00`) usando a internacionalização nativa do JavaScript.

**Linhas 17 a 25**

```js
// Converte "150", "150,5", "1.500,00" ou 150.5 em centavos.
export function parseMoneyToCents(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : null
  let s = String(value).replace(/[R$\s]/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}
```

`parseMoneyToCents` aceita o que a pessoa digita: `150`, `150,5`, `1.500,00` ou `R$ 35,5`.

- Vazio vira `null` (preço "a combinar").
- Número já pronto só é multiplicado por 100.
- Remove `R$` e espaços. Se houver vírgula, o formato é brasileiro: os pontos são separadores de milhar (removidos) e a vírgula vira ponto decimal.
- Texto que não é número vira `null`.

---

## `server/src/lib/contract-states.js`

Máquina de estados da contratação (RF09). Todas as mudanças de estado passam por `nextStatus`, que decide se a ação é permitida. Concentrar a regra num lugar evita que uma rota esqueça alguma verificação.

**Linhas 1 a 9**

```js
// RF09: máquina de estados da contratação. Toda mudança de estado passa por aqui.
//
//  solicitada --(prestador envia proposta)--> proposta_enviada
//  proposta_enviada --(contratante aceita)--> aceita
//  proposta_enviada --(contratante recusa)--> solicitada
//  proposta_enviada --(prestador envia nova proposta)--> proposta_enviada
//  aceita --(prestador inicia)--> em_andamento
//  em_andamento --(prestador conclui)--> concluida
//  solicitada | proposta_enviada | aceita | em_andamento --(qualquer parte cancela)--> cancelada
```

Diagrama em comentário com todas as transições possíveis.

**Linhas 11 a 18**

```js
export const STATUS_LABELS = {
  solicitada: 'Solicitada',
  proposta_enviada: 'Proposta enviada',
  aceita: 'Proposta aceita',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}
```

Nome de cada estado para exibir na tela.

**Linhas 20 a 27**

```js
export const TRANSITIONS = {
  propor: { from: ['solicitada', 'proposta_enviada'], to: 'proposta_enviada', by: 'provider' },
  aceitar: { from: ['proposta_enviada'], to: 'aceita', by: 'client' },
  recusar: { from: ['proposta_enviada'], to: 'solicitada', by: 'client' },
  iniciar: { from: ['aceita'], to: 'em_andamento', by: 'provider' },
  concluir: { from: ['em_andamento'], to: 'concluida', by: 'provider' },
  cancelar: { from: ['solicitada', 'proposta_enviada', 'aceita', 'em_andamento'], to: 'cancelada', by: 'any' },
}
```

Tabela de transições. Cada ação diz de quais estados pode partir (`from`), para qual vai (`to`) e quem pode executá-la (`by`): o prestador, o contratante ou qualquer um dos dois.
Exemplos: só o prestador propõe, inicia e conclui; só o contratante aceita ou recusa; ambos podem cancelar enquanto não estiver concluída.

**Linha 29**

```js
export const FINAL_STATUSES = ['concluida', 'cancelada']
```

Estados finais: depois deles nada mais muda.

**Linhas 31 a 46**

```js
// Retorna o novo estado ou lança erro explicando por que a ação não é permitida.
export function nextStatus(currentStatus, action, actorSide) {
  const t = TRANSITIONS[action]
  if (!t) throw Object.assign(new Error(`Ação desconhecida: ${action}`), { status: 400 })
  if (t.by !== 'any' && t.by !== actorSide) {
    const who = t.by === 'provider' ? 'o prestador' : 'o contratante'
    throw Object.assign(new Error(`Somente ${who} pode realizar esta ação`), { status: 403 })
  }
  if (!t.from.includes(currentStatus)) {
    throw Object.assign(
      new Error(`Não é possível "${action}" uma contratação no estado "${STATUS_LABELS[currentStatus]}"`),
      { status: 409 },
    )
  }
  return t.to
}
```

`nextStatus` valida a ação em três passos e lança erro com o código HTTP adequado:

1. ação desconhecida: 400 (pedido inválido);
2. a pessoa está do lado errado (por exemplo, o prestador tentando aceitar a própria proposta): 403 (proibido);
3. o estado atual não permite a ação (por exemplo, concluir algo que nem começou): 409 (conflito).

Se tudo estiver certo, devolve o novo estado.

**Linhas 48 a 53**

```js
// Ações disponíveis para um lado no estado atual (usado pela interface).
export function availableActions(currentStatus, actorSide) {
  return Object.entries(TRANSITIONS)
    .filter(([, t]) => t.from.includes(currentStatus) && (t.by === 'any' || t.by === actorSide))
    .map(([action]) => action)
}
```

`availableActions` lista o que um lado pode fazer no estado atual. A interface usa essa lista para mostrar só os botões válidos, e o servidor confere de novo quando o botão é usado.

---

## `server/src/lib/geo.js`

Localização (RF04 e RF06). Aqui está a técnica que protege o endereço do prestador.

**Linhas 1 a 4**

```js
// RF04 e RF06: tratamento de localização.
import crypto from 'node:crypto'

const EARTH_RADIUS_M = 6_371_000
```

Importa `crypto` para sortear com um gerador seguro (não previsível). Raio médio da Terra em metros, usado na conta abaixo.

**Linhas 6 a 8**

```js
export function validLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}
```

Confere se latitude e longitude são números válidos (latitude de -90 a 90, longitude de -180 a 180).

**Linhas 10 a 21**

```js
// Desloca o ponto exato para uma direção aleatória, entre 100 e 300 metros.
// As distâncias públicas são medidas a partir desse ponto, nunca do endereço real.
export function randomAnchor(lat, lng, minM = 100, maxM = 300) {
  const distance = minM + (crypto.randomInt(0, 10_001) / 10_000) * (maxM - minM)
  const bearing = (crypto.randomInt(0, 360_000) / 1000) * (Math.PI / 180)
  const φ1 = (lat * Math.PI) / 180
  const λ1 = (lng * Math.PI) / 180
  const δ = distance / EARTH_RADIUS_M
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(bearing))
  const λ2 = λ1 + Math.atan2(Math.sin(bearing) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2))
  return { lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI }
}
```

`randomAnchor` gera o **ponto público** a partir do ponto real:

- sorteia uma distância entre 100 e 300 m e uma direção (*bearing*) de 0 a 360 graus;
- converte graus em radianos (`φ` é a latitude, `λ` a longitude, `δ` a distância angular);
- aplica a fórmula do "ponto de destino" da trigonometria esférica, que calcula onde se chega andando aquela distância naquela direção sobre a superfície da Terra;
- devolve o resultado em graus.

Como as distâncias exibidas saem deste ponto, quem tentar triangular o endereço medindo de vários lugares chega, no máximo, ao ponto deslocado.

**Linhas 23 a 28**

```js
// Distância exibida ao usuário: arredondada em 100 m e com piso de 0,5 km.
export function approxDistance(meters) {
  const km = Math.max(0.5, Math.round(meters / 100) / 10)
  const label = meters < 500 ? 'menos de 0,5 km' : `${km.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
  return { km, label }
}
```

`approxDistance` prepara o que aparece na tela: arredonda em 100 m, nunca mostra menos que 0,5 km e usa o texto "menos de 0,5 km" para quem está muito perto. O número sai com vírgula, no formato brasileiro.

**Linhas 30 a 31**

```js
export const RADIUS_OPTIONS_KM = [0.5, 1, 2, 3, 5, 10]
export const MAX_RADIUS_KM = 10
```

Opções do controle deslizante de raio (RF06) e o raio máximo aceito pela busca.

---

## `server/src/lib/text.js`

Tratamento de texto: busca, telefone e o filtro de contatos do chat.

**Linha 1**

```js
// Utilitários de texto: normalização para busca, telefone e filtro de contatos no chat.
```

Comentário do arquivo.

**Linhas 3 a 11**

```js
export function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
```

Deixa o texto comparável: `normalize('NFD')` separa letra e acento, o primeiro `replace` remove os acentos, tudo vai para minúsculas, sinais viram espaço e espaços repetidos viram um só.
Assim "Aniversário" e "aniversario" são iguais na busca.

**Linhas 13 a 15**

```js
const STOPWORDS = new Set(
  'a o as os de da do das dos e em no na nos nas um uma uns umas para pra pro por com sem que meu minha meus minhas preciso precisa quero queria alguem algum alguma fazer faz tem ter perto aqui bairro servico servicos'.split(' '),
)
```

Palavras que não ajudam a buscar ("de", "para", "preciso", "alguém"...). Elas são descartadas de frases como "preciso de alguém para consertar meu chuveiro".

**Linhas 17 a 22**

```js
export function searchTokens(query) {
  return normalize(query)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .slice(0, 8)
}
```

Quebra a busca em palavras, descarta as curtas (menos de 3 letras) e as da lista acima, e limita a 8 palavras para a consulta não ficar pesada.

**Linhas 24 a 31**

```js
// Aceita "(15) 99876-5432", "15998765432", "+55 15 99876 5432". Retorna "+5515998765432".
export function normalizePhone(input) {
  let digits = String(input || '').replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2)
  if (digits.length !== 10 && digits.length !== 11) return null
  if (digits.startsWith('0')) return null
  return `+55${digits}`
}
```

`normalizePhone` (RF01) mantém só os dígitos, tira o `55` do Brasil se veio junto, exige 10 dígitos (fixo) ou 11 (celular) e recusa DDD começando com zero.
Todos os telefones ficam gravados no mesmo formato (`+5515998765432`), então a mesma pessoa não cria duas contas digitando de jeitos diferentes.

**Linhas 33 a 38**

```js
// RF07/RF15: remove telefones, e-mails, links e convites para outros aplicativos.
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/gi
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|net|org|br|me|ly|app)(?:\.br)?(?:\/\S*)?/gi
const HANDLE_RE = /(^|\s)@[\w.]{3,}/g
const APP_RE = /\b(whats\s?app|whats|wpp|zap|zapzap|telegram|insta(?:gram)?|face(?:book)?|me\s+liga|liga\s+(?:pra|para)\s+mim|meu\s+(?:numero|número|telefone|celular|cel|contato))\b/gi
const DIGIT_RUN_RE = /\+?\d[\d\s().-]{6,}\d/g
```

As expressões regulares que identificam formas de levar a negociação para fora da plataforma:

- `EMAIL_RE`: endereços de e-mail;
- `URL_RE`: links com `http`, `www` ou terminações como `.com` e `.com.br`;
- `HANDLE_RE`: perfis de rede social como `@cleusabolos`;
- `APP_RE`: menções como "whatsapp", "zap", "insta", "me liga", "meu número";
- `DIGIT_RUN_RE`: sequências de dígitos com espaços, pontos, traços ou parênteses, candidatas a telefone.

O `/gi` no fim significa "todas as ocorrências" e "ignorando maiúsculas e minúsculas".

**Linhas 40 a 53**

```js
export function maskContacts(text) {
  let masked = false
  const mark = () => {
    masked = true
    return '[contato removido]'
  }
  let out = String(text)
  out = out.replace(EMAIL_RE, mark)
  out = out.replace(URL_RE, mark)
  out = out.replace(HANDLE_RE, (m, pre) => `${pre}${mark()}`)
  out = out.replace(DIGIT_RUN_RE, (m) => (m.replace(/\D/g, '').length >= 8 ? mark() : m))
  out = out.replace(APP_RE, mark)
  return { text: out, masked }
}
```

`maskContacts` aplica os filtros em ordem e troca cada ocorrência por `[contato removido]`. A função `mark` registra que houve remoção.

Para os números, só remove sequências com **8 dígitos ou mais**: assim "R$ 120,00", "12/11 às 14h" e "2 bolos de 1,5 kg" continuam intactos, enquanto qualquer telefone (8 dígitos no mínimo) é removido.
Devolve o texto limpo e o indicador `masked`, que a rota usa para avisar o remetente e criar a sinalização automática para a moderação.

---

## `server/src/lib/categories.js`

Categorias de oferta e as palavras-chave da **busca por necessidade** (RF05).

**Linhas 1 a 14**

```js
// Categorias e palavras-chave usadas na busca por necessidade (RF05).
export const CATEGORIES = [
  { slug: 'alimentacao', name: 'Alimentação', keywords: 'bolo bolos salgado salgados doce doces marmita marmitas comida lanche torta pao paes festa aniversario encomenda brigadeiro coxinha almoco jantar' },
  { slug: 'costura', name: 'Costura e ajustes', keywords: 'costura costureira ajuste ajustes barra bainha roupa roupas conserto ziper vestido calca uniforme' },
  { slug: 'beleza', name: 'Beleza e estética', keywords: 'manicure pedicure unha unhas cabelo cabeleireira corte escova trança sobrancelha maquiagem depilacao barba barbeiro cilios' },
  { slug: 'aulas', name: 'Aulas particulares', keywords: 'aula aulas reforco escolar professor professora ingles matematica portugues violao musica redacao vestibular enem tarefa' },
  { slug: 'manutencao', name: 'Manutenção residencial', keywords: 'eletricista encanador chuveiro tomada torneira vazamento pintura pintor pedreiro reforma instalacao reparo conserto ventilador portao fechadura montagem moveis' },
  { slug: 'domesticos', name: 'Serviços domésticos', keywords: 'diarista faxina limpeza passadeira passar roupa lavar jardinagem jardineiro quintal organizacao' },
  { slug: 'cuidados', name: 'Cuidados', keywords: 'baba crianca criancas cuidador cuidadora idoso idosos acompanhante pet cachorro gato passeador banho tosa' },
  { slug: 'tecnologia', name: 'Informática e celulares', keywords: 'computador notebook formatacao formatar celular tela conserto internet wifi impressora programa' },
  { slug: 'artesanato', name: 'Artesanato e presentes', keywords: 'artesanato croche trico bordado presente lembrancinha personalizado sabonete vela decoracao' },
  { slug: 'fretes', name: 'Fretes e carretos', keywords: 'frete fretes carreto mudanca entrega transporte levar buscar' },
  { slug: 'outros', name: 'Outros', keywords: '' },
]
```

Cada categoria tem um identificador (`slug`, sem acento, usado no banco e na URL), um nome para exibição e uma lista de palavras associadas.
É isso que faz "meu chuveiro queimou" encontrar Manutenção residencial, ou "festa de aniversário" encontrar Alimentação, mesmo que nenhuma oferta tenha essas palavras exatas.

**Linhas 16 a 17**

```js
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug)
export const categoryName = (slug) => CATEGORIES.find((c) => c.slug === slug)?.name || slug
```

Lista só dos identificadores (para validar o que chega na API) e uma função que devolve o nome de exibição de um identificador.

**Linhas 19 a 25**

```js
// Categorias cujas palavras-chave aparecem nos termos buscados.
export function categoriesForTokens(tokens) {
  return CATEGORIES.filter((c) => {
    const words = c.keywords.split(' ')
    return tokens.some((t) => words.some((w) => w && (w.startsWith(t) || t.startsWith(w))))
  }).map((c) => c.slug)
}
```

`categoriesForTokens` devolve as categorias relacionadas às palavras buscadas. A comparação por prefixo nos dois sentidos aceita variações: "bolos" encontra "bolo", "conserto" encontra "consertar".

---

## `server/src/lib/http.js`

Utilitários das rotas: erro com código HTTP e validação de texto.

**Linhas 1 a 6**

```js
export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
```

Um erro que carrega o código HTTP (400, 403, 404...). O tratador de erros do `app.js` usa esse código na resposta.

**Linhas 8 a 10**

```js
export const fail = (status, message) => {
  throw new HttpError(status, message)
}
```

Atalho para interromper uma rota com erro: `fail(404, 'Oferta não encontrada')`.

**Linhas 12 a 17**

```js
export function str(value, { max = 500, required = false, name = 'campo' } = {}) {
  const s = typeof value === 'string' ? value.trim() : ''
  if (required && !s) fail(400, `Preencha o campo ${name}`)
  if (s.length > max) fail(400, `O campo ${name} aceita até ${max} caracteres`)
  return s
}
```

Valida campos de texto recebidos: aceita só texto (qualquer outra coisa vira vazio), tira espaços das pontas, exige preenchimento quando `required` e limita o tamanho.
O `name` deixa a mensagem de erro clara para o usuário ("Preencha o campo título").

---

## `server/src/lib/auth.js`

Autenticação (RF01): código de verificação, token de sessão e os "porteiros" que protegem as rotas.

**Linhas 1 a 6**

```js
// RF01: autenticação por telefone verificado (código de 6 dígitos) e sessão via JWT.
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { one } from '../db.js'
import { HttpError } from './http.js'
```

Importações: `crypto` para o código e o hash, `jsonwebtoken` para a sessão.

**Linhas 8 a 10**

```js
export function hashCode(phone, code) {
  return crypto.createHmac('sha256', config.jwtSecret).update(`${phone}:${code}`).digest('hex')
}
```

Calcula o HMAC-SHA256 de "telefone:código" com a chave secreta do servidor. O banco só guarda esse resultado: quem tiver acesso ao banco não descobre os códigos.
Incluir o telefone impede reaproveitar o hash de um número em outro.

**Linhas 12 a 14**

```js
export function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}
```

Sorteia um número de 0 a 999.999 com gerador seguro e completa com zeros à esquerda (`7` vira `000007`).

**Linhas 16 a 18**

```js
export function signToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '30d' })
}
```

Cria o token de sessão (JWT) com o id do usuário (`sub`), válido por 30 dias. O token é assinado: se alguém alterar o conteúdo, a assinatura deixa de bater.

**Linhas 20 a 29**

```js
export async function userFromToken(token) {
  try {
    const { sub } = jwt.verify(token, config.jwtSecret)
    const user = await one('SELECT * FROM users WHERE id = $1', [sub])
    if (!user || user.blocked) return null
    return user
  } catch {
    return null
  }
}
```

Confere a assinatura e a validade do token e busca o usuário. Devolve `null` se o token for inválido, se o usuário não existir mais ou se estiver bloqueado pela moderação.

**Linhas 31 a 36**

```js
// Preenche req.user quando há token válido; não bloqueia a requisição.
export async function loadUser(req, _res, next) {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) req.user = await userFromToken(header.slice(7))
  next()
}
```

`loadUser` roda antes de todas as rotas: lê o cabeçalho `Authorization: Bearer <token>` e, se for válido, coloca o usuário em `req.user`. Não bloqueia ninguém, porque várias rotas (como a busca) são públicas.

**Linhas 38 a 41**

```js
export function requireAuth(req, _res, next) {
  if (!req.user) throw new HttpError(401, 'Entre com seu telefone para continuar')
  next()
}
```

Porteiro das rotas que exigem login: sem usuário, responde 401 pedindo para entrar.

**Linhas 43 a 47**

```js
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) throw new HttpError(401, 'Entre com seu telefone para continuar')
  if (!roles.includes(req.user.role)) throw new HttpError(403, 'Seu perfil não tem acesso a esta área')
  next()
}
```

Porteiro por perfil, por exemplo `requireRole('moderador')`. É uma função que devolve outra função (*middleware*); responde 403 se o perfil não estiver na lista.

**Linhas 49 a 53**

```js
export function requireProvider(req, _res, next) {
  if (!req.user) throw new HttpError(401, 'Entre com seu telefone para continuar')
  if (!req.user.is_provider) throw new HttpError(403, 'Ative o perfil de prestador para usar esta função')
  next()
}
```

Porteiro das funções de prestador (publicar oferta, painel, destaque).

**Linhas 55 a 62**

```js
// Dados do usuário que podem ser vistos por terceiros: nunca telefone nem localização.
export function publicUser(u) {
  return { id: u.id, name: u.name, isProvider: u.is_provider, memberSince: u.created_at }
}

export function selfUser(u) {
  return { ...publicUser(u), phone: u.phone, role: u.role, bio: u.bio }
}
```

`publicUser` define o que terceiros podem ver de alguém: id, nome, se é prestador e desde quando. **Nunca telefone nem localização.**
`selfUser` acrescenta o telefone, o perfil e a apresentação, e só é usado para o próprio usuário.

---

## `server/src/lib/notify.js`

Notificações (RF17): gravadas no banco e enviadas na hora para quem estiver conectado.

**Linhas 1 a 3**

```js
// RF17: notificação gravada no banco e enviada em tempo real para o usuário conectado.
import { one, q } from '../db.js'
import { emitTo } from '../realtime.js'
```

Importações.

**Linhas 5 a 13**

```js
export async function notify(userId, { kind, title, body = '', link = '' }, tx = null) {
  const run = tx ? tx.query : q
  const { rows } = await run(
    'INSERT INTO notifications (user_id, kind, title, body, link) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [userId, kind, title, body, link],
  )
  emitTo(userId, 'notification', serializeNotification(rows[0]))
  return rows[0]
}
```

Grava a notificação e a envia pelo tempo real. O parâmetro `tx` permite gravar dentro de uma transação já aberta; sem ele, usa a consulta comum `q`.

**Linhas 15 a 17**

```js
export function serializeNotification(n) {
  return { id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, readAt: n.read_at, createdAt: n.created_at }
}
```

Converte a linha do banco (nomes com `_`) no formato enviado à interface (*camelCase*).

**Linhas 19 a 22**

```js
export async function unreadCount(userId) {
  const r = await one('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId])
  return r.n
}
```

Conta as notificações não lidas para o número no sino da barra superior.

---

## `server/src/lib/images.js`

Fotos das ofertas (RF02). O navegador já reduz a foto antes de enviar (ver `ImagePicker.jsx`); aqui o servidor valida e grava.

**Linhas 1 a 6**

```js
// RF02: imagens opcionais das ofertas, enviadas pelo navegador já redimensionadas (data URL).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from '../config.js'
import { fail } from './http.js'
```

Comentário e importações.

**Linhas 8 a 14**

```js
const MAX_IMAGES = 4
const MAX_BYTES = 1_500_000
const SIGNATURES = {
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8,
  png: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  webp: (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP',
}
```

Limites (4 fotos de até 1,5 MB) e as **assinaturas** de cada formato: os primeiros bytes de todo JPG, PNG e WEBP são sempre os mesmos.
Conferir os bytes, e não só a extensão do nome, impede enviar outro tipo de arquivo disfarçado de imagem.

**Linhas 16 a 19**

```js
export function saveImages(list) {
  if (!Array.isArray(list)) return []
  if (list.length > MAX_IMAGES) fail(400, `Envie no máximo ${MAX_IMAGES} imagens`)
  fs.mkdirSync(config.uploadsDir, { recursive: true })
```

Começa validando que é uma lista dentro do limite e garante que a pasta de destino existe.

**Linhas 20 a 33**

```js
  return list.map((item) => {
    if (typeof item !== 'string') fail(400, 'Imagem inválida')
    if (/^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(item)) return item
    const m = item.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/)
    if (!m) fail(400, 'Formato de imagem não suportado (use JPG, PNG ou WEBP)')
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
    const buf = Buffer.from(m[2], 'base64')
    if (buf.length > MAX_BYTES) fail(400, 'Imagem muito grande (máximo 1,5 MB)')
    if (!SIGNATURES[ext](buf)) fail(400, 'O arquivo enviado não é uma imagem válida')
    const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`
    fs.writeFileSync(path.join(config.uploadsDir, name), buf)
    return `/uploads/${name}`
  })
}
```

Para cada item:

- se for o endereço de uma foto já salva (formato exato, nome com 32 caracteres hexadecimais), mantém. Isso permite editar a oferta sem reenviar as fotos;
- senão, espera um *data URL* (`data:image/jpeg;base64,...`), que é a imagem codificada em texto;
- decodifica o base64 em bytes, confere o tamanho e a assinatura;
- grava com nome aleatório e devolve o endereço público `/uploads/<nome>`.

---

## `server/src/lib/offers.js`

Trechos de SQL e a serialização de ofertas, compartilhados entre as rotas de busca, de detalhe e do painel.

**Linhas 1 a 5**

```js
// Consultas e serialização de ofertas compartilhadas entre as rotas.
import { config } from '../config.js'
import { categoryName } from './categories.js'
import { approxDistance } from './geo.js'
import { normalize } from './text.js'
```

Importações.

**Linhas 7 a 16**

```js
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
```

`REPUTATION_JOIN` é um pedaço de SQL reaproveitado. O `LEFT JOIN LATERAL` executa, para cada prestador da consulta principal, três subconsultas:

- quantos serviços ele concluiu como prestador;
- a média das notas recebidas, arredondada em uma casa;
- quantas avaliações recebeu.

As avaliações só contam se ele era o **prestador** daquela contratação: notas recebidas quando ele contratou alguém não entram na reputação profissional.

**Linha 18**

```js
export const HIGHLIGHT_EXPR = `EXISTS (SELECT 1 FROM highlights h WHERE h.offer_id = o.id AND now() BETWEEN h.starts_at AND h.ends_at)`
```

Expressão SQL que diz se a oferta tem um plano de destaque vigente agora (RF13).

**Linhas 20 a 22**

```js
export function buildSearchText(offer) {
  return normalize(`${offer.title} ${offer.description} ${categoryName(offer.category)}`)
}
```

Monta o texto pesquisável da oferta (título, descrição e nome da categoria, normalizados).

**Linhas 24 a 26**

```js
export function needsConfirmation(confirmedAt) {
  return Date.now() - new Date(confirmedAt).getTime() > config.activity.askAfterDays * 86_400_000
}
```

Diz se a oferta passou de 30 dias sem confirmação (RF16).

**Linhas 28 a 58**

```js
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
```

`serializeOffer` transforma a linha do banco no formato da API. Este é o **único** ponto que monta ofertas para o navegador, e ele não tem como incluir coordenadas: só recebe a distância (`dist_m`), que já sai arredondada por `approxDistance`.

Também calcula `outsideServiceArea`, que avisa quando o morador está além do raio de atendimento do prestador, e só inclui os dados do prestador e a reputação quando a consulta os trouxe.

---
