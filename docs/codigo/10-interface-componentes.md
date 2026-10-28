# 10. Interface web: componentes

Peças reaproveitadas pelas telas: layout, elementos visuais, mapas e diálogos. Em JSX, `className` é o equivalente ao `class` do HTML,
`{...}` insere um valor JavaScript e `{condição && <Elemento/>}` mostra o elemento só quando a condição é verdadeira.

## `web/src/components/Layout.jsx`

Moldura de todas as telas: barra superior, aviso de sem conexão, conteúdo, navegação inferior e aviso rápido.

**Linhas 1 a 4**

```jsx
import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, Bell, ClipboardList, Home, LayoutDashboard, LogIn, MessageCircle, ShieldCheck, User, WifiOff } from 'lucide-react'
import { useSession } from '../session.jsx'
```

Importações, incluindo os ícones da navegação.

**Linhas 6 a 24**

```jsx
function navItems(user) {
  if (!user) {
    return [
      { to: '/', label: 'Início', icon: Home, end: true },
      { to: '/entrar', label: 'Entrar', icon: LogIn },
    ]
  }
  const items = [
    { to: '/', label: 'Início', icon: Home, end: true },
    { to: '/conversas', label: 'Conversas', icon: MessageCircle },
    { to: '/contratacoes', label: 'Contratações', icon: ClipboardList },
  ]
  if (user.role === 'agente') items.push({ to: '/campo', label: 'Campo', icon: ClipboardList })
  else if (user.role === 'moderador') items.push({ to: '/moderacao', label: 'Moderação', icon: ShieldCheck })
  else if (user.role === 'instituicao') items.push({ to: '/indicadores', label: 'Indicadores', icon: BarChart3 })
  else if (user.isProvider) items.push({ to: '/painel', label: 'Painel', icon: LayoutDashboard })
  items.push({ to: '/perfil', label: 'Perfil', icon: User })
  return items
}
```

Define os itens de navegação conforme quem está logado: visitante vê Início e Entrar; usuário vê Início, Conversas e Contratações, mais um item do seu perfil (Campo, Moderação, Indicadores ou, para prestadores, Painel) e Perfil.

**Linhas 26 a 29**

```jsx
export function Layout() {
  const { user, unread, toast, setToast } = useSession()
  const [online, setOnline] = useState(navigator.onLine)
  const { pathname } = useLocation()
```

Estados do layout: usuário, número de notificações, aviso rápido, se há conexão e o endereço atual.

**Linhas 31 a 40**

```jsx
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
```

Acompanha a conexão com os eventos `online` e `offline` do navegador; a limpeza remove os ouvintes ao sair.

**Linhas 42 a 46**

```jsx
  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast, setToast])
```

Esconde o aviso rápido depois de 4,5 segundos.

**Linhas 48 a 50**

```jsx
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
```

Volta ao topo a cada troca de tela. As chaves `{ }` são necessárias: no Chromium recente `window.scrollTo` devolve uma `Promise`, e um efeito do React só pode devolver uma função de limpeza.

**Linhas 52 a 74**

```jsx
  const items = navItems(user)
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img src="/icon.svg" alt="" />
          ConectaBairro
        </NavLink>
        <nav className="topnav" aria-label="Principal">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end}>
              {i.label}
            </NavLink>
          ))}
        </nav>
        <span className="spacer" />
        {user && (
          <NavLink to="/notificacoes" className="icon-btn" aria-label="Notificações">
            <Bell size={22} />
            {unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
          </NavLink>
        )}
      </header>
```

Barra superior com a marca e, em telas largas (computador), os itens de navegação no topo. O sino com o número de não lidas aparece para quem está logado.

**Linhas 75 a 79**

```jsx
      {!online && (
        <div className="offline-bar">
          <WifiOff size={14} style={{ verticalAlign: -2 }} /> Sem conexão. {user?.role === 'agente' ? 'Os cadastros de campo serão guardados e enviados depois.' : 'Algumas funções ficam indisponíveis.'}
        </div>
      )}
```

Faixa amarela de sem conexão. Para o agente de campo, explica que os cadastros serão guardados e enviados depois.

**Linhas 80 a 82**

```jsx
      <main className="main">
        <Outlet />
      </main>
```

`<Outlet />` é onde o React Router desenha a tela atual.

**Linhas 83 a 98**

```jsx
      <nav className="bottomnav" aria-label="Navegação">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end}>
            <i.icon size={22} />
            {i.label}
          </NavLink>
        ))}
      </nav>
      {toast && (
        <div className={`toast ${toast.kind}`} onClick={() => setToast(null)} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}
```

Navegação inferior (no celular) e o aviso rápido, que some ao ser tocado. `role="status"` faz leitores de tela anunciarem o aviso.

---

## `web/src/components/ui.jsx`

Componentes visuais pequenos usados em várias telas e o *hook* `useLoad`.

**Linhas 1 a 2**

```jsx
import { useCallback, useEffect, useState } from 'react'
import { Loader2, Star, X } from 'lucide-react'
```

Importações.

**Linhas 4 a 16**

```jsx
export function Stars({ value, count, size = 14 }) {
  if (value === null || value === undefined) return <span className="muted small">Sem avaliações</span>
  const full = Math.round(value)
  return (
    <span className="stars" title={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= full ? 'currentColor' : 'none'} strokeWidth={i <= full ? 0 : 2} />
      ))}
      <span className="num">{String(value).replace('.', ',')}</span>
      {count !== undefined && <span className="muted small">&nbsp;({count})</span>}
    </span>
  )
}
```

Estrelas da avaliação: arredonda a média para escolher quantas preencher, mostra a nota com vírgula e, opcionalmente, a quantidade de avaliações.

**Linhas 18 a 28**

```jsx
export function StarInput({ value, onChange }) {
  return (
    <div className="star-input" role="radiogroup" aria-label="Nota">
      {[1, 2, 3, 4, 5].map((i) => (
        <button type="button" key={i} className={i <= value ? 'on' : ''} onClick={() => onChange(i)} aria-label={`${i} estrela${i > 1 ? 's' : ''}`}>
          <Star size={32} fill="currentColor" strokeWidth={0} />
        </button>
      ))}
    </div>
  )
}
```

Estrelas clicáveis para dar nota. Cada botão tem rótulo ("3 estrelas") para leitores de tela.

**Linhas 30 a 38**

```jsx
export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="empty">
      {Icon && <Icon size={40} />}
      <h3>{title}</h3>
      {children && <div className="small">{children}</div>}
    </div>
  )
}
```

Mensagem para listas vazias, com ícone, título e texto opcional.

**Linhas 40 a 59**

```jsx
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
```

Janela sobreposta (diálogo). Fecha com a tecla Esc ou ao clicar fora (`e.target === e.currentTarget` confere que o clique foi no fundo, não dentro da janela). Os atributos `role` e `aria-modal` informam leitores de tela.

**Linhas 61 a 70**

```jsx
export function Avatar({ name = '', size }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  return <div className={`avatar ${size || ''}`}>{initials || '?'}</div>
}
```

Círculo com as iniciais do nome (por exemplo, "CB" para Cleusa Batista). O sistema não pede foto de perfil.

**Linhas 72 a 94**

```jsx
export function Loading({ label = 'Carregando...' }) {
  return (
    <div className="empty">
      <Loader2 className="spin" size={28} />
      <div className="small">{label}</div>
    </div>
  )
}

export function ErrorBox({ error }) {
  if (!error) return null
  return <div className="error">{error.message || String(error)}</div>
}

export function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}
```

Indicador de carregamento, caixa de erro e cartão de número (estatística) dos painéis.

**Linhas 96 a 123**

```jsx
// Gráfico de barras simples (sem biblioteca), com até duas séries.
export function Bars({ data, a, b, labelA, labelB }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d[a] || 0, b ? d[b] || 0 : 0)))
  return (
    <div>
      <div className="bars">
        {data.map((d, i) => (
          <div className="bar" key={i} title={`${d.label}: ${labelA} ${d[a]}${b ? `, ${labelB} ${d[b]}` : ''}`}>
            <i style={{ height: `${((d[a] || 0) / max) * 100}%` }} />
            {b && <i className="alt" style={{ height: `${((d[b] || 0) / max) * 100}%` }} />}
          </div>
        ))}
      </div>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--primary)' }} />
          {labelA}
        </span>
        {b && (
          <span>
            <i style={{ background: 'var(--accent)' }} />
            {labelB}
          </span>
        )}
      </div>
    </div>
  )
}
```

Gráfico de barras feito só com CSS, sem biblioteca: cada barra tem altura proporcional ao maior valor da série (`max`). Mostra até duas séries lado a lado, com legenda e o valor no `title` (aparece ao passar o mouse).

**Linhas 125 a 137**

```jsx
export function HBar({ label, value, max, display, accent }) {
  return (
    <div className={`hbar ${accent ? 'accent' : ''}`}>
      <div className="top">
        <span>{label}</span>
        <span className="strong nowrap">{display ?? value}</span>
      </div>
      <div className="track">
        <i style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} />
      </div>
    </div>
  )
}
```

Barra horizontal de proporção, usada no painel de indicadores.

**Linhas 139 a 156**

```jsx
// Carrega dados assíncronos com estado de carregamento, erro e recarga.
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      setState({ data: await fn(), error: null, loading: false })
    } catch (error) {
      setState({ data: null, error, loading: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => {
    load()
  }, [load])
  const setData = useCallback((next) => setState((s) => ({ ...s, data: typeof next === 'function' ? next(s.data) : next })), [])
  return { ...state, reload: load, setData }
}
```

`useLoad` padroniza o carregamento de dados das telas: devolve os dados, o erro, se está carregando, `reload` para buscar de novo e `setData` para ajustar os dados localmente.
`setData` aceita um valor ou uma função que recebe os dados atuais (como o `setState` do React); o chat usa essa forma para acrescentar mensagens sem perder as que já estão na tela.

---

## `web/src/components/OfferCard.jsx`

Cartão de oferta da lista de resultados.

**Linhas 1 a 4**

```jsx
import { Link } from 'react-router-dom'
import { MapPin, Package, Sparkles, Wrench } from 'lucide-react'
import { plural, priceRange } from '../format.js'
import { Stars } from './ui.jsx'
```

Importações.

**Linhas 6 a 14**

```jsx
export function Thumb({ offer, size }) {
  const img = offer.images?.[0]
  const Icon = offer.kind === 'produto' ? Package : Wrench
  return (
    <div className="thumb" style={size ? { width: size, height: size } : undefined}>
      {img ? <img src={img} alt="" loading="lazy" /> : <Icon size={30} strokeWidth={1.6} />}
    </div>
  )
}
```

Miniatura: a primeira foto da oferta ou, sem foto, um ícone de caixa (produto) ou ferramenta (serviço). `loading="lazy"` só baixa a imagem quando ela chega perto da tela.

**Linhas 16 a 49**

```jsx
export function OfferCard({ offer }) {
  return (
    <Link to={`/oferta/${offer.id}`} className={`offer-card ${offer.highlighted ? 'highlighted' : ''}`}>
      <Thumb offer={offer} />
      <div className="grow">
        <div className="row between">
          <span className="badge">{offer.categoryName}</span>
          {offer.highlighted && (
            <span className="badge accent">
              <Sparkles size={12} /> Destaque
            </span>
          )}
        </div>
        <h3 className="ellipsis">{offer.title}</h3>
        <div className="meta">
          {offer.distance && (
            <span className="distance">
              <MapPin size={14} />
              {offer.distance.label}
            </span>
          )}
          <span>{offer.provider?.name}</span>
        </div>
        <div className="meta mt" style={{ marginTop: 6 }}>
          <span className="strong" style={{ color: 'var(--ink)' }}>
            {priceRange(offer)}
          </span>
          {offer.reputation && offer.reputation.reviews > 0 && <Stars value={offer.reputation.avgRating} count={offer.reputation.reviews} size={12} />}
          {offer.reputation && offer.reputation.concluded > 0 && <span>{plural(offer.reputation.concluded, 'serviço', 'serviços')}</span>}
        </div>
      </div>
    </Link>
  )
}
```

O cartão inteiro é um link para a oferta. Mostra categoria, a etiqueta Destaque (com borda laranja), título, **distância aproximada**, nome do prestador, preço, estrelas e quantidade de serviços concluídos.

---

## `web/src/components/Maps.jsx`

Mapas com Leaflet e OpenStreetMap. Por decisão de projeto, nenhum mapa mostra onde os prestadores estão.

**Linhas 1 a 5**

```jsx
// Mapas com Leaflet + OpenStreetMap. Por decisão de projeto (RF04), nenhum mapa mostra
// onde os prestadores estão: o mapa da busca exibe só o ponto do próprio usuário e o raio.
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
```

Comentário com a regra de privacidade, o CSS do Leaflet e os componentes do `react-leaflet`.

**Linhas 7 a 8**

```jsx
const TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
```

Endereço dos blocos de imagem do OpenStreetMap e o crédito obrigatório pela licença deles.

**Linhas 10 a 16**

```jsx
function zoomForRadius(km) {
  if (km <= 0.5) return 15
  if (km <= 1) return 14
  if (km <= 2) return 13
  if (km <= 5) return 12
  return 11
}
```

Escolhe o zoom para o raio caber no mapa: quanto maior o raio, mais afastado.

**Linhas 18 a 24**

```jsx
function Recenter({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom(), { animate: true })
  }, [center[0], center[1], zoom]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
```

Componente invisível que move o mapa quando o ponto ou o zoom mudam. `useMap()` dá acesso ao mapa do Leaflet.

**Linhas 26 a 29**

```jsx
function ClickToPick({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}
```

Componente invisível que avisa onde a pessoa clicou no mapa.

**Linhas 31 a 42**

```jsx
export function RadiusMap({ position, radiusKm, onPick, tall }) {
  const center = [position.lat, position.lng]
  return (
    <MapContainer center={center} zoom={zoomForRadius(radiusKm)} className={`map ${tall ? 'tall' : ''}`} scrollWheelZoom={false} attributionControl>
      <TileLayer url={TILE} attribution={ATTR} />
      <Recenter center={center} zoom={zoomForRadius(radiusKm)} />
      <Circle center={center} radius={radiusKm * 1000} pathOptions={{ color: '#0f5c4d', weight: 2, fillOpacity: 0.08 }} />
      <CircleMarker center={center} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#d9702b', fillOpacity: 1 }} />
      {onPick && <ClickToPick onPick={onPick} />}
    </MapContainer>
  )
}
```

Mapa da busca: o círculo do raio e o ponto laranja do **próprio morador**. Mais nada. A rolagem do mouse fica desligada para não atrapalhar a rolagem da página.

**Linhas 44 a 56**

```jsx
export function PickPointMap({ value, onChange, fallback, radiusKm }) {
  const point = value || fallback
  const center = [point.lat, point.lng]
  return (
    <MapContainer center={center} zoom={16} className="map tall" scrollWheelZoom attributionControl>
      <TileLayer url={TILE} attribution={ATTR} />
      <Recenter center={center} />
      {value && radiusKm && <Circle center={center} radius={radiusKm * 1000} pathOptions={{ color: '#0f5c4d', weight: 1, fillOpacity: 0.05 }} />}
      {value && <CircleMarker center={center} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#0f5c4d', fillOpacity: 1 }} />}
      <ClickToPick onPick={onChange} />
    </MapContainer>
  )
}
```

Mapa para escolher um ponto (morador escolhendo de onde busca, prestador marcando onde atende). Mostra o ponto escolhido e, se informado, o raio de atendimento.

---

## `web/src/components/LocationDialog.jsx`

Diálogo "De onde você está buscando?" da tela inicial.

**Linhas 1 a 5**

```jsx
import { useState } from 'react'
import { Crosshair, Home, Loader2 } from 'lucide-react'
import { getCurrentPosition } from '../position.js'
import { PickPointMap } from './Maps.jsx'
import { Modal } from './ui.jsx'
```

Importações.

**Linhas 7 a 11**

```jsx
// Escolha do ponto de busca do morador: GPS, clique no mapa ou centro do bairro piloto.
export function LocationDialog({ current, pilot, onClose, onSave }) {
  const [point, setPoint] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
```

Três opções: GPS, ponto clicado no mapa ou centro do bairro.

**Linhas 13 a 24**

```jsx
  async function useGps() {
    setBusy(true)
    setError('')
    try {
      const p = await getCurrentPosition()
      onSave({ ...p, source: 'gps' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
```

Pede a localização ao navegador e salva; se falhar, mostra o motivo (por exemplo, GPS indisponível pelo IP da rede local).

**Linhas 26 a 45**

```jsx
  return (
    <Modal title="De onde você está buscando?" onClose={onClose}>
      <button className="btn block" onClick={useGps} disabled={busy}>
        {busy ? <Loader2 size={18} className="spin" /> : <Crosshair size={18} />} Usar minha localização atual
      </button>
      {error && <div className="error mt">{error}</div>}
      <p className="small muted mt">Ou toque no mapa para escolher um ponto. Sua posição fica só neste aparelho.</p>
      <PickPointMap value={point} fallback={pilot} onChange={(p) => setPoint({ ...p, source: 'mapa' })} />
      <div className="row mt">
        <button className="btn ghost" onClick={() => onSave({ lat: pilot.lat, lng: pilot.lng, source: 'piloto' })}>
          <Home size={16} /> Centro do bairro
        </button>
        <span className="grow" />
        <button className="btn" disabled={!point || point.source !== 'mapa'} onClick={() => onSave(point)}>
          Usar este ponto
        </button>
      </div>
    </Modal>
  )
}
```

Botão do GPS, o mapa para clicar e os botões "Centro do bairro" e "Usar este ponto" (habilitado só depois de clicar no mapa).

---

## `web/src/components/ReportDialog.jsx`

Diálogo de denúncia (RF15), usado na oferta, no perfil e no chat.

**Linhas 1 a 4**

```jsx
import { useState } from 'react'
import { api } from '../api.js'
import { useSession } from '../session.jsx'
import { Modal } from './ui.jsx'
```

Importações.

**Linhas 6 a 12**

```jsx
// RF15
export function ReportDialog({ targetType, targetId, onClose }) {
  const { meta, showToast } = useSession()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
```

Estados do formulário: motivo, detalhes, enviando e erro.

**Linhas 14 a 26**

```jsx
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/reports', { method: 'POST', body: { targetType, targetId, reason, details } })
      showToast('Denúncia enviada. A moderação vai analisar.', 'ok')
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }
```

Envia a denúncia. `e.preventDefault()` impede o formulário de recarregar a página (comportamento padrão do HTML).

**Linhas 28 a 48**

```jsx
  return (
    <Modal title="Denunciar" onClose={onClose}>
      <form onSubmit={submit}>
        {Object.entries(meta?.reportReasons || {}).map(([id, label]) => (
          <label className="checkbox" key={id}>
            <input type="radio" name="reason" checked={reason === id} onChange={() => setReason(id)} />
            <span>{label}</span>
          </label>
        ))}
        <label className="field mt">
          <span>Detalhes (opcional)</span>
          <textarea className="input" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={800} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn block" disabled={!reason || busy}>
          Enviar denúncia
        </button>
      </form>
    </Modal>
  )
}
```

Os motivos vêm do servidor (`meta.reportReasons`), como opções de escolha única. O botão só é liberado depois de escolher um motivo.

---

## `web/src/components/ImagePicker.jsx`

Escolha de fotos da oferta (RF02).

**Linhas 1 a 2**

```jsx
import { useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'
```

Importações.

**Linhas 4 a 21**

```jsx
// Reduz a foto no próprio aparelho antes do envio (economiza dados móveis).
function resize(file, maxSide = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Não foi possível ler a imagem'))
    img.src = url
  })
}
```

`resize` reduz a foto **no próprio aparelho** antes do envio: desenha a imagem num `canvas` com o lado maior em até 1.280 pixels e gera um JPEG com qualidade 82%.
Uma foto de celular de 4 MB vira algo como 200 KB, economizando o plano de dados de quem está publicando.

**Linhas 23 a 31**

```jsx
export function ImagePicker({ images, onChange, max = 4 }) {
  const input = useRef(null)
  async function onFiles(e) {
    const files = [...e.target.files].slice(0, max - images.length)
    const out = []
    for (const f of files) out.push(await resize(f))
    onChange([...images, ...out])
    e.target.value = ''
  }
```

`onFiles` reduz cada foto escolhida, respeitando o limite de 4, e limpa o campo para permitir escolher a mesma foto de novo.

**Linhas 32 a 50**

```jsx
  return (
    <div className="image-picker">
      {images.map((src, i) => (
        <div className="slot" key={i}>
          <img src={src} alt="" />
          <button type="button" className="remove" onClick={() => onChange(images.filter((_, j) => j !== i))} aria-label="Remover imagem">
            <X size={14} />
          </button>
        </div>
      ))}
      {images.length < max && (
        <button type="button" className="slot" onClick={() => input.current.click()} aria-label="Adicionar imagem">
          <ImagePlus size={24} />
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={onFiles} />
    </div>
  )
}
```

Mostra as miniaturas com botão de remover e um botão "+" que abre o seletor de arquivos (escondido) aceitando JPG, PNG e WEBP.

---

## `web/src/components/ProviderLocation.jsx`

Cartão "Onde você atende?" do painel do prestador (RF04).

**Linhas 1 a 7**

```jsx
// RF04: o prestador marca onde atende. O ponto vai para o servidor e não volta mais para nenhum cliente.
import { useState } from 'react'
import { Crosshair, Loader2, Lock } from 'lucide-react'
import { api } from '../api.js'
import { getCurrentPosition } from '../position.js'
import { useSession } from '../session.jsx'
import { PickPointMap } from './Maps.jsx'
```

Comentário e importações.

**Linhas 9 a 14**

```jsx
export function ProviderLocation({ onSaved, onCancel }) {
  const { meta, location, setLocation, showToast } = useSession()
  const [point, setPoint] = useState(null)
  const [radius, setRadius] = useState(location.serviceRadiusKm || 3)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
```

Estados: ponto escolhido, raio, ação em andamento e erro.

**Linhas 16 a 26**

```jsx
  async function gps() {
    setBusy('gps')
    setError('')
    try {
      setPoint(await getCurrentPosition())
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }
```

"Estou no local de atendimento agora": usa o GPS do aparelho.

**Linhas 28 a 43**

```jsx
  async function save() {
    setBusy('save')
    setError('')
    try {
      const r = point
        ? await api('/me/location', { method: 'PUT', body: { lat: point.lat, lng: point.lng, serviceRadiusKm: radius } })
        : await api('/me/location', { method: 'PATCH', body: { serviceRadiusKm: radius } })
      setLocation(r.location)
      showToast('Ponto de atendimento salvo', 'ok')
      onSaved?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }
```

Com ponto novo, salva ponto e raio (`PUT`); sem ponto novo, só o raio (`PATCH`). O servidor responde apenas que a localização existe, sem as coordenadas.

**Linhas 45 a 81**

```jsx
  return (
    <div className="card">
      <h2>Onde você atende?</h2>
      <div className="notice mb">
        <Lock size={18} />
        <span className="small">
          Esse ponto serve só para calcular distâncias. Os vizinhos veem apenas algo como "1,2 km de você", calculado a partir de um ponto deslocado
          entre 100 e 300 metros do seu endereço. Ninguém vê sua rua ou seu número.
        </span>
      </div>
      <button className="btn outline block mb" onClick={gps} disabled={!!busy}>
        {busy === 'gps' ? <Loader2 size={18} className="spin" /> : <Crosshair size={18} />} Estou no local de atendimento agora
      </button>
      <p className="small muted">Ou toque no mapa para marcar o ponto.</p>
      <PickPointMap value={point} onChange={setPoint} fallback={meta.pilot} radiusKm={radius} />
      <label className="field mt">
        <span>
          Atendo até {String(radius).replace('.', ',')} km de distância
          <span className="hint">Para quem vai até você ou para onde você se desloca para atender.</span>
        </span>
        <input type="range" min={0.5} max={20} step={0.5} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
      </label>
      {error && <div className="error">{error}</div>}
      <div className="row">
        {onCancel && (
          <button className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button className="btn grow" onClick={save} disabled={!!busy || (!point && !location.hasLocation)}>
          {busy === 'save' && <Loader2 size={18} className="spin" />}
          {point || !location.hasLocation ? 'Salvar ponto de atendimento' : 'Salvar raio de atendimento'}
        </button>
      </div>
    </div>
  )
}
```

A explicação de privacidade para o prestador (o que os vizinhos veem e o que não veem), o botão de GPS, o mapa, o controle do raio de 0,5 a 20 km e os botões.
O texto do botão muda conforme o que será salvo.

---
