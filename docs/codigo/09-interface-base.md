# 9. Interface web: base

A interface é uma aplicação React de página única: o navegador baixa o aplicativo uma vez e troca de tela sem recarregar.
Conceitos de React usados nos arquivos seguintes:

- **componente**: função que devolve o que deve aparecer na tela, escrito em JSX (parecido com HTML dentro do JavaScript);
- **`useState`**: guarda um valor que, quando muda, faz o componente ser desenhado de novo;
- **`useEffect`**: executa algo depois de desenhar (buscar dados, ligar um evento). A função que ele devolve é a "limpeza", executada ao sair da tela;
- **`useCallback` / `useMemo`**: guardam uma função ou valor entre os desenhos, para não recriar à toa;
- **contexto**: compartilha dados (como o usuário logado) com todos os componentes sem passá-los de um em um.

## `web/index.html`

A única página HTML. O React desenha tudo dentro da `div` com id `root`.

**Linhas 1 a 11**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="theme-color" content="#1c4b86" />
    <meta name="description" content="Serviços e comércio do seu bairro, sem expor o endereço de ninguém." />
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <title>ConectaBairro</title>
  </head>
```

Idioma português, codificação UTF-8 e o `viewport`, que faz o layout se adaptar à largura do celular (`viewport-fit=cover` aproveita a área das bordas arredondadas dos celulares modernos).
`theme-color` pinta a barra do navegador no celular com o azul do sistema. Ícones da aba e da tela inicial do iPhone.

**Linhas 12 a 16**

```html
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

O ponto de montagem do React e o arquivo JavaScript de entrada.

---

## `web/vite.config.js`

Configuração do Vite, que compila a interface (`npm run build`) e serve o modo desenvolvimento (`npm run dev`).

**Linhas 1 a 7**

```js
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const root = fileURLToPath(new URL('.', import.meta.url))
const api = `http://localhost:${process.env.PORT || 3000}`
```

Importações e o endereço da API usado no modo desenvolvimento.

**Linhas 9 a 12**

```js
export default defineConfig({
  root,
  plugins: [
    react(),
```

`root` aponta para a pasta `web`. O plugin `react` entende JSX.

**Linhas 13 a 31**

```js
    // Aplicação web progressiva: instalável e com a interface disponível sem conexão.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'ConectaBairro',
        short_name: 'ConectaBairro',
        description: 'Serviços e comércio do seu bairro, sem expor o endereço de ninguém.',
        lang: 'pt-BR',
        theme_color: '#1c4b86',
        background_color: '#f4f1ea',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
```

**PWA**: o que torna o site instalável como aplicativo.

- `registerType: 'autoUpdate'`: quando sai uma versão nova, o aplicativo se atualiza sozinho;
- `manifest`: nome, cores, ícones e `display: 'standalone'` (abre sem a barra de endereço, como aplicativo).

**Linhas 32 a 55**

```js
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/socket\.io\//],
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/api/meta',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'meta' },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/uploads/'),
            handler: 'CacheFirst',
            options: { cacheName: 'imagens', expiration: { maxEntries: 200, maxAgeSeconds: 30 * 86400 } },
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('tile.openstreetmap.org'),
            handler: 'CacheFirst',
            options: { cacheName: 'mapa', expiration: { maxEntries: 400, maxAgeSeconds: 14 * 86400 } },
          },
        ],
      },
    }),
  ],
```

O *service worker* (programa que o navegador mantém em segundo plano) gerado pelo Workbox:

- guarda a interface inteira no aparelho (`globPatterns`), então ela abre mesmo sem internet. É isso que permite o cadastro de campo offline (RF18);
- navegações caem no `index.html`, exceto API, fotos e tempo real (`navigateFallbackDenylist`);
- `runtimeCaching`: os metadados ficam salvos e são atualizados em segundo plano; as fotos e os blocos do mapa ficam guardados por 30 e 14 dias, economizando dados móveis.

**Linhas 56 a 66**

```js
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': api,
      '/uploads': api,
      '/socket.io': { target: api, ws: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 900 },
})
```

Modo desenvolvimento: porta 5173, acessível pela rede (`host: true`), repassando `/api`, `/uploads` e o tempo real (`ws: true`, WebSocket) para o servidor na porta 3000.
O `build` gera a pasta `dist` e eleva o limite do aviso de tamanho (o mapa e o React juntos passam do padrão).

---

## `web/src/main.jsx`

Entrada da interface: define as telas (rotas) e quem pode acessar cada uma.

**Linhas 1 a 26**

```jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { Layout } from './components/Layout.jsx'
import { Loading } from './components/ui.jsx'
import Chat from './pages/Chat.jsx'
import Contracts from './pages/Contracts.jsx'
import Conversations from './pages/Conversations.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Field from './pages/Field.jsx'
import Home from './pages/Home.jsx'
import Institution from './pages/Institution.jsx'
import Login from './pages/Login.jsx'
import Moderation from './pages/Moderation.jsx'
import NotFound from './pages/NotFound.jsx'
import Notifications from './pages/Notifications.jsx'
import OfferDetail from './pages/OfferDetail.jsx'
import OfferForm from './pages/OfferForm.jsx'
import Profile from './pages/Profile.jsx'
import ProviderProfile from './pages/ProviderProfile.jsx'
import Receipt from './pages/Receipt.jsx'
import { SessionProvider, useSession } from './session.jsx'
import '@fontsource-variable/figtree'
import '@fontsource-variable/bricolage-grotesque'
import './styles.css'
```

Importa as telas, o layout, a sessão e o CSS global.

**Linhas 28 a 30**

```jsx
// Quando sai uma versão nova, o service worker troca a antiga e a página recarrega sozinha.
// Sem isso o navegador seguia mostrando a interface guardada até alguém recarregar na mão.
registerSW({ immediate: true })
```

**Atualização automática.** O service worker guarda a interface no aparelho para ela abrir sem internet. O lado ruim: depois de uma versão nova, o navegador continuava mostrando a antiga até alguém recarregar na mão (foi assim que a versão verde do começo do projeto seguiu aparecendo depois da troca de cores).
`registerSW({ immediate: true })` registra o service worker já na abertura; quando ele percebe uma versão nova, ela assume o lugar da antiga e a página recarrega sozinha uma vez.

**Linhas 32 a 39**

```jsx
function Private({ children, provider, roles }) {
  const { user } = useSession()
  const location = useLocation()
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  if (provider && !user.isProvider) return <Navigate to="/perfil" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}
```

**Porteiro das telas.** Sem login, manda para "Entrar", lembrando de onde a pessoa veio (`state.from`) para voltar depois do login. Telas de prestador exigem o perfil de prestador; telas de equipe exigem o perfil certo.
Isso é só conveniência de navegação: a proteção de verdade está no servidor, que recusa qualquer acesso indevido.

**Linhas 41 a 56**

```jsx
function App() {
  const { ready, meta } = useSession()
  if (!ready) return <Loading label="Abrindo..." />
  if (!meta) {
    return (
      <div className="login">
        <div className="card center">
          <h2>Não consegui falar com o servidor</h2>
          <p className="muted">Confere se a janela do ConectaBairro está aberta no computador e tenta de novo.</p>
          <button className="btn" onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
        </div>
      </div>
    )
  }
```

Enquanto a sessão carrega, mostra "Abrindo...". Se não conseguiu falar com o servidor, mostra uma tela com botão para tentar de novo.

**Linhas 57 a 79**

```jsx
  return (
    <Routes>
      <Route path="/entrar" element={<Login />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="oferta/:id" element={<OfferDetail />} />
        <Route path="prestador/:id" element={<ProviderProfile />} />
        <Route path="conversas" element={<Private><Conversations /></Private>} />
        <Route path="conversas/:id" element={<Private><Chat /></Private>} />
        <Route path="contratacoes" element={<Private><Contracts /></Private>} />
        <Route path="comprovante/:id" element={<Private><Receipt /></Private>} />
        <Route path="notificacoes" element={<Private><Notifications /></Private>} />
        <Route path="perfil" element={<Private><Profile /></Private>} />
        <Route path="painel" element={<Private provider><Dashboard /></Private>} />
        <Route path="painel/ofertas/:id" element={<Private provider><OfferForm /></Private>} />
        <Route path="campo" element={<Private roles={['agente', 'moderador']}><Field /></Private>} />
        <Route path="moderacao" element={<Private roles={['moderador']}><Moderation /></Private>} />
        <Route path="indicadores" element={<Private roles={['instituicao', 'moderador']}><Institution /></Private>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
```

A tabela de rotas. "Entrar" fica fora do layout (tela cheia); as demais ficam dentro do `Layout` (barra superior e navegação inferior). Telas públicas: início, oferta e perfil do prestador. As outras passam pelo `Private`. O `*` final é a página não encontrada.

**Linhas 81 a 89**

```jsx
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

Monta o aplicativo: `StrictMode` ativa verificações extras do React, `BrowserRouter` cuida dos endereços e `SessionProvider` disponibiliza a sessão para todas as telas.

---

## `web/src/api.js`

Todas as chamadas da interface ao servidor passam por aqui.

**Linhas 1 a 19**

```js
// Cliente HTTP da API. O token de sessão fica no localStorage deste navegador.
const TOKEN_KEY = 'cb.token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* navegação privada */
  }
}
```

O token de sessão fica no `localStorage` (armazenamento do navegador, por site). Leitura e gravação ficam em `try/catch` porque, em janelas anônimas de alguns navegadores, o `localStorage` pode falhar.

**Linhas 21 a 26**

```js
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}
```

Erro com o código HTTP, para as telas tratarem casos específicos (por exemplo, código 0 é "sem conexão").

**Linhas 28 a 44**

```js
export async function api(path, { method = 'GET', body, signal } = {}) {
  const token = getToken()
  let res
  try {
    res = await fetch(`/api${path}`, {
      method,
      signal,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(0, 'Sem conexão. Confere a internet e tenta de novo.')
  }
```

Função única de chamada: monta o endereço `/api...`, envia o token no cabeçalho `Authorization` e o corpo em JSON.
Falha de rede vira a mensagem "Sem conexão. Confere a internet e tenta de novo". Cancelamentos (`AbortError`, quando a pessoa digita de novo na busca) são repassados sem mensagem.

**Linhas 45 a 54**

```js
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && token) {
      setToken(null)
      window.dispatchEvent(new Event('cb:logout'))
    }
    throw new ApiError(res.status, data.error || 'Deu algo errado. Tenta de novo.')
  }
  return data
}
```

Se o servidor recusar a sessão (401), apaga o token e avisa o restante da interface com o evento `cb:logout`. Qualquer erro vira `ApiError` com a mensagem do servidor, já pronta para mostrar ao usuário.

**Linhas 56 a 57**

```js
export const qs = (params) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()
```

Monta a parte `?a=1&b=2` da URL, ignorando valores vazios.

---

## `web/src/session.jsx`

Estado global da interface: usuário logado, localização do prestador, metadados, notificações, avisos rápidos (*toast*) e a conexão em tempo real.

**Linhas 1 a 6**

```jsx
// Estado global: usuário logado, metadados da plataforma, notificações e conexão em tempo real.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { api, getToken, setToken } from './api.js'

const SessionContext = createContext(null)
```

Importações e criação do contexto.

**Linhas 8 a 16**

```jsx
export function SessionProvider({ children }) {
  const [user, setUser] = useState(null)
  const [location, setLocation] = useState({ hasLocation: false })
  const [meta, setMeta] = useState(null)
  const [ready, setReady] = useState(false)
  const [unread, setUnread] = useState(0)
  const [toast, setToast] = useState(null)
  const socketRef = useRef(null)
  const listeners = useRef(new Set())
```

Os estados globais. `socketRef` guarda a conexão de tempo real e `listeners` as telas interessadas nos eventos (um `Set`, conjunto sem repetição).

**Linhas 18 a 20**

```jsx
  const showToast = useCallback((message, kind = 'info') => {
    setToast({ message, kind, id: Date.now() })
  }, [])
```

Mostra um aviso rápido na parte de baixo da tela (o `Layout` o esconde depois de alguns segundos).

**Linhas 22 a 35**

```jsx
  const refreshMe = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      return null
    }
    try {
      const data = await api('/me')
      setUser(data.user)
      setLocation(data.location)
      return data.user
    } catch {
      return null
    }
  }, [])
```

Recarrega os dados do usuário a partir do token. Sem token, não há usuário.

**Linhas 37 a 44**

```jsx
  const refreshUnread = useCallback(async () => {
    if (!getToken()) return
    try {
      setUnread((await api('/notifications/unread-count')).unread)
    } catch {
      /* offline */
    }
  }, [])
```

Atualiza o número de notificações não lidas. Se estiver offline, mantém o número atual.

**Linhas 46 a 61**

```jsx
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [m] = await Promise.all([api('/meta').catch(() => null), refreshMe()])
      if (!cancelled) {
        setMeta(m)
        setReady(true)
      }
    })()
    const onLogout = () => setUser(null)
    window.addEventListener('cb:logout', onLogout)
    return () => {
      cancelled = true
      window.removeEventListener('cb:logout', onLogout)
    }
  }, [refreshMe])
```

Ao abrir o aplicativo, busca os metadados e o usuário ao mesmo tempo. A variável `cancelled` evita atualizar a tela se ela já tiver sido fechada. Também escuta o evento de logout disparado pelo `api.js`.

**Linhas 63 a 68**

```jsx
  // Conexão em tempo real enquanto houver usuário logado.
  useEffect(() => {
    if (!user) return undefined
    refreshUnread()
    const socket = io({ auth: { token: getToken() }, transports: ['websocket', 'polling'] })
    socketRef.current = socket
```

**Tempo real.** Só com usuário logado: abre a conexão Socket.IO enviando o token (o servidor recusa sem ele).

**Linhas 69 a 81**

```jsx
    socket.on('notification', (n) => {
      setUnread((u) => u + 1)
      const onChatPage = window.location.pathname === n.link
      if (!onChatPage) showToast(n.title + (n.body ? `: ${n.body}` : ''))
      // Notificação do sistema quando a aba está em segundo plano (RF17).
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(n.title, { body: n.body, icon: '/icon-192.png', tag: n.link || String(n.id) })
        } catch {
          /* alguns navegadores só permitem via service worker */
        }
      }
    })
```

Ao chegar uma notificação: soma no sino e mostra um aviso, a menos que a pessoa já esteja na tela da conversa. Se a aba estiver em segundo plano e a permissão tiver sido dada, mostra também a notificação do sistema operacional (RF17).

**Linhas 82 a 90**

```jsx
    for (const ev of ['message', 'contract']) {
      socket.on(ev, (payload) => listeners.current.forEach((fn) => fn(ev, payload)))
    }
    socket.on('connect', refreshUnread)
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [user?.id, refreshUnread, showToast])
```

Repassa mensagens e mudanças de contratação para as telas inscritas (chat, lista de conversas, contratações). Ao (re)conectar, atualiza o número de não lidas.
A limpeza fecha a conexão quando a pessoa sai da conta.

**Linhas 92 a 95**

```jsx
  const subscribe = useCallback((fn) => {
    listeners.current.add(fn)
    return () => listeners.current.delete(fn)
  }, [])
```

Inscreve uma tela nos eventos e devolve a função que cancela a inscrição.

**Linhas 97 a 109**

```jsx
  const login = useCallback(
    async (token) => {
      setToken(token)
      await refreshMe()
    },
    [refreshMe],
  )

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setUnread(0)
  }, [])
```

`login` guarda o token e carrega o usuário; `logout` apaga tudo.

**Linhas 111 a 116**

```jsx
  const value = useMemo(
    () => ({ user, setUser, location, setLocation, meta, ready, unread, setUnread, refreshUnread, refreshMe, login, logout, subscribe, toast, showToast, setToast }),
    [user, location, meta, ready, unread, refreshUnread, refreshMe, login, logout, subscribe, toast, showToast],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
```

O pacote de dados e funções disponibilizado para todas as telas. O `useMemo` evita redesenhar o aplicativo inteiro sem necessidade.

**Linhas 118 a 130**

```jsx
export const useSession = () => useContext(SessionContext)

export function useRealtime(handler) {
  const { subscribe } = useSession()
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const unsubscribe = subscribe((ev, payload) => ref.current(ev, payload))
    return () => {
      unsubscribe()
    }
  }, [subscribe])
}
```

`useSession()` é como cada tela acessa a sessão.
`useRealtime(handler)` inscreve a tela nos eventos de tempo real. O `ref` guarda sempre a versão mais nova da função, sem precisar refazer a inscrição a cada desenho; ao sair da tela, a inscrição é cancelada.

---

## `web/src/position.js`

Ponto de busca do morador (RF05 e RF06). Fica só no navegador dele.

**Linhas 1 a 3**

```js
// Posição de busca do usuário (RF05/RF06). Fica apenas neste navegador; o servidor
// recebe o ponto a cada busca para calcular distâncias e não o armazena.
import { useCallback, useEffect, useState } from 'react'
```

Comentário sobre a privacidade do morador e importações.

**Linhas 5 a 21**

```js
const KEY = 'cb.position'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}

function save(pos) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pos))
  } catch {
    /* ignora */
  }
}
```

Lê e grava o ponto escolhido no `localStorage`, para lembrar entre visitas.

**Linha 23**

```js
export const geolocationAvailable = () => 'geolocation' in navigator && window.isSecureContext
```

O GPS só é liberado pelos navegadores em "contexto seguro" (`https` ou `localhost`). Por isso, ao abrir pelo IP da rede local, o sistema oferece escolher o ponto no mapa.

**Linhas 25 a 38**

```js
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Este navegador não informa a localização'))
    if (!window.isSecureContext) {
      return reject(new Error('Por este endereço o navegador não libera o GPS. Marca o ponto no mapa.'))
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (err) =>
        reject(new Error(err.code === 1 ? 'Sem permissão pra usar a localização. Marca o ponto no mapa.' : 'Não deu pra achar sua localização agora')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  })
}
```

Transforma a API de geolocalização do navegador (baseada em funções de retorno) numa `Promise`. Traduz os erros para mensagens claras: permissão negada ou localização indisponível. Pede alta precisão, espera até 12 segundos e aceita uma posição de até 1 minuto atrás.

**Linhas 40 a 53**

```js
export function usePosition(pilot) {
  const [position, setPositionState] = useState(load)

  useEffect(() => {
    if (!position && pilot) setPositionState({ lat: pilot.lat, lng: pilot.lng, source: 'piloto' })
  }, [pilot, position])

  const setPosition = useCallback((pos) => {
    setPositionState(pos)
    save(pos)
  }, [])

  return [position, setPosition]
}
```

*Hook* próprio que devolve o ponto atual e a função para mudá-lo. Sem ponto salvo, usa o centro do bairro piloto.

**Linhas 55 a 59**

```js
export const SOURCE_LABEL = {
  gps: 'Você está aqui',
  mapa: 'Ponto que você marcou no mapa',
  piloto: 'Centro do bairro',
}
```

Como cada origem aparece na tela de busca.

---

## `web/src/offline-queue.js`

Fila offline do cadastro de campo (RF18). Usa o **IndexedDB**, banco de dados do próprio navegador, que sobrevive a fechar a aba e desligar o celular.

**Linhas 1 a 6**

```js
// RF18: fila de cadastros feitos sem conexão durante a pesquisa de campo.
// Guarda no IndexedDB do aparelho e envia em lote quando a conexão volta.
import { get, set } from 'idb-keyval'
import { api } from './api.js'

const KEY = 'cb.field-queue'
```

Comentário e importações. A fila inteira fica guardada numa única chave.

**Linhas 8 a 17**

```js
export async function listQueue() {
  return (await get(KEY)) || []
}

export async function enqueue(item) {
  const q = await listQueue()
  q.push({ ...item, queuedAt: new Date().toISOString() })
  await set(KEY, q)
  return q.length
}
```

Lê a fila (lista vazia se não houver nada) e acrescenta um registro com a hora em que entrou.

**Linha 19**

```js
let syncing = null
```

Garante que só uma sincronização rode por vez: se já houver uma em andamento, devolve a mesma.

**Linhas 21 a 37**

```js
// Retorna { sent, failed: [{clientUuid, error}] }. Itens com erro de validação ficam na fila com a mensagem.
export function syncQueue() {
  if (syncing) return syncing
  syncing = (async () => {
    const q = await listQueue()
    if (!q.length || !navigator.onLine) return { sent: 0, failed: [] }
    const { results } = await api('/field/surveys/batch', { method: 'POST', body: { items: q } })
    const ok = new Set(results.filter((r) => r.ok).map((r) => r.clientUuid))
    const errors = Object.fromEntries(results.filter((r) => !r.ok).map((r) => [r.clientUuid, r.error]))
    const rest = q.filter((x) => !ok.has(x.clientUuid)).map((x) => ({ ...x, lastError: errors[x.clientUuid] || x.lastError }))
    await set(KEY, rest)
    return { sent: ok.size, failed: rest.map((x) => ({ clientUuid: x.clientUuid, error: x.lastError })) }
  })().finally(() => {
    syncing = null
  })
  return syncing
}
```

**Sincronização**: envia toda a fila num lote só, remove os itens aceitos e mantém os recusados com a mensagem de erro, para o agente corrigir. Sem itens ou sem conexão, não faz nada.
Como o servidor ignora `clientUuid` repetido, reenviar nunca duplica cadastros.

**Linhas 39 a 42**

```js
export function newUuid() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`
}
```

Gera o identificador único de cada registro no aparelho. `crypto.randomUUID` também só existe em contexto seguro; pelo IP da rede local usa uma alternativa com data e números aleatórios.

---

## `web/src/format.js`

Formatação de valores para exibição em português.

**Linhas 1 a 2**

```js
export const brl = (cents) =>
  cents === null || cents === undefined ? '' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
```

Centavos para reais (`R$ 1.500,00`).

**Linhas 4 a 12**

```js
export function priceRange(o) {
  const { priceMinCents: min, priceMaxCents: max, priceUnit } = o
  if (min === null && max === null) return 'Preço a combinar'
  const unit = priceUnit && priceUnit !== 'a combinar' ? ` ${priceUnit}` : ''
  if (min !== null && max !== null && min !== max) return `${brl(min)} a ${brl(max)}${unit}`
  if (min !== null && max !== null) return `${brl(min)}${unit}`
  if (min !== null) return `a partir de ${brl(min)}${unit}`
  return `até ${brl(max)}${unit}`
}
```

Monta o texto da faixa de preço: "a combinar", "R$ 35,00 a R$ 120,00 por bolo", "a partir de..." ou "até...".

**Linhas 14 a 15**

```js
export const localYmd = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
```

Data local no formato `AAAA-MM-DD` (o mesmo cuidado com o fuso explicado no servidor).

**Linhas 17 a 21**

```js
export const date = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '')
export const dateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
export const time = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '')
export const ymdToBr = (s) => (s ? s.split('-').reverse().join('/') : '')
```

Datas e horas no formato brasileiro e a conversão de `2026-10-30` para `30/10/2026`.

**Linhas 23 a 30**

```js
export function relative(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`
  return date(iso)
}
```

Tempo relativo para listas: "agora", "há 5 min", "há 2 h", "há 3 d" ou a data.

**Linhas 32 a 34**

```js
export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

export const firstName = (name = '') => name.split(' ')[0]
```

Concordância de número ("1 serviço", "2 serviços") e o primeiro nome de uma pessoa.

**Linhas 36 a 42**

```js
export function formatPhoneInput(value) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}
```

Formata o celular enquanto a pessoa digita: `(15`, `(15) 9987`, `(15) 99876-5432`.

**Linhas 44 a 47**

```js
export const since = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
```

"outubro de 2026", usado em "No ConectaBairro desde...".

---

## `web/public/icon.svg`

O ícone do aplicativo em formato vetorial (SVG), desenhado em código. A partir dele foram geradas as versões PNG de 180, 192 e 512 pixels exigidas para instalar o aplicativo no Android e no iPhone.

**Linhas 1 a 7**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#1c4b86"/>
  <rect x="36" y="36" width="440" height="440" rx="66" fill="none" stroke="#ffffff" stroke-width="14"/>
  <circle cx="256" cy="262" r="138" fill="none" stroke="#ffffff" stroke-width="18" stroke-dasharray="16 24" opacity=".55"/>
  <path d="M184 276 256 212l72 64v74a12 12 0 0 1-12 12h-36v-52h-48v52h-36a12 12 0 0 1-12-12z" fill="#ffffff"/>
  <circle cx="362" cy="160" r="32" fill="#e9a800"/>
</svg>
```

- quadrado azul com um filete branco por dentro, como uma placa de rua;
- um círculo tracejado e outro contínuo, que lembram o **raio de busca**;
- uma casa no centro, o bairro;
- um ponto amarelo, a cor de destaque, sugerindo uma notificação ou um ponto no mapa.

`viewBox="0 0 512 512"` define a área de desenho; o SVG pode ser ampliado sem perder nitidez.

---

## `web/src/categories.jsx`

Ícones das categorias e cores dos avatares. Dá identidade aos cartões: um anúncio de bolo mostra um bolo, um de costura mostra uma tesoura, em vez de todos com o mesmo desenho.

**Linhas 1 a 18**

```jsx
// Ícone de cada categoria, usado nos cartões, nos chips e quando o anúncio não tem foto.
import { BookOpen, Brush, CakeSlice, HeartHandshake, House, Palette, Scissors, Smartphone, Store, Truck, Wrench } from 'lucide-react'

export const CATEGORY_ICONS = {
  alimentacao: CakeSlice,
  costura: Scissors,
  beleza: Brush,
  aulas: BookOpen,
  manutencao: Wrench,
  domesticos: House,
  cuidados: HeartHandshake,
  tecnologia: Smartphone,
  artesanato: Palette,
  fretes: Truck,
  outros: Store,
}

export const categoryIcon = (slug) => CATEGORY_ICONS[slug] || Store
```

Cada categoria (o mesmo identificador usado no servidor) aponta para um ícone do lucide. `categoryIcon` devolve o ícone, ou uma lojinha para categorias desconhecidas.

**Linhas 20 a 36**

```jsx
// Cor de cada categoria. Vai para a variável CSS --cat, e o styles.css tira dela o fundo
// clarinho e o tom do texto (mais claro no modo escuro).
export const CATEGORY_COLORS = {
  alimentacao: '#c2410c',
  costura: '#9d3a7a',
  beleza: '#be185d',
  aulas: '#4338ca',
  manutencao: '#a16207',
  domesticos: '#0f766e',
  cuidados: '#2f7d4f',
  tecnologia: '#1d4ed8',
  artesanato: '#7c3aed',
  fretes: '#7a5230',
  outros: '#475569',
}

export const catStyle = (slug) => ({ '--cat': CATEGORY_COLORS[slug] || CATEGORY_COLORS.outros })
```

**Cor de cada categoria**, para a tela não ficar toda de uma cor só: alimentação em laranja-tijolo, costura em ameixa, beleza em rosa, aulas em anil, manutenção em ocre, e assim por diante. Os tons foram escolhidos fortes o bastante para servir de texto sobre fundo claro.
`catStyle` devolve a cor como variável CSS (`--cat`) para ser colocada no `style` do elemento. O CSS (classe `.cat`) tira dela o fundo clarinho e o tom do texto, inclusive no modo escuro, então aqui só existe uma cor por categoria.

**Linhas 38 a 52**

```jsx
// Cor do avatar a partir do nome: a mesma pessoa tem sempre a mesma cor.
const AVATAR_COLORS = [
  ['#dfe8f4', '#1c4b86'],
  ['#fbefc9', '#7a5700'],
  ['#dff1e5', '#2c7a4b'],
  ['#f6e0da', '#9a3b22'],
  ['#e8e0f3', '#5b3d8a'],
  ['#dcefee', '#1f6b68'],
]

export function avatarColors(name = '') {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
```

Seis pares de cor (fundo claro e letra escura, sempre com bom contraste). `avatarColors` transforma o nome num número (multiplica por 31 e soma o código de cada letra, a mesma ideia do `hashCode` do Java) e usa o resto da divisão por 6 para escolher o par.
Assim a cor é sempre a mesma para o mesmo nome, sem precisar guardar nada no banco.

---
