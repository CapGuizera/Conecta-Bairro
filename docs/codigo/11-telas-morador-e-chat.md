# 11. Telas: entrada, busca, oferta e chat

As telas por onde passa o morador contratante (persona Thiago) e onde acontece a negociação com o prestador.
Cada tela é um componente exportado com `export default` e ligado a um endereço em `main.jsx`.

## `web/src/pages/Login.jsx`

Tela de entrada por celular (RF01), em três passos: celular, código e, se for conta nova, nome.

**Linhas 1 a 7**

```jsx
// RF01: entrada por celular com código de verificação.
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react'
import { api } from '../api.js'
import { formatPhoneInput } from '../format.js'
import { useSession } from '../session.jsx'
```

Comentário e importações.

**Linhas 9 a 20**

```jsx
export default function Login() {
  const { user, login, meta } = useSession()
  const navigate = useNavigate()
  const from = useLocation().state?.from || '/'
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState('')
  const [name, setName] = useState('')
  const [isProvider, setIsProvider] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
```

Estados da tela: o passo atual, o celular, o código, o código de demonstração, o nome, se quer oferecer serviços, se está enviando e o erro. `from` é a tela para onde voltar depois de entrar.

**Linha 22**

```jsx
  if (user) return <Navigate to={from} replace />
```

Quem já está logado é levado direto ao destino.

**Linhas 24 a 38**

```jsx
  async function requestCode(e, phoneValue = phone) {
    e?.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await api('/auth/request-code', { method: 'POST', body: { phone: phoneValue } })
      setDevCode(r.devCode || '')
      setCode(r.devCode || '')
      setStep('code')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
```

Pede o código ao servidor. No modo demonstração o código volta na resposta e já é preenchido. O segundo parâmetro permite que os atalhos de demonstração peçam o código para um número sem esperar o estado ser atualizado.

**Linhas 40 a 57**

```jsx
  async function verify(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await api('/auth/verify', { method: 'POST', body: { phone, code, name: step === 'name' ? name : undefined, isProvider } })
      if (r.needsName) {
        setStep('name')
      } else {
        await login(r.token)
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }
```

Confirma o código. Se o servidor responder `needsName`, avança para o passo do nome; senão, guarda a sessão e volta para a tela de origem.

**Linhas 59 a 64**

```jsx
  return (
    <div className="login">
      <div className="card">
        <img src="/icon.svg" alt="" className="logo" />
        <h1>ConectaBairro</h1>
        <p className="muted">Serviços e comércio do seu bairro, sem expor o endereço de ninguém.</p>
```

Cartão central com a marca e a frase da proposta de valor.

**Linhas 66 a 84**

```jsx
        {step === 'phone' && (
          <form onSubmit={requestCode}>
            <label className="field">
              <span>Seu celular</span>
              <input
                className="input"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(15) 99876-5432"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                autoFocus
              />
              <span className="hint">Enviamos um código para confirmar que o número é seu. Não pedimos CNPJ nem documentos.</span>
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn block" disabled={busy || phone.replace(/\D/g, '').length < 10}>
              {busy && <Loader2 size={18} className="spin" />} Receber código
            </button>
```

**Passo 1**: campo de celular com formatação automática e `inputMode="tel"` (abre o teclado numérico no celular). O texto de ajuda reforça que não há pedido de CNPJ nem de documentos. O botão só é liberado com pelo menos 10 dígitos.

**Linhas 85 a 106**

```jsx
            {meta?.demoAccounts?.length > 0 && (
              <div className="mt-lg">
                <div className="small strong">Contas de demonstração</div>
                <div className="tiny muted">Modo de teste: o código aparece na tela, sem SMS.</div>
                <div className="demo-accounts">
                  {meta.demoAccounts.map((a) => (
                    <button
                      type="button"
                      key={a.phone}
                      onClick={() => {
                        setPhone(a.phone)
                        requestCode(null, a.phone)
                      }}
                    >
                      <span className="strong">{a.name}</span> <span className="muted">· {a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}
```

No modo demonstração, os atalhos das personas: um toque preenche o celular e já pede o código.

**Linhas 108 a 138**

```jsx
        {step === 'code' && (
          <form onSubmit={verify}>
            <button type="button" className="btn ghost sm mb" onClick={() => setStep('phone')}>
              <ArrowLeft size={16} /> {phone}
            </button>
            {devCode && (
              <div className="notice mb">
                <ShieldCheck size={18} />
                <span>
                  Modo demonstração: seu código é <strong>{devCode}</strong>. Em produção ele chega por SMS.
                </span>
              </div>
            )}
            <label className="field">
              <span>Código de 6 dígitos</span>
              <input
                className="input code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn block" disabled={busy || code.length !== 6}>
              {busy && <Loader2 size={18} className="spin" />} Confirmar
            </button>
          </form>
        )}
```

**Passo 2**: botão para voltar e corrigir o número, aviso com o código no modo demonstração e campo de 6 dígitos. `autoComplete="one-time-code"` permite que o celular sugira o código recebido por SMS automaticamente.

**Linhas 140 a 164**

```jsx
        {step === 'name' && (
          <form onSubmit={verify}>
            <h2>Bem-vindo ao bairro</h2>
            <label className="field">
              <span>Como podemos te chamar?</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus autoComplete="name" />
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={isProvider} onChange={(e) => setIsProvider(e.target.checked)} />
              <span>
                <strong>Também quero oferecer serviços ou produtos</strong>
                <br />
                <span className="small muted">Você aparece para os vizinhos só pela distância aproximada. Seu endereço nunca é mostrado.</span>
              </span>
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn block mt" disabled={busy || !name.trim()}>
              {busy && <Loader2 size={18} className="spin" />} Criar minha conta
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
```

**Passo 3**, só para conta nova: nome e a opção de também oferecer serviços, com a garantia de que o endereço nunca é mostrado.

---

## `web/src/pages/Home.jsx`

Tela inicial e busca (RF05 e RF06). Os filtros ficam no endereço (`?q=...&categoria=...&raio=...`), então dá para compartilhar ou voltar a uma busca.

**Linhas 1 a 11**

```jsx
// RF05 (busca por categoria e necessidade) e RF06 (filtro por raio), ordenados por distância.
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, Lock, MapPin, Search, SearchX } from 'lucide-react'
import { api, qs } from '../api.js'
import { LocationDialog } from '../components/LocationDialog.jsx'
import { RadiusMap } from '../components/Maps.jsx'
import { OfferCard } from '../components/OfferCard.jsx'
import { Empty, ErrorBox } from '../components/ui.jsx'
import { SOURCE_LABEL, geolocationAvailable, getCurrentPosition, usePosition } from '../position.js'
import { useSession } from '../session.jsx'
```

Comentário e importações.

**Linhas 13 a 22**

```jsx
export default function Home() {
  const { meta, user } = useSession()
  const [params, setParams] = useSearchParams()
  const [position, setPosition] = usePosition(meta?.pilot)
  const [text, setText] = useState(params.get('q') || '')
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showLocation, setShowLocation] = useState(false)
  const [showMap, setShowMap] = useState(false)
```

Estados: parâmetros da URL, ponto de busca, texto digitado, resultados, erro, carregando e quais painéis estão abertos.

**Linhas 24 a 38**

```jsx
  // Na primeira visita tenta usar o GPS uma única vez; se negar, fica o centro do bairro.
  useEffect(() => {
    let asked = true
    try {
      asked = localStorage.getItem('cb.gpsAsked') === '1'
      localStorage.setItem('cb.gpsAsked', '1')
    } catch {
      /* ignora */
    }
    if (!asked && geolocationAvailable()) {
      getCurrentPosition()
        .then((p) => setPosition({ ...p, source: 'gps' }))
        .catch(() => {})
    }
  }, [setPosition])
```

Na primeira visita, tenta o GPS uma única vez (o navegador pergunta ao usuário). Uma marca no `localStorage` evita perguntar de novo; se a pessoa negar, fica o centro do bairro.

**Linhas 40 a 42**

```jsx
  const category = params.get('categoria') || ''
  const q = params.get('q') || ''
  const radius = Number(params.get('raio')) || 2
```

Lê os filtros da URL; o raio padrão é 2 km.

**Linhas 44 a 51**

```jsx
  const update = (changes) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === '' || v === null || v === undefined) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }
```

Muda os filtros na URL. `replace: true` evita encher o histórico do botão "voltar" a cada ajuste.

**Linhas 53 a 72**

```jsx
  useEffect(() => {
    if (!position) return undefined
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    const t = setTimeout(async () => {
      try {
        const r = await api(`/search?${qs({ lat: position.lat, lng: position.lng, radius, category, q })}`, { signal: ctrl.signal })
        setResults(r.results)
      } catch (err) {
        if (err.name !== 'AbortError') setError(err)
      } finally {
        setLoading(false)
      }
    }, 150)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [position?.lat, position?.lng, radius, category, q]) // eslint-disable-line react-hooks/exhaustive-deps
```

**A busca.** Roda sempre que ponto, raio, categoria ou texto mudam.

- espera 150 ms antes de buscar (se a pessoa mexer no controle de raio várias vezes seguidas, só a última busca é feita);
- o `AbortController` cancela a busca anterior se uma nova começar, evitando que um resultado antigo apareça depois do novo;
- a limpeza do efeito cancela o temporizador e a requisição.

**Linhas 74 a 80**

```jsx
  const radiusOptions = meta?.radiusOptionsKm || [0.5, 1, 2, 3, 5, 10]
  const radiusIndex = Math.max(0, radiusOptions.indexOf(radius))
  const heading = useMemo(() => {
    if (q) return `Resultados para "${q}"`
    if (category) return meta?.categories.find((c) => c.slug === category)?.name || 'Resultados'
    return 'Perto de você'
  }, [q, category, meta])
```

Opções de raio vindas do servidor, a posição do controle deslizante e o título da seção, que muda conforme a busca.

**Linhas 82 a 87**

```jsx
  if (!position) return null

  return (
    <div>
      <h1>{user ? `Olá, ${user.name.split(' ')[0]}` : 'O que você precisa hoje?'}</h1>
      <p className="muted small">Encontre quem atende a poucos minutos de caminhada.</p>
```

Saudação com o primeiro nome quando logado.

**Linhas 89 a 108**

```jsx
      <form
        className="search-box mb"
        onSubmit={(e) => {
          e.preventDefault()
          update({ q: text.trim() })
        }}
      >
        <Search size={20} />
        <input
          className="input"
          type="search"
          placeholder="Ex.: bolo de aniversário, conserto de chuveiro"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (!e.target.value) update({ q: '' })
          }}
          enterKeyHint="search"
        />
      </form>
```

Caixa de busca por necessidade. A busca dispara ao enviar (Enter ou botão do teclado); apagar o texto limpa a busca.

**Linhas 110 a 119**

```jsx
      <div className="chips">
        <button className={`chip ${!category ? 'on' : ''}`} onClick={() => update({ categoria: '' })}>
          Todas
        </button>
        {meta?.categories.map((c) => (
          <button key={c.slug} className={`chip ${category === c.slug ? 'on' : ''}`} onClick={() => update({ categoria: category === c.slug ? '' : c.slug })}>
            {c.name}
          </button>
        ))}
      </div>
```

As categorias como botões roláveis na horizontal. Tocar de novo na categoria escolhida volta para "Todas".

**Linhas 121 a 134**

```jsx
      <div className="card tight">
        <div className="row">
          <MapPin size={18} color="var(--accent)" />
          <div className="grow">
            <div className="small strong">{SOURCE_LABEL[position.source] || 'Ponto de busca'}</div>
            <div className="tiny muted">Raio de busca: até {String(radius).replace('.', ',')} km</div>
          </div>
          <button className="btn ghost sm" onClick={() => setShowLocation(true)}>
            Alterar
          </button>
          <button className="icon-btn" onClick={() => setShowMap((v) => !v)} aria-label="Mostrar mapa" aria-expanded={showMap}>
            <ChevronDown size={18} style={{ transform: showMap ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
          </button>
        </div>
```

Cartão da localização: de onde está buscando, raio atual, botão "Alterar" e botão para mostrar o mapa.

**Linhas 135 a 149**

```jsx
        <input
          type="range"
          min={0}
          max={radiusOptions.length - 1}
          step={1}
          value={radiusIndex}
          onChange={(e) => update({ raio: radiusOptions[Number(e.target.value)] })}
          aria-label="Raio de busca"
          className="mt"
        />
        <div className="row between tiny muted">
          {radiusOptions.map((r) => (
            <span key={r}>{String(r).replace('.', ',')} km</span>
          ))}
        </div>
```

Controle deslizante do raio (RF06). Ele trabalha com a posição na lista (0 a 5) e não com os quilômetros, para os passos ficarem uniformes (0,5, 1, 2, 3, 5 e 10 km). Abaixo, as marcas de cada opção.

**Linhas 150 a 158**

```jsx
        {showMap && (
          <div className="mt">
            <RadiusMap position={position} radiusKm={radius} onPick={(p) => setPosition({ ...p, source: 'mapa' })} />
            <div className="row tiny muted mt">
              <Lock size={12} /> Por privacidade, o mapa não mostra onde os prestadores moram. Você vê só a distância aproximada.
            </div>
          </div>
        )}
      </div>
```

O mapa do raio com o aviso: "o mapa não mostra onde os prestadores moram". Clicar no mapa muda o ponto de busca.

**Linhas 160 a 163**

```jsx
      <div className="section-title">
        <h2>{heading}</h2>
        {results && !loading && <span className="small muted">{results.length} encontrados</span>}
      </div>
```

Título da lista e quantidade de resultados.

**Linhas 165 a 172**

```jsx
      <ErrorBox error={error} />
      {loading && !results && (
        <div className="offer-list">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      )}
```

Erro e os blocos cinza animados (*skeleton*) enquanto a primeira busca carrega.

**Linhas 173 a 184**

```jsx
      {results && results.length === 0 && (
        <Empty icon={SearchX} title="Nada encontrado neste raio">
          Tente aumentar o raio de busca ou usar outras palavras.
          {radius < 10 && (
            <div className="mt">
              <button className="btn outline sm" onClick={() => update({ raio: radiusOptions[Math.min(radiusOptions.length - 1, radiusIndex + 1)] })}>
                Ampliar para {String(radiusOptions[Math.min(radiusOptions.length - 1, radiusIndex + 1)]).replace('.', ',')} km
              </button>
            </div>
          )}
        </Empty>
      )}
```

Nenhum resultado: sugere ampliar o raio com um botão que já passa para a próxima opção.

**Linhas 185 a 191**

```jsx
      {results && results.length > 0 && (
        <div className="offer-list" style={{ opacity: loading ? 0.6 : 1 }}>
          {results.map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
        </div>
      )}
```

A lista de cartões. Durante uma nova busca, os resultados antigos ficam esmaecidos em vez de sumirem.

**Linhas 193 a 206**

```jsx
      {showLocation && (
        <LocationDialog
          current={position}
          pilot={meta.pilot}
          onClose={() => setShowLocation(false)}
          onSave={(p) => {
            setPosition(p)
            setShowLocation(false)
          }}
        />
      )}
    </div>
  )
}
```

O diálogo de escolha do ponto de busca.

---

## `web/src/pages/OfferDetail.jsx`

Detalhe da oferta, com o botão de conversar.

**Linhas 1 a 9**

```jsx
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Flag, Lock, MapPin, MessageCircle, Package, Pencil, Sparkles, Wrench } from 'lucide-react'
import { api, qs } from '../api.js'
import { ReportDialog } from '../components/ReportDialog.jsx'
import { Avatar, ErrorBox, Loading, Stars, useLoad } from '../components/ui.jsx'
import { plural, priceRange, since } from '../format.js'
import { usePosition } from '../position.js'
import { useSession } from '../session.jsx'
```

Importações.

**Linhas 11 a 22**

```jsx
export default function OfferDetail() {
  const { id } = useParams()
  const { user, meta } = useSession()
  const navigate = useNavigate()
  const [position] = usePosition(meta?.pilot)
  const [report, setReport] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const { data, error: loadError, loading } = useLoad(
    () => api(`/offers/${id}?${qs({ lat: position?.lat, lng: position?.lng })}`),
    [id, position?.lat, position?.lng],
  )
```

Carrega a oferta enviando o ponto de busca do morador, para o servidor calcular a distância.

**Linhas 24 a 27**

```jsx
  if (loading && !data) return <Loading />
  if (loadError) return <ErrorBox error={loadError} />
  const { offer, isOwner, conversationId } = data
  const Icon = offer.kind === 'produto' ? Package : Wrench
```

Carregando, erro e os dados recebidos. O ícone muda entre produto e serviço.

**Linhas 29 a 40**

```jsx
  async function contact() {
    if (!user) return navigate('/entrar', { state: { from: `/oferta/${id}` } })
    if (conversationId) return navigate(`/conversas/${conversationId}`)
    setBusy(true)
    try {
      const r = await api('/conversations', { method: 'POST', body: { offerId: offer.id } })
      navigate(`/conversas/${r.conversationId}`)
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }
```

**Conversar com o prestador**: sem login, vai para a entrada e volta para cá depois; com conversa já existente, abre a conversa; senão, cria e abre.

**Linhas 42 a 46**

```jsx
  return (
    <div>
      <button className="btn ghost sm mb" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Voltar
      </button>
```

Botão de voltar.

**Linhas 48 a 77**

```jsx
      {offer.images.length > 0 ? (
        <div className="gallery">
          {offer.images.map((src) => (
            <img key={src} src={src} alt="" />
          ))}
        </div>
      ) : (
        <div className="hero-placeholder">
          <Icon size={48} strokeWidth={1.4} />
        </div>
      )}

      <div className="row wrap mb">
        <span className="badge primary">{offer.categoryName}</span>
        <span className="badge">{offer.kind === 'produto' ? 'Produto' : 'Serviço'}</span>
        {offer.highlighted && (
          <span className="badge accent">
            <Sparkles size={12} /> Destaque
          </span>
        )}
      </div>
      <h1>{offer.title}</h1>
      <div className="row wrap gap-lg mb">
        {offer.distance && (
          <span className="distance">
            <MapPin size={16} /> {offer.distance.label} de você
          </span>
        )}
        <span className="strong">{priceRange(offer)}</span>
      </div>
```

Galeria de fotos rolável (ou um fundo com ícone, sem fotos), as etiquetas (categoria, tipo, destaque), o título, a **distância aproximada** e o preço.

**Linhas 79 a 84**

```jsx
      {offer.outsideServiceArea && (
        <div className="notice warn mb">
          <MapPin size={18} />
          <span>Você está além do raio de atendimento informado pelo prestador ({String(offer.serviceRadiusKm).replace('.', ',')} km). Combine pelo chat.</span>
        </div>
      )}
```

Aviso quando o morador está além do raio de atendimento do prestador, sugerindo combinar pelo chat.

**Linhas 86 a 94**

```jsx
      {offer.description && <p style={{ whiteSpace: 'pre-wrap' }}>{offer.description}</p>}

      <div className="notice mb">
        <Lock size={18} />
        <span className="small">
          O endereço do prestador não é divulgado. A negociação acontece pelo chat do ConectaBairro, sem troca de telefone, e fica registrada para a
          segurança dos dois lados.
        </span>
      </div>
```

A descrição, preservando as quebras de linha, e o aviso de privacidade: endereço não divulgado, negociação pelo chat, sem troca de telefone.

**Linhas 96 a 106**

```jsx
      <Link to={`/prestador/${offer.provider.id}`} className="card row" style={{ color: 'inherit' }}>
        <Avatar name={offer.provider.name} />
        <div className="grow">
          <div className="strong">{offer.provider.name}</div>
          <div className="small muted">No ConectaBairro desde {since(offer.provider.memberSince)}</div>
          <div className="row wrap small mt" style={{ marginTop: 4 }}>
            <Stars value={offer.reputation.avgRating} count={offer.reputation.reviews} />
            <span className="muted">· {plural(offer.reputation.concluded, 'serviço concluído', 'serviços concluídos')}</span>
          </div>
        </div>
      </Link>
```

Cartão do prestador com link para o perfil: nome, desde quando está na plataforma, estrelas e serviços concluídos (RF12).

**Linhas 108 a 119**

```jsx
      <ErrorBox error={error} />
      <div className="row mt-lg">
        {isOwner ? (
          <Link to={`/painel/ofertas/${offer.id}`} className="btn block">
            <Pencil size={18} /> Editar minha oferta
          </Link>
        ) : (
          <button className="btn block" onClick={contact} disabled={busy}>
            <MessageCircle size={18} /> {conversationId ? 'Abrir conversa' : 'Conversar com o prestador'}
          </button>
        )}
      </div>
```

O botão principal: "Editar minha oferta" para o dono, "Conversar" ou "Abrir conversa" para os demais.

**Linhas 120 a 130**

```jsx
      {user && !isOwner && (
        <div className="center mt">
          <button className="btn ghost sm" onClick={() => setReport(true)}>
            <Flag size={14} /> Denunciar esta oferta
          </button>
        </div>
      )}
      {report && <ReportDialog targetType="oferta" targetId={offer.id} onClose={() => setReport(false)} />}
    </div>
  )
}
```

Link de denúncia para usuários logados (RF15).

---

## `web/src/pages/ProviderProfile.jsx`

Perfil público do prestador (RF12).

**Linhas 1 a 10**

```jsx
// RF12: histórico de reputação do prestador.
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Flag, MessageSquareQuote } from 'lucide-react'
import { api } from '../api.js'
import { OfferCard } from '../components/OfferCard.jsx'
import { ReportDialog } from '../components/ReportDialog.jsx'
import { Avatar, Empty, ErrorBox, Loading, Stars, Stat, useLoad } from '../components/ui.jsx'
import { date, since } from '../format.js'
import { useSession } from '../session.jsx'
```

Comentário e importações.

**Linhas 12 a 20**

```jsx
export default function ProviderProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useSession()
  const [report, setReport] = useState(false)
  const { data, error, loading } = useLoad(() => api(`/providers/${id}`), [id])
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  const { provider, reputation, offers, reviews } = data
```

Carrega o perfil pelo id da URL.

**Linhas 22 a 34**

```jsx
  return (
    <div>
      <button className="btn ghost sm mb" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Voltar
      </button>
      <div className="row gap-lg mb">
        <Avatar name={provider.name} size="lg" />
        <div className="grow">
          <h1 style={{ marginBottom: 2 }}>{provider.name}</h1>
          <div className="small muted">No ConectaBairro desde {since(provider.memberSince)}</div>
        </div>
      </div>
      {provider.bio && <p>{provider.bio}</p>}
```

Cabeçalho com iniciais, nome e data de entrada, e a apresentação escrita pelo prestador.

**Linhas 36 a 43**

```jsx
      <div className="grid stats">
        <Stat label="Serviços concluídos" value={reputation.concluded} />
        <Stat label="Avaliação média" value={reputation.avgRating !== null ? String(reputation.avgRating).replace('.', ',') : '-'} sub={`${reputation.reviews} avaliações`} />
      </div>

      <div className="section-title">
        <h2>Ofertas</h2>
      </div>
```

Os dois números da reputação: serviços concluídos e avaliação média, com a quantidade de avaliações.

**Linhas 44 a 56**

```jsx
      {offers.length ? (
        <div className="offer-list">
          {offers.map((o) => (
            <OfferCard key={o.id} offer={{ ...o, provider: { name: provider.name } }} />
          ))}
        </div>
      ) : (
        <p className="muted">Nenhuma oferta ativa no momento.</p>
      )}

      <div className="section-title">
        <h2>Avaliações de clientes</h2>
      </div>
```

As ofertas ativas do prestador.

**Linhas 57 a 74**

```jsx
      {reviews.length === 0 ? (
        <Empty icon={MessageSquareQuote} title="Ainda sem avaliações" />
      ) : (
        <div className="stack">
          {reviews.map((r, i) => (
            <div className="card tight" key={i}>
              <div className="row between">
                <Stars value={r.rating} />
                <span className="tiny muted">{date(r.createdAt)}</span>
              </div>
              {r.comment && <p className="mt" style={{ marginBottom: 4 }}>{r.comment}</p>}
              <div className="tiny muted row">
                <CheckCircle2 size={12} /> {r.reviewerName} contratou "{r.offerTitle}" pela plataforma
              </div>
            </div>
          ))}
        </div>
      )}
```

As avaliações, cada uma com nota, data, comentário e o selo "contratou pela plataforma". Só quem fechou contratação pelo sistema pode avaliar, então toda avaliação vem de um serviço real.

**Linhas 75 a 85**

```jsx
      {user && user.id !== provider.id && (
        <div className="center mt-lg">
          <button className="btn ghost sm" onClick={() => setReport(true)}>
            <Flag size={14} /> Denunciar perfil
          </button>
        </div>
      )}
      {report && <ReportDialog targetType="usuario" targetId={provider.id} onClose={() => setReport(false)} />}
    </div>
  )
}
```

Denúncia do perfil, para usuários logados que não sejam o próprio prestador.

---

## `web/src/pages/Conversations.jsx`

Lista de conversas.

**Linhas 1 a 7**

```jsx
import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { api } from '../api.js'
import { Thumb } from '../components/OfferCard.jsx'
import { Empty, ErrorBox, Loading, useLoad } from '../components/ui.jsx'
import { relative } from '../format.js'
import { useRealtime } from '../session.jsx'
```

Importações.

**Linhas 9 a 13**

```jsx
export default function Conversations() {
  const { data, error, loading, reload } = useLoad(() => api('/conversations'), [])
  useRealtime((ev) => ev === 'message' && reload())
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} />
```

Carrega a lista e recarrega quando chega uma mensagem nova em tempo real.

**Linhas 14 a 44**

```jsx
  return (
    <div>
      <h1>Conversas</h1>
      {data.conversations.length === 0 ? (
        <Empty icon={MessageCircle} title="Nenhuma conversa ainda">
          Encontre um serviço na busca e toque em "Conversar com o prestador".
        </Empty>
      ) : (
        <div className="list">
          {data.conversations.map((c) => (
            <Link key={c.id} to={`/conversas/${c.id}`} className={`list-item ${c.unread ? 'unread' : ''}`}>
              <Thumb offer={{ images: c.offerImage ? [c.offerImage] : [] }} size={48} />
              <div className="grow">
                <div className="row between">
                  <span className="strong ellipsis">{c.otherName}</span>
                  <span className="tiny muted nowrap">{relative(c.lastMessageAt)}</span>
                </div>
                <div className="small muted ellipsis">{c.offerTitle}</div>
                <div className="row between">
                  <span className="small ellipsis">{c.lastBody || 'Conversa iniciada'}</span>
                  {c.unread > 0 && <span className="badge accent">{c.unread}</span>}
                </div>
              </div>
              {c.contractStatusLabel && <span className="badge primary">{c.contractStatusLabel}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

Sem conversas, uma orientação de como começar. Com conversas, cada item mostra a foto da oferta, o nome da outra pessoa, há quanto tempo foi a última mensagem, o título da oferta, a prévia da última mensagem, quantas não foram lidas e o estado da contratação. Itens com mensagens não lidas ficam destacados.

---

## `web/src/pages/Chat.jsx`

O chat (RF07) com toda a negociação: solicitação, proposta e aceite (RF08), estados (RF09), conclusão com comissão (RF10) e avaliação (RF11). Os diálogos menores estão no próprio arquivo.

**Linhas 1 a 10**

```jsx
// RF07 a RF11 numa única tela: chat interno, proposta e aceite, estados da contratação,
// conclusão com comissão e avaliação mútua.
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Flag, Loader2, Play, Receipt, Send, ShieldAlert, X } from 'lucide-react'
import { api } from '../api.js'
import { ReportDialog } from '../components/ReportDialog.jsx'
import { Avatar, ErrorBox, Loading, Modal, StarInput, useLoad } from '../components/ui.jsx'
import { brl, firstName, localYmd, time, ymdToBr } from '../format.js'
import { useRealtime, useSession } from '../session.jsx'
```

Comentário e importações.

**Linhas 12 a 23**

```jsx
const STEPS = ['solicitada', 'proposta_enviada', 'aceita', 'em_andamento', 'concluida']

function Progress({ status }) {
  const idx = status === 'cancelada' ? STEPS.length : STEPS.indexOf(status)
  return (
    <div className={`steps ${status === 'cancelada' ? 'cancelled' : ''}`}>
      {STEPS.map((s, i) => (
        <span key={s} className={i <= idx ? 'on' : ''} />
      ))}
    </div>
  )
}
```

`Progress`: barra de progresso com os cinco estados do caminho normal. Cancelada pinta tudo de vermelho.

**Linhas 25 a 65**

```jsx
function ProposalForm({ onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [deadline, setDeadline] = useState(localYmd(new Date(Date.now() + 2 * 86400000)))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  return (
    <Modal title="Enviar proposta" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await onSubmit({ amount, deadline, notes })
            onClose()
          } catch (err) {
            setError(err)
            setBusy(false)
          }
        }}
      >
        <label className="field">
          <span>Valor total (R$)</span>
          <input className="input" inputMode="decimal" placeholder="150,00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ''))} autoFocus />
        </label>
        <label className="field">
          <span>Prazo de entrega</span>
          <input className="input" type="date" value={deadline} min={localYmd()} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <label className="field">
          <span>Observações (opcional)</span>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="O que está incluído, forma de entrega..." />
        </label>
        <ErrorBox error={error} />
        <button className="btn block" disabled={busy || !amount}>
          Enviar proposta
        </button>
      </form>
    </Modal>
  )
}
```

**Diálogo de proposta** (prestador): valor (o filtro só deixa digitar números, vírgula e ponto), prazo (por padrão daqui a 2 dias, sem permitir datas passadas) e observações.
Se o servidor recusar, o erro aparece no próprio diálogo.

**Linhas 67 a 98**

```jsx
function RequestForm({ offerTitle, onSubmit, onClose }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  return (
    <Modal title="Solicitar serviço" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await onSubmit(note)
            onClose()
          } catch (err) {
            setError(err)
            setBusy(false)
          }
        }}
      >
        <p className="small muted">Descreva o que você precisa em "{offerTitle}". O prestador responde com valor e prazo.</p>
        <label className="field">
          <span>Pedido</span>
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Ex.: bolo de chocolate para 20 pessoas no sábado" autoFocus />
        </label>
        <ErrorBox error={error} />
        <button className="btn block" disabled={busy}>
          Solicitar
        </button>
      </form>
    </Modal>
  )
}
```

**Diálogo de solicitação** (contratante): descreve o que precisa; o prestador responde com valor e prazo.

**Linhas 100 a 132**

```jsx
function ReviewBox({ contract, onDone }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  return (
    <div className="card mt">
      <h3>Avalie {firstName(contract.counterpart.name)}</h3>
      <p className="small muted">
        {contract.side === 'client' ? 'Como foi o serviço?' : 'Como foi atender este cliente?'} A avaliação é recíproca e ajuda o bairro a confiar.
      </p>
      <StarInput value={rating} onChange={setRating} />
      <textarea className="input mt" placeholder="Comentário (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      <ErrorBox error={error} />
      <button
        className="btn block mt"
        disabled={!rating || busy}
        onClick={async () => {
          setBusy(true)
          try {
            await api(`/contracts/${contract.id}/review`, { method: 'POST', body: { rating, comment } })
            onDone()
          } catch (err) {
            setError(err)
            setBusy(false)
          }
        }}
      >
        Enviar avaliação
      </button>
    </div>
  )
}
```

**Caixa de avaliação** (RF11), que aparece no fim do chat após a conclusão. O texto muda conforme quem avalia (o serviço ou o cliente). Envia nota e comentário.

**Linhas 134 a 144**

```jsx
export default function Chat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast, refreshUnread } = useSession()
  const { data, error, loading, reload, setData } = useLoad(() => api(`/conversations/${id}`), [id])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [modal, setModal] = useState(null)
  const [acting, setActing] = useState('')
  const [maskedNotice, setMaskedNotice] = useState(false)
  const bodyRef = useRef(null)
```

Estados da tela: dados da conversa, texto digitado, envio em andamento, diálogo aberto, ação em andamento e o aviso de contato removido. `bodyRef` aponta para a área das mensagens.

**Linhas 146 a 150**

```jsx
  const markRead = () => api(`/conversations/${id}/read`, { method: 'POST' }).then(refreshUnread).catch(() => {})

  useEffect(() => {
    markRead()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
```

Marca a conversa como lida ao abrir e atualiza o sino.

**Linhas 152 a 154**

```jsx
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [data?.messages?.length, data?.contract?.status, data?.contract?.canReview])
```

Rola até o fim quando chega mensagem nova ou quando a contratação muda (por exemplo, para mostrar a caixa de avaliação).

**Linhas 156 a 163**

```jsx
  useRealtime((ev, payload) => {
    if (String(payload.conversationId) !== String(id)) return
    if (ev === 'message') {
      setData((d) => (d && !d.messages.some((m) => m.id === payload.id) ? { ...d, messages: [...d.messages, payload] } : d))
      markRead()
    }
    if (ev === 'contract') reload()
  })
```

**Tempo real.** Ignora eventos de outras conversas. Mensagem nova é acrescentada à lista (se ainda não estiver nela, porque quem enviou já a recebeu na resposta do envio) e a conversa é marcada como lida. Mudança na contratação recarrega os dados.

**Linhas 165 a 167**

```jsx
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} />
  const { conversation: conv, messages, contract, canRequest } = data
```

Carregando, erro e os dados.

**Linhas 169 a 183**

```jsx
  async function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    try {
      const r = await api(`/conversations/${id}/messages`, { method: 'POST', body: { body: text } })
      setData((d) => (d.messages.some((m) => m.id === r.message.id) ? d : { ...d, messages: [...d.messages, r.message] }))
      setText('')
      if (r.message.masked) setMaskedNotice(true)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSending(false)
    }
  }
```

Envia a mensagem. Se o servidor removeu dados de contato, mostra o aviso explicando por quê.

**Linhas 185 a 196**

```jsx
  async function act(action, confirmText) {
    if (confirmText) return setModal({ type: 'confirm', action, text: confirmText })
    setActing(action)
    try {
      await api(`/contracts/${contract.id}/actions`, { method: 'POST', body: { action } })
      await reload()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActing('')
    }
  }
```

Executa uma ação da contratação. Ações sérias (concluir, cancelar) passam primeiro por um diálogo de confirmação próprio. O `window.confirm` do navegador não é usado porque bloqueia a página e destoa do visual no celular.

**Linhas 198 a 199**

```jsx
  const pendingProposal = contract?.proposals?.find((p) => p.status === 'pendente')
  const can = (a) => contract?.actions?.includes(a)
```

A proposta pendente (que pode receber "Aceitar" ou "Recusar") e o atalho `can`, que consulta as ações liberadas pelo servidor.

**Linhas 201 a 219**

```jsx
  return (
    <div className="chat">
      <div className="chat-head">
        <button className="icon-btn" onClick={() => navigate('/conversas')} aria-label="Voltar">
          <ArrowLeft size={20} />
        </button>
        <Avatar name={conv.other.name} />
        <div className="grow">
          <div className="strong ellipsis">
            {conv.other.isProvider ? <Link to={`/prestador/${conv.other.id}`}>{conv.other.name}</Link> : conv.other.name}
          </div>
          <Link to={`/oferta/${conv.offerId}`} className="small muted ellipsis" style={{ display: 'block' }}>
            {conv.offerTitle}
          </Link>
        </div>
        <button className="icon-btn" onClick={() => setModal({ type: 'report-user' })} aria-label="Denunciar">
          <Flag size={18} />
        </button>
      </div>
```

Cabeçalho: voltar, iniciais e nome da outra pessoa (com link para o perfil, se for prestador), título da oferta e botão de denúncia.

**Linhas 221 a 266**

```jsx
      {contract && (
        <div className="contract-bar">
          <div className="row between">
            <span className="strong small">Contratação: {contract.statusLabel}</span>
            {contract.amountCents && (
              <span className="small">
                {brl(contract.amountCents)} · até {ymdToBr(contract.deadline)}
              </span>
            )}
          </div>
          <Progress status={contract.status} />
          <div className="row wrap" style={{ marginTop: 8 }}>
            {can('propor') && (
              <button className="btn sm" onClick={() => setModal({ type: 'proposal' })}>
                {contract.status === 'proposta_enviada' ? 'Nova proposta' : 'Enviar proposta'}
              </button>
            )}
            {can('iniciar') && (
              <button className="btn sm" onClick={() => act('iniciar')} disabled={!!acting}>
                <Play size={14} /> Iniciar serviço
              </button>
            )}
            {can('concluir') && (
              <button className="btn sm" onClick={() => act('concluir', 'Confirmar a conclusão do serviço? A comissão de 6% será apurada.')} disabled={!!acting}>
                <Check size={14} /> Marcar como concluído
              </button>
            )}
            {contract.status === 'concluida' && (
              <Link to={`/comprovante/${contract.id}`} className="btn sm outline">
                <Receipt size={14} /> Comprovante
              </Link>
            )}
            {can('cancelar') && (
              <button className="btn sm ghost" onClick={() => act('cancelar', 'Cancelar esta contratação?')} disabled={!!acting}>
                Cancelar
              </button>
            )}
            {canRequest && contract && (
              <button className="btn sm outline" onClick={() => setModal({ type: 'request' })}>
                Nova solicitação
              </button>
            )}
            {acting && <Loader2 size={16} className="spin" />}
          </div>
        </div>
      )}
```

**Barra da contratação**: estado, valor e prazo, progresso e os botões que valem para esta pessoa agora (enviar ou refazer proposta, iniciar, concluir, comprovante, cancelar, nova solicitação).
Os botões dependem da lista `actions` calculada pelo servidor, então a tela nunca oferece uma ação que o servidor recusaria.

**Linhas 268 a 273**

```jsx
      <div className="chat-body" ref={bodyRef}>
        <div className="sys-msg">
          Conversa protegida: telefones, e-mails e links são removidos automaticamente. Combine tudo por aqui.
        </div>
        {messages.map((m) => {
          if (m.kind === 'sistema') return <div key={m.id} className="sys-msg">{m.body}</div>
```

Área das mensagens, começando com o lembrete de que contatos são removidos automaticamente. Mensagens de sistema aparecem centralizadas.

**Linhas 274 a 300**

```jsx
          if (m.kind === 'proposta' && m.proposal) {
            const p = m.proposal
            const live = pendingProposal && pendingProposal.id === p.id
            return (
              <div key={m.id} className="proposal-card">
                <div className="row between">
                  <span className="small strong">{m.senderId === conv.me ? 'Sua proposta' : `Proposta de ${firstName(conv.other.name)}`}</span>
                  <span className={`badge ${p.status === 'aceita' ? 'ok' : p.status === 'pendente' ? 'accent' : ''}`}>
                    {{ pendente: 'Aguardando resposta', aceita: 'Aceita', recusada: 'Recusada', substituida: 'Substituída' }[p.status]}
                  </span>
                </div>
                <div className="amount">{brl(p.amountCents)}</div>
                <div className="small">Prazo: {ymdToBr(p.deadline)}</div>
                {p.notes && <div className="small mt" style={{ marginTop: 4 }}>{p.notes}</div>}
                {live && conv.side === 'client' && (
                  <div className="row mt">
                    <button className="btn sm" onClick={() => act('aceitar')} disabled={!!acting}>
                      <Check size={14} /> Aceitar
                    </button>
                    <button className="btn sm ghost" onClick={() => act('recusar')} disabled={!!acting}>
                      <X size={14} /> Recusar
                    </button>
                  </div>
                )}
              </div>
            )
          }
```

**Cartão de proposta**: quem propôs, situação, valor, prazo e observações. Os botões "Aceitar" e "Recusar" só aparecem para o contratante e só na proposta pendente.

**Linhas 301 a 308**

```jsx
          const mine = m.senderId === conv.me
          return (
            <div key={m.id} className={`bubble ${mine ? 'mine' : ''} ${m.masked ? 'masked' : ''}`}>
              {m.body}
              <span className="when">{time(m.createdAt)}</span>
            </div>
          )
        })}
```

Balões de mensagem: os próprios à direita, em verde; os da outra pessoa à esquerda. Mensagens que tiveram contato removido ganham contorno tracejado.

**Linhas 309 a 313**

```jsx
        {contract?.canReview && <ReviewBox contract={contract} onDone={() => { showToast('Avaliação enviada. Obrigado!', 'ok'); reload() }} />}
        {contract?.status === 'concluida' && contract.myReview && (
          <div className="sys-msg">Você avaliou com nota {contract.myReview.rating}.</div>
        )}
      </div>
```

A caixa de avaliação, quando liberada, e a confirmação da nota já dada.

**Linhas 315 a 325**

```jsx
      {maskedNotice && (
        <div className="notice warn" style={{ marginTop: 8 }}>
          <ShieldAlert size={18} />
          <span className="small grow">
            Removemos dados de contato da sua mensagem. Negociar pela plataforma garante o registro, a avaliação e a sua segurança.
          </span>
          <button className="icon-btn" onClick={() => setMaskedNotice(false)} aria-label="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      )}
```

Aviso de que dados de contato foram removidos, explicando a vantagem de negociar pela plataforma.

**Linhas 327 a 331**

```jsx
      {canRequest && !contract && (
        <button className="btn accent block" style={{ marginTop: 8 }} onClick={() => setModal({ type: 'request' })}>
          Solicitar este serviço
        </button>
      )}
```

O botão "Solicitar este serviço", em destaque, quando ainda não há contratação.

**Linhas 333 a 338**

```jsx
      <form className="chat-input" onSubmit={send}>
        <input className="input" placeholder="Escreva uma mensagem" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
        <button className="btn" disabled={sending || !text.trim()} aria-label="Enviar">
          <Send size={18} />
        </button>
      </form>
```

Campo de mensagem e botão de enviar.

**Linhas 340 a 382**

```jsx
      {modal?.type === 'proposal' && (
        <ProposalForm
          onClose={() => setModal(null)}
          onSubmit={async (body) => {
            await api(`/contracts/${contract.id}/proposals`, { method: 'POST', body })
            await reload()
          }}
        />
      )}
      {modal?.type === 'request' && (
        <RequestForm
          offerTitle={conv.offerTitle}
          onClose={() => setModal(null)}
          onSubmit={async (note) => {
            await api(`/conversations/${id}/contracts`, { method: 'POST', body: { note } })
            await reload()
          }}
        />
      )}
      {modal?.type === 'confirm' && (
        <Modal title="Confirmar" onClose={() => setModal(null)}>
          <p>{modal.text}</p>
          <div className="row">
            <button className="btn ghost grow" onClick={() => setModal(null)}>
              Voltar
            </button>
            <button
              className="btn grow"
              onClick={() => {
                const { action } = modal
                setModal(null)
                act(action)
              }}
            >
              Confirmar
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === 'report-user' && <ReportDialog targetType="usuario" targetId={conv.other.id} onClose={() => setModal(null)} />}
    </div>
  )
}
```

Os diálogos: proposta, solicitação, confirmação de ação e denúncia do usuário. Cada um recarrega os dados da conversa depois de concluído.

---
