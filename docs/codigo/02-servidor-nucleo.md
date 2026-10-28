# 2. Servidor: núcleo

Como o servidor nasce: `index.js` é o ponto de entrada, `config.js` lê as configurações, `db.js` escolhe e abre o banco,
`app.js` monta as rotas da API e a entrega da interface, `realtime.js` cuida do Socket.IO e `jobs.js` roda a rotina periódica do RF16.

## `server/src/config.js`

Centraliza as configurações. Todos os outros arquivos importam o objeto `config` daqui em vez de ler variáveis de ambiente espalhadas pelo código.

**Linhas 1 a 6**

```js
// Configuração central. Lê o arquivo .env da raiz (se existir) sem dependências externas,
// para funcionar igual no Windows, Linux e macOS.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
```

Importações do próprio Node: `fs` (arquivos), `path` (caminhos, com a barra certa para cada sistema), `crypto` (números aleatórios seguros) e `fileURLToPath` (converte o endereço do módulo em caminho de arquivo).

**Linha 8**

```js
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
```

Descobre a pasta raiz do projeto subindo dois níveis a partir deste arquivo (`server/src` até a raiz). Assim o sistema funciona de qualquer pasta, inclusive com espaços ou acentos no caminho do Windows.

**Linhas 10 a 20**

```js
const envFile = path.join(ROOT, '.env')
if (fs.existsSync(envFile)) {
  for (const raw of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    const key = line.slice(0, i).trim()
    const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}
```

Leitor do arquivo `.env` sem biblioteca externa. Para cada linha:

- `split(/\r?\n/)` separa as linhas aceitando quebra do Windows (`\r\n`) ou do Linux (`\n`);
- ignora linhas vazias, comentários (`#`) e linhas sem `=`;
- separa chave e valor no primeiro `=` e tira aspas em volta do valor;
- só define a variável se ela ainda não existir, para uma variável definida no terminal ter prioridade sobre o arquivo.

**Linhas 22 a 32**

```js
// Segredo do JWT: se não for definido, gera um e guarda em server/data para sobreviver a reinícios.
function resolveSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  const dir = path.join(ROOT, 'server', 'data')
  const file = path.join(dir, '.jwt-secret')
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim()
  fs.mkdirSync(dir, { recursive: true })
  const secret = crypto.randomBytes(48).toString('hex')
  fs.writeFileSync(file, secret)
  return secret
}
```

`resolveSecret` devolve a chave que assina os tokens de sessão. Usa `JWT_SECRET` se existir; senão, lê ou cria `server/data/.jwt-secret` com 48 bytes aleatórios.
Gravar a chave em arquivo faz os usuários continuarem logados depois que o servidor reinicia.

**Linhas 34 a 40**

```js
export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL || '',
  pgliteDir: process.env.PGLITE_DIR || path.join(ROOT, 'server', 'data', 'pglite'),
  uploadsDir: path.join(ROOT, 'server', 'data', 'uploads'),
  webDist: path.join(ROOT, 'web', 'dist'),
```

Porta, endereço de escuta (`0.0.0.0` aceita conexões de outros aparelhos da rede), URL do banco externo, pasta do banco embutido, pasta das imagens enviadas e pasta da interface compilada.

**Linha 41**

```js
  jwtSecret: process.env.NODE_ENV === 'test' ? 'test-secret' : resolveSecret(),
```

Nos testes (`NODE_ENV=test`) usa uma chave fixa, para não criar arquivos durante os testes.

**Linhas 42 a 44**

```js
  // "dev": o código de verificação aparece na tela e no terminal (não há envio de SMS real).
  smsMode: process.env.SMS_MODE || 'dev',
  commissionRate: 0.06,
```

Modo do SMS e taxa de comissão do RF10 (6%), num lugar só para facilitar mudanças.

**Linhas 45 a 50**

```js
  // Centro do bairro piloto usado quando o usuário não compartilha a localização.
  pilot: {
    name: process.env.PILOT_NAME || 'Bairro piloto - Sorocaba/SP',
    lat: Number(process.env.PILOT_LAT || -23.4806),
    lng: Number(process.env.PILOT_LNG || -47.4205),
  },
```

Ponto padrão de busca quando o morador não compartilha a localização. `Number(...)` converte o texto do `.env` em número.

**Linhas 51 a 53**

```js
  // Dias sem confirmação até a oferta pedir confirmação e até sair da busca (RF16).
  activity: { askAfterDays: 30, hideAfterDays: 45 },
}
```

Prazos do RF16: aos 30 dias sem confirmação o prestador é avisado; aos 45 a oferta deixa de aparecer na busca.

---

## `server/src/db.js`

Camada de acesso ao banco. Expõe sempre a mesma interface (`query`, `exec`, `transaction`, `close`) para os dois modos, de modo que o resto do sistema não precisa saber qual banco está em uso.

**Linhas 1 a 10**

```js
// Camada de banco. Dois modos com o mesmo SQL:
//  - DATABASE_URL definida: PostgreSQL + PostGIS real (ex.: docker compose)
//  - sem DATABASE_URL: PGlite (PostgreSQL em WebAssembly) com PostGIS embutido,
//    gravado em server/data/pglite. Não exige instalar nada além do Node.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'

const schemaSql = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'schema.sql'), 'utf8')
```

Comentário explicando os dois modos. Importações e leitura do arquivo `schema.sql`, que fica na mesma pasta.

**Linha 12**

```js
let impl = null
```

Guarda a conexão aberta (padrão *singleton*): o banco é aberto uma vez e reaproveitado.

**Linhas 14 a 15**

```js
export async function initDb({ memory = false } = {}) {
  if (impl) return impl
```

Abre o banco. O parâmetro `memory` é usado pelos testes para criar um banco temporário só na memória.

**Linhas 16 a 20**

```js
  if (config.databaseUrl && !memory) {
    const { default: pg } = await import('pg')
    pg.types.setTypeParser(20, Number) // bigint -> number
    pg.types.setTypeParser(1700, Number) // numeric -> number
    const pool = new pg.Pool({ connectionString: config.databaseUrl })
```

**Modo PostgreSQL**: importa o `pg` só quando necessário (`await import`), para quem usa o banco embutido não depender dele.
Os `setTypeParser` fazem números grandes (`bigint`) e decimais (`numeric`) virem números JavaScript, e não texto, igualando o comportamento ao do PGlite.
O `Pool` mantém várias conexões abertas para atender requisições em paralelo.

**Linhas 21 a 40**

```js
    impl = {
      kind: 'postgres',
      query: (sql, params) => pool.query(sql, params),
      exec: (sql) => pool.query(sql),
      async transaction(fn) {
        const client = await pool.connect()
        try {
          await client.query('BEGIN')
          const result = await fn({ query: (s, p) => client.query(s, p) })
          await client.query('COMMIT')
          return result
        } catch (err) {
          await client.query('ROLLBACK')
          throw err
        } finally {
          client.release()
        }
      },
      close: () => pool.end(),
    }
```

`query` e `exec` repassam para o pool. A `transaction` pega uma conexão exclusiva, executa `BEGIN`, roda a função recebida e faz `COMMIT`;
se algo der errado, faz `ROLLBACK` e nada fica gravado pela metade. O `finally` devolve a conexão ao pool em qualquer caso.

**Linhas 41 a 53**

```js
  } else {
    const { PGlite } = await import('@electric-sql/pglite')
    const { postgis } = await import('@electric-sql/pglite-postgis')
    if (!memory) fs.mkdirSync(config.pgliteDir, { recursive: true })
    const db = await PGlite.create(memory ? undefined : config.pgliteDir, { extensions: { postgis } })
    impl = {
      kind: memory ? 'pglite-memory' : 'pglite',
      query: (sql, params) => db.query(sql, params),
      exec: (sql) => db.exec(sql),
      transaction: (fn) => db.transaction((tx) => fn({ query: (s, p) => tx.query(s, p) })),
      close: () => db.close(),
    }
  }
```

**Modo PGlite**: carrega o PostgreSQL em WebAssembly com a extensão PostGIS e grava os dados na pasta `server/data/pglite` (ou só em memória nos testes).
O PGlite já tem transação própria; aqui ela só é adaptada para o mesmo formato do modo PostgreSQL.

**Linhas 54 a 56**

```js
  await impl.exec(schemaSql)
  return impl
}
```

Executa o `schema.sql` a cada inicialização. Ele usa `CREATE ... IF NOT EXISTS`, então só cria o que falta.

**Linhas 58 a 61**

```js
export function db() {
  if (!impl) throw new Error('Banco não inicializado')
  return impl
}
```

Devolve o banco aberto, ou avisa claramente se alguém tentar usar antes de abrir.

**Linhas 63 a 66**

```js
export async function closeDb() {
  if (impl) await impl.close()
  impl = null
}
```

Fecha o banco (usado no encerramento e nos testes).

**Linhas 68 a 70**

```js
export const q = (sql, params = []) => db().query(sql, params)
export const one = async (sql, params = []) => (await q(sql, params)).rows[0] || null
export const many = async (sql, params = []) => (await q(sql, params)).rows
```

Atalhos usados em todo o servidor: `q` executa e devolve o resultado completo, `one` devolve a primeira linha (ou `null`) e `many` devolve todas as linhas.
O `$1`, `$2` nas consultas são **parâmetros**: o valor vai separado do SQL, o que impede injeção de SQL.

---

## `server/src/index.js`

Ponto de entrada (`npm start`). Abre o banco, cria os dados de demonstração se o banco estiver vazio, sobe o servidor HTTP com o tempo real e mostra no terminal os endereços de acesso.

**Linhas 1 a 9**

```js
// Ponto de entrada: inicia banco, API, interface web e tempo real na mesma porta.
import http from 'node:http'
import os from 'node:os'
import { createApp } from './app.js'
import { config } from './config.js'
import { initDb, many } from './db.js'
import { scheduleJobs } from './jobs.js'
import { attachRealtime } from './realtime.js'
import { seedIfEmpty } from './seed.js'
```

Importações: o servidor HTTP nativo, `os` (para descobrir os IPs da máquina) e os módulos do próprio projeto.

**Linhas 11 a 15**

```js
const started = Date.now()
console.log('Iniciando o ConectaBairro...')
const db = await initDb()
console.log(`Banco: ${db.kind === 'postgres' ? 'PostgreSQL + PostGIS (DATABASE_URL)' : `PGlite embutido em ${config.pgliteDir}`}`)
await seedIfEmpty()
```

Marca o horário de início para mostrar quanto tempo a inicialização levou. O `await` no nível do módulo é permitido em módulos ES.
Abre o banco, mostra qual modo está em uso e roda o seed se for a primeira vez.

**Linhas 17 a 20**

```js
const app = createApp()
const server = http.createServer(app)
attachRealtime(server)
scheduleJobs()
```

Cria o aplicativo Express e o servidor HTTP, liga o Socket.IO no mesmo servidor (mesma porta) e agenda a rotina do RF16.

**Linhas 22 a 28**

```js
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nA porta ${config.port} já está em uso. Feche o outro programa ou defina outra porta no arquivo .env (PORT=3001).`)
    process.exit(1)
  }
  throw err
})
```

Trata o erro mais comum ao rodar no Windows: a porta já está em uso (por exemplo, o sistema já aberto em outra janela). Mostra como resolver em vez de um erro técnico.

**Linha 30**

```js
server.listen(config.port, config.host, async () => {
```

Começa a aceitar conexões. O código seguinte só roda quando o servidor está pronto.

**Linhas 31 a 37**

```js
  // Endereços para abrir em outros aparelhos da mesma rede (ignora interfaces virtuais: Docker, WSL, VirtualBox).
  const virtual = /docker|^br-|veth|virbr|vethernet|virtualbox|vmware|wsl|tailscale|zerotier|^zt|^tun|^tap/i
  const lan = Object.entries(os.networkInterfaces())
    .filter(([name]) => !virtual.test(name))
    .flatMap(([, list]) => list || [])
    .filter((i) => i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${config.port}`)
```

Lista os IPs da máquina que outros aparelhos podem usar. Ignora interfaces virtuais (Docker, WSL, VirtualBox, VPNs), que confundiriam quem está apresentando, e fica só com IPv4 não internos.

**Linha 38**

```js
  const demo = await many("SELECT name, phone, role FROM users WHERE phone LIKE '+551590000%' ORDER BY phone")
```

Busca as contas de demonstração (telefones que começam com `+551590000`) para listar no terminal.

**Linhas 39 a 41**

```js
  console.log(`\nConectaBairro pronto em ${((Date.now() - started) / 1000).toFixed(1)} s`)
  console.log(`  Neste computador:   http://localhost:${config.port}`)
  for (const url of lan) console.log(`  Na rede local:      ${url}`)
```

Mostra o tempo de inicialização, o endereço local e os da rede.

**Linhas 42 a 50**

```js
  if (config.smsMode === 'dev') {
    console.log('\nModo demonstração: o código de verificação aparece na própria tela de login.')
    if (demo.length) {
      console.log('Contas de demonstração (entre com o celular):')
      for (const u of demo) console.log(`  ${u.phone.replace('+55', '').replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')}  ${u.name} [${u.role}]`)
    }
  }
  console.log('\nPara encerrar, pressione Ctrl+C.')
})
```

No modo demonstração, lista as contas com o celular formatado. A expressão regular transforma `15900000001` em `(15) 90000-0001`.

**Linhas 52 a 59**

```js
const shutdown = async () => {
  server.close()
  const { closeDb } = await import('./db.js')
  await closeDb().catch(() => {})
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
```

Encerramento organizado ao receber `Ctrl+C`: para de aceitar conexões e fecha o banco, evitando corromper os dados do PGlite.

---

## `server/src/app.js`

Monta o aplicativo Express. Fica separado do `index.js` para os testes criarem o aplicativo sem abrir a porta 3000.

**Linhas 1 a 15**

```js
// Monta a aplicação Express (separado do index.js para os testes usarem sem abrir porta).
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { config } from './config.js'
import { loadUser } from './lib/auth.js'
import authRoutes from './routes/auth.js'
import conversationRoutes from './routes/conversations.js'
import fieldRoutes from './routes/field.js'
import institutionRoutes from './routes/institution.js'
import metaRoutes from './routes/meta.js'
import moderationRoutes from './routes/moderation.js'
import notificationRoutes from './routes/notifications.js'
import offerRoutes from './routes/offers.js'
import providerRoutes from './routes/provider.js'
```

Importa o Express, a configuração, o carregador de usuário e todos os grupos de rotas.

**Linhas 17 a 20**

```js
export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback')
```

- `disable('x-powered-by')` não anuncia que o servidor é Express.
- `trust proxy` para `loopback` faz o Express confiar no IP repassado só quando há um proxy na própria máquina.

**Linhas 21 a 26**

```js
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'same-origin')
    res.setHeader('X-Frame-Options', 'DENY')
    next()
  })
```

Cabeçalhos de segurança em todas as respostas: impedem o navegador de adivinhar o tipo de arquivo, limitam o envio do endereço de origem e proíbem que o site seja exibido dentro de outro site (proteção contra *clickjacking*).

**Linha 27**

```js
  app.use(express.json({ limit: '8mb' }))
```

Interpreta corpos JSON. O limite de 8 MB comporta até quatro fotos já reduzidas pelo navegador.

**Linhas 29 a 35**

```js
  const api = express.Router()
  api.use(loadUser)
  for (const routes of [metaRoutes, authRoutes, offerRoutes, conversationRoutes, providerRoutes, notificationRoutes, moderationRoutes, fieldRoutes, institutionRoutes]) {
    api.use(routes)
  }
  api.use((_req, _res, next) => next(Object.assign(new Error('Rota não encontrada'), { status: 404 })))
  app.use('/api', api)
```

Agrupa todas as rotas da API sob `/api`. O `loadUser` roda antes de todas e identifica o usuário pelo token, se houver.
Rotas `/api` inexistentes devolvem 404 em JSON.

**Linhas 37 a 38**

```js
  fs.mkdirSync(config.uploadsDir, { recursive: true })
  app.use('/uploads', express.static(config.uploadsDir, { maxAge: '30d', immutable: true }))
```

Serve as fotos enviadas em `/uploads`. Como cada arquivo tem nome aleatório e nunca muda, o navegador pode guardá-lo por 30 dias (`immutable`).

**Linhas 40 a 48**

```js
  // Interface web compilada (npm run build). Rotas desconhecidas caem no index.html (SPA).
  if (fs.existsSync(path.join(config.webDist, 'index.html'))) {
    app.use(express.static(config.webDist, { index: false, maxAge: '1h' }))
    app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => res.sendFile(path.join(config.webDist, 'index.html')))
  } else {
    app.get('/', (_req, res) =>
      res.type('text').send('API do ConectaBairro no ar. A interface ainda não foi compilada: rode "npm run build" ou use "npm run dev".'),
    )
  }
```

Se a interface estiver compilada, entrega os arquivos de `web/dist`. Qualquer outro endereço que não seja da API devolve o `index.html`: é o React que decide qual tela mostrar (aplicação de página única, SPA).
Sem a interface compilada, mostra uma mensagem orientando a rodar o build.

**Linhas 50 a 56**

```js
  app.use((err, _req, res, _next) => {
    const status = err.status || (err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : 500)
    if (status >= 500) console.error(err)
    res.status(status).json({ error: status >= 500 ? 'Erro interno. Tente novamente.' : err.message })
  })
  return app
}
```

Tratador de erros central. Erros com `status` (os `fail(...)` das rotas) mostram a mensagem ao usuário. Erros inesperados aparecem no terminal, mas o usuário recebe só "Erro interno", para não expor detalhes técnicos.
O Express 5 encaminha para cá também os erros de funções `async`, por isso as rotas não precisam de `try/catch`.

---

## `server/src/realtime.js`

Comunicação em tempo real com Socket.IO: mensagens do chat, mudanças na contratação e notificações chegam sem recarregar a página.

**Linhas 1 a 5**

```js
// Comunicação em tempo real (chat, notificações). Cada usuário entra na sala "user:<id>".
import { Server } from 'socket.io'
import { userFromToken } from './lib/auth.js'

let io = null
```

Importações e a variável que guarda o servidor Socket.IO.

**Linhas 7 a 14**

```js
export function attachRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: true } })
  io.use(async (socket, next) => {
    const user = await userFromToken(socket.handshake.auth?.token || '')
    if (!user) return next(new Error('não autenticado'))
    socket.data.userId = user.id
    next()
  })
```

Liga o Socket.IO ao servidor HTTP. O `io.use` é um filtro que roda na conexão: confere o token enviado pelo navegador e recusa quem não estiver logado.

**Linhas 15 a 19**

```js
  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`)
  })
  return io
}
```

Cada usuário conectado entra numa "sala" com o próprio id. Assim o servidor envia um evento a uma pessoa específica, em todas as abas e aparelhos dela.

**Linhas 21 a 23**

```js
export function emitTo(userId, event, payload) {
  if (io) io.to(`user:${userId}`).emit(event, payload)
}
```

Envia um evento para a sala de um usuário. Se o tempo real não estiver ligado (nos testes), não faz nada.

---

## `server/src/jobs.js`

Rotina periódica do RF16 (confirmação de atividade).

**Linhas 1 a 5**

```js
// RF16: pede periodicamente a confirmação de que a oferta continua ativa.
// Depois de 30 dias sem confirmação o prestador é avisado; depois de 45 a oferta sai da busca.
import { config } from './config.js'
import { many, q } from './db.js'
import { notify } from './lib/notify.js'
```

Comentário e importações.

**Linhas 7 a 14**

```js
export async function runActivityCheck() {
  const stale = await many(
    `SELECT o.id, o.title, o.provider_id FROM offers o
      WHERE o.status = 'ativa'
        AND o.confirmed_at < now() - make_interval(days => $1::int)
        AND (o.confirm_notified_at IS NULL OR o.confirm_notified_at < now() - interval '7 days')`,
    [config.activity.askAfterDays],
  )
```

Busca ofertas ativas confirmadas há mais de 30 dias que ainda não receberam aviso, ou cujo último aviso tem mais de 7 dias (para não mandar aviso todo dia).
`make_interval(days => $1)` monta o intervalo de tempo a partir do parâmetro.

**Linhas 15 a 25**

```js
  for (const o of stale) {
    await notify(o.provider_id, {
      kind: 'confirmacao',
      title: 'Sua oferta continua ativa?',
      body: `Confirme "${o.title}" para que ela continue aparecendo para os vizinhos.`,
      link: '/painel',
    })
    await q('UPDATE offers SET confirm_notified_at = now() WHERE id = $1', [o.id])
  }
  return stale.length
}
```

Para cada oferta encontrada, notifica o prestador com um link para o painel e marca a data do aviso.

**Linhas 27 a 31**

```js
export function scheduleJobs() {
  const run = () => runActivityCheck().catch((err) => console.error('[rotina de atividade]', err.message))
  setTimeout(run, 5_000)
  return setInterval(run, 6 * 60 * 60 * 1000)
}
```

Roda a verificação 5 segundos depois de iniciar e depois a cada 6 horas. Um erro aqui só aparece no terminal e não derruba o servidor.

---
