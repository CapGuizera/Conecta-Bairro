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

**Linhas 59 a 66**

```jsx
  return (
    <div className="login">
      <div className="card">
        <span className="sign login-sign">
          <small>Sorocaba</small>
          ConectaBairro
        </span>
        <p className="muted mt">Quem faz, vende e conserta pertinho da sua casa.</p>
```

Cartão central com a placa de rua grande e a frase do projeto, escrita do jeito que se fala.

**Linhas 68 a 86**

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
              <span className="hint">A gente manda um código pra confirmar que o número é seu. Não pedimos CNPJ nem documento.</span>
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn block" disabled={busy || phone.replace(/\D/g, '').length < 10}>
              {busy && <Loader2 size={18} className="spin" />} Mandar código
            </button>
```

**Passo 1**: campo de celular com formatação automática e `inputMode="tel"` (abre o teclado numérico no celular). O texto de ajuda reforça que não há pedido de CNPJ nem de documentos. O botão só é liberado com pelo menos 10 dígitos.

**Linhas 87 a 108**

```jsx
            {meta?.demoAccounts?.length > 0 && (
              <div className="mt-lg">
                <div className="small strong">Entrar como alguém do bairro de teste</div>
                <div className="tiny muted">Pra apresentação: o código aparece aqui mesmo, sem SMS.</div>
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

**Linhas 110 a 140**

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
                  Seu código é <strong>{devCode}</strong>. Na versão de verdade ele chega por SMS.
                </span>
              </div>
            )}
            <label className="field">
              <span>Código que chegou no celular</span>
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
              {busy && <Loader2 size={18} className="spin" />} Entrar
            </button>
          </form>
        )}
```

**Passo 2**: botão para voltar e corrigir o número, aviso com o código no modo demonstração e campo de 6 dígitos. `autoComplete="one-time-code"` permite que o celular sugira o código recebido por SMS automaticamente.

**Linhas 142 a 166**

```jsx
        {step === 'name' && (
          <form onSubmit={verify}>
            <h2>Primeira vez por aqui?</h2>
            <label className="field">
              <span>Como você quer ser chamado?</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus autoComplete="name" />
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={isProvider} onChange={(e) => setIsProvider(e.target.checked)} />
              <span>
                <strong>Também quero anunciar meu trabalho</strong>
                <br />
                <span className="small muted">Os vizinhos só veem a que distância você está. Seu endereço fica com a gente.</span>
              </span>
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn block mt" disabled={busy || !name.trim()}>
              {busy && <Loader2 size={18} className="spin" />} Criar conta
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

**Linhas 1 a 12**

```jsx
// RF05 (busca por categoria e necessidade) e RF06 (filtro por raio), ordenados por distância.
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, Lock, MapPin, Search, SearchX } from 'lucide-react'
import { api, qs } from '../api.js'
import { LocationDialog } from '../components/LocationDialog.jsx'
import { RadiusMap } from '../components/Maps.jsx'
import { OfferCard } from '../components/OfferCard.jsx'
import { catStyle, categoryIcon } from '../categories.jsx'
import { Empty, ErrorBox } from '../components/ui.jsx'
import { SOURCE_LABEL, geolocationAvailable, getCurrentPosition, usePosition } from '../position.js'
import { useSession } from '../session.jsx'
```

Comentário e importações.

**Linhas 14 a 23**

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

**Linhas 25 a 39**

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

**Linhas 41 a 43**

```jsx
  const category = params.get('categoria') || ''
  const q = params.get('q') || ''
  const radius = Number(params.get('raio')) || 2
```

Lê os filtros da URL; o raio padrão é 2 km.

**Linhas 45 a 52**

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

**Linhas 54 a 73**

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

**Linhas 75 a 81**

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

**Linhas 83 a 88**

```jsx
  if (!position) return null

  return (
    <div>
      <h1>{user ? `Oi, ${user.name.split(' ')[0]}! Do que você precisa?` : 'Do que você precisa hoje?'}</h1>
      <p className="muted small">Gente do bairro que faz, vende e conserta. Tudo a uma caminhada de você.</p>
```

Saudação com o primeiro nome quando logado.

**Linhas 90 a 109**

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
          placeholder="Bolo de aniversário, chuveiro queimado, barra de calça..."
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

**Linhas 111 a 129**

```jsx
      <div className="chips">
        <button className={`chip ${!category ? 'on' : ''}`} onClick={() => update({ categoria: '' })}>
          Todas
        </button>
        {meta?.categories.map((c) => {
          const Icon = categoryIcon(c.slug)
          return (
            <button
              key={c.slug}
              className={`chip cat ${category === c.slug ? 'on' : ''}`}
              style={catStyle(c.slug)}
              onClick={() => update({ categoria: category === c.slug ? '' : c.slug })}
            >
              <Icon size={15} />
              {c.name}
            </button>
          )
        })}
      </div>
```

As categorias como botões roláveis na horizontal, cada uma com o seu ícone na cor da categoria. A escolhida fica preenchida com essa cor. Tocar de novo na categoria escolhida volta para "Todas".

**Linhas 131 a 144**

```jsx
      <div className="card tight">
        <div className="row">
          <MapPin size={18} color="var(--accent)" />
          <div className="grow">
            <div className="small strong">{SOURCE_LABEL[position.source] || 'Ponto de busca'}</div>
            <div className="tiny muted">Até {String(radius).replace('.', ',')} km daqui</div>
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

**Linhas 145 a 159**

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

**Linhas 160 a 168**

```jsx
        {showMap && (
          <div className="mt">
            <RadiusMap position={position} radiusKm={radius} onPick={(p) => setPosition({ ...p, source: 'mapa' })} />
            <div className="row tiny muted mt">
              <Lock size={12} /> O mapa mostra só você. Onde cada pessoa mora fica guardado; aqui aparece apenas a distância.
            </div>
          </div>
        )}
      </div>
```

O mapa do raio com o aviso: "o mapa não mostra onde os prestadores moram". Clicar no mapa muda o ponto de busca.

**Linhas 170 a 173**

```jsx
      <div className="section-title">
        <h2>{heading}</h2>
        {results && !loading && <span className="small muted">{results.length === 1 ? '1 resultado' : `${results.length} resultados`}</span>}
      </div>
```

Título da lista e quantidade de resultados.

**Linhas 175 a 182**

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

**Linhas 183 a 194**

```jsx
      {results && results.length === 0 && (
        <Empty icon={SearchX} title="Ninguém por perto com isso ainda">
          Tenta aumentar a distância ou escrever de outro jeito.
          {radius < 10 && (
            <div className="mt">
              <button className="btn outline sm" onClick={() => update({ raio: radiusOptions[Math.min(radiusOptions.length - 1, radiusIndex + 1)] })}>
                Procurar até {String(radiusOptions[Math.min(radiusOptions.length - 1, radiusIndex + 1)]).replace('.', ',')} km
              </button>
            </div>
          )}
        </Empty>
      )}
```

Nenhum resultado: sugere ampliar o raio com um botão que já passa para a próxima opção.

**Linhas 195 a 201**

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

**Linhas 203 a 216**

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

Detalhe da oferta (o "anúncio", como aparece na tela), com o botão de chamar no chat.

**Linhas 1 a 10**

```jsx
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Flag, Lock, MapPin, Megaphone, MessageCircle, Pencil } from 'lucide-react'
import { catStyle, categoryIcon } from '../categories.jsx'
import { api, qs } from '../api.js'
import { ReportDialog } from '../components/ReportDialog.jsx'
import { Avatar, ErrorBox, Loading, Stars, useLoad } from '../components/ui.jsx'
import { plural, priceRange, since } from '../format.js'
import { usePosition } from '../position.js'
import { useSession } from '../session.jsx'
```

Importações.

**Linhas 12 a 23**

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

**Linhas 25 a 28**

```jsx
  if (loading && !data) return <Loading />
  if (loadError) return <ErrorBox error={loadError} />
  const { offer, isOwner, conversationId } = data
  const Icon = categoryIcon(offer.category)
```

Carregando, erro e os dados recebidos. O ícone muda entre produto e serviço.

**Linhas 30 a 41**

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

**Chamar no chat**: sem login, vai para a entrada e volta para cá depois; com conversa já existente, abre a conversa; senão, cria e abre.

**Linhas 43 a 47**

```jsx
  return (
    <div>
      <button className="btn ghost sm mb" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Voltar
      </button>
```

Botão de voltar.

**Linhas 49 a 80**

```jsx
      {offer.images.length > 0 ? (
        <div className="gallery">
          {offer.images.map((src) => (
            <img key={src} src={src} alt="" />
          ))}
        </div>
      ) : (
        <div className="hero-placeholder cat" style={catStyle(offer.category)}>
          <Icon size={48} strokeWidth={1.4} />
        </div>
      )}

      <div className="row wrap mb">
        <span className="badge cat" style={catStyle(offer.category)}>
          {offer.categoryName}
        </span>
        <span className="badge">{offer.kind === 'produto' ? 'Produto' : 'Serviço'}</span>
        {offer.highlighted && (
          <span className="badge accent">
            <Megaphone size={12} /> Destaque
          </span>
        )}
      </div>
      <h1>{offer.title}</h1>
      <div className="row wrap gap-lg mb">
        {offer.distance && (
          <span className="distance">
            <MapPin size={16} /> a {offer.distance.label} de você
          </span>
        )}
        <span className="strong">{priceRange(offer)}</span>
      </div>
```

Galeria de fotos rolável (ou um fundo com ícone, sem fotos), as etiquetas (categoria, tipo, destaque), o título, a **distância aproximada** e o preço.

**Linhas 82 a 87**

```jsx
      {offer.outsideServiceArea && (
        <div className="notice warn mb">
          <MapPin size={18} />
          <span>Você está um pouco longe: {offer.provider.name.split(' ')[0]} atende até {String(offer.serviceRadiusKm).replace('.', ',')} km. Vale perguntar no chat.</span>
        </div>
      )}
```

Aviso quando o morador está além do raio de atendimento do prestador, sugerindo combinar pelo chat.

**Linhas 89 a 97**

```jsx
      {offer.description && <p style={{ whiteSpace: 'pre-wrap' }}>{offer.description}</p>}

      <div className="notice mb">
        <Lock size={18} />
        <span className="small">
          O endereço de {offer.provider.name.split(' ')[0]} não aparece aqui. Vocês combinam tudo pelo chat, sem precisar trocar telefone, e fica
          tudo registrado se der algum problema.
        </span>
      </div>
```

A descrição, preservando as quebras de linha, e o aviso de privacidade: endereço não divulgado, negociação pelo chat, sem troca de telefone.

**Linhas 99 a 109**

```jsx
      <Link to={`/prestador/${offer.provider.id}`} className="card row" style={{ color: 'inherit' }}>
        <Avatar name={offer.provider.name} />
        <div className="grow">
          <div className="strong">{offer.provider.name}</div>
          <div className="small muted">Está no ConectaBairro desde {since(offer.provider.memberSince)}</div>
          <div className="row wrap small mt" style={{ marginTop: 4 }}>
            <Stars value={offer.reputation.avgRating} count={offer.reputation.reviews} />
            <span className="muted">· {plural(offer.reputation.concluded, 'serviço concluído', 'serviços concluídos')}</span>
          </div>
        </div>
      </Link>
```

Cartão do prestador com link para o perfil: nome, desde quando está na plataforma, estrelas e serviços concluídos (RF12).

**Linhas 111 a 122**

```jsx
      <ErrorBox error={error} />
      <div className="row mt-lg">
        {isOwner ? (
          <Link to={`/painel/ofertas/${offer.id}`} className="btn block">
            <Pencil size={18} /> Editar meu anúncio
          </Link>
        ) : (
          <button className="btn block" onClick={contact} disabled={busy}>
            <MessageCircle size={18} /> {conversationId ? 'Continuar a conversa' : `Chamar ${offer.provider.name.split(' ')[0]} no chat`}
          </button>
        )}
      </div>
```

O botão principal: "Editar meu anúncio" para o dono, "Chamar <nome> no chat" ou "Continuar a conversa" para os demais.

**Linhas 123 a 133**

```jsx
      {user && !isOwner && (
        <div className="center mt">
          <button className="btn ghost sm" onClick={() => setReport(true)}>
            <Flag size={14} /> Tem algo errado neste anúncio?
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
import { ArrowLeft, BadgeCheck, CheckCircle2, Flag, MessageSquareQuote, Star } from 'lucide-react'
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
          <div className="small muted">Está no ConectaBairro desde {since(provider.memberSince)}</div>
        </div>
      </div>
      {provider.bio && <p>{provider.bio}</p>}
```

Cabeçalho com iniciais, nome e data de entrada, e a apresentação escrita pelo prestador.

**Linhas 36 a 43**

```jsx
      <div className="grid stats">
        <Stat icon={BadgeCheck} tone="green" label="Serviços feitos pela plataforma" value={reputation.concluded} />
        <Stat icon={Star} tone="yellow" label="Nota dos clientes" value={reputation.avgRating !== null ? String(reputation.avgRating).replace('.', ',') : '-'} sub={`${reputation.reviews} avaliações`} />
      </div>

      <div className="section-title">
        <h2>Anúncios</h2>
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
        <p className="muted">Nenhum anúncio no ar agora.</p>
      )}

      <div className="section-title">
        <h2>O que os clientes falaram</h2>
      </div>
```

As ofertas ativas do prestador.

**Linhas 57 a 74**

```jsx
      {reviews.length === 0 ? (
        <Empty icon={MessageSquareQuote} title="Ainda ninguém avaliou" />
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
                <CheckCircle2 size={12} /> {r.reviewerName} contratou "{r.offerTitle}" por aqui
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
            <Flag size={14} /> Denunciar este perfil
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
          Quando você chamar alguém (ou alguém te chamar), a conversa aparece aqui.
        </Empty>
      ) : (
        <div className="list">
          {data.conversations.map((c) => (
            <Link key={c.id} to={`/conversas/${c.id}`} className={`list-item ${c.unread ? 'unread' : ''}`}>
              <Thumb offer={{ images: c.offerImage ? [c.offerImage] : [], category: c.offerCategory }} size={48} />
              <div className="grow">
                <div className="row between">
                  <span className="strong ellipsis">{c.otherName}</span>
                  <span className="tiny muted nowrap">{relative(c.lastMessageAt)}</span>
                </div>
                <div className="small muted ellipsis">{c.offerTitle}</div>
                <div className="row between">
                  <span className="small ellipsis">{c.lastBody || 'Conversa começou'}</span>
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
    <Modal title="Mandar orçamento" onClose={onClose}>
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
          <span>Fica pronto até</span>
          <input className="input" type="date" value={deadline} min={localYmd()} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <label className="field">
          <span>Observações (opcional)</span>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="O que está incluso, se entrega ou busca..." />
        </label>
        <ErrorBox error={error} />
        <button className="btn block" disabled={busy || !amount}>
          Mandar orçamento
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
    <Modal title="Pedir orçamento" onClose={onClose}>
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
        <p className="small muted">Conta o que você precisa de "{offerTitle}". A resposta vem com preço e prazo.</p>
        <label className="field">
          <span>O que você precisa</span>
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Bolo de chocolate pra 20 pessoas, sábado de manhã" autoFocus />
        </label>
        <ErrorBox error={error} />
        <button className="btn block" disabled={busy}>
          Pedir orçamento
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
      <h3>Como foi com {firstName(contract.counterpart.name)}?</h3>
      <p className="small muted">
        Os dois se avaliam. É isso que ajuda os vizinhos a saber em quem confiar.
      </p>
      <StarInput value={rating} onChange={setRating} />
      <textarea className="input mt" placeholder="Quer deixar um comentário? (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
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
        Avaliar
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

A proposta pendente (que pode receber "Fechar negócio" ou "Recusar") e o atalho `can`, que consulta as ações liberadas pelo servidor.

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
            <span className="strong small">{contract.statusLabel}</span>
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
                {contract.status === 'proposta_enviada' ? 'Refazer orçamento' : 'Mandar orçamento'}
              </button>
            )}
            {can('iniciar') && (
              <button className="btn sm" onClick={() => act('iniciar')} disabled={!!acting}>
                <Play size={14} /> Comecei o serviço
              </button>
            )}
            {can('concluir') && (
              <button className="btn sm" onClick={() => act('concluir', 'Marcar como concluído? A taxa da plataforma é de 6% e o comprovante sai na hora.')} disabled={!!acting}>
                <Check size={14} /> Terminei
              </button>
            )}
            {contract.status === 'concluida' && (
              <Link to={`/comprovante/${contract.id}`} className="btn sm outline">
                <Receipt size={14} /> Comprovante
              </Link>
            )}
            {can('cancelar') && (
              <button className="btn sm ghost" onClick={() => act('cancelar', 'Cancelar? A outra pessoa vai ser avisada.')} disabled={!!acting}>
                Cancelar
              </button>
            )}
            {canRequest && contract && (
              <button className="btn sm outline" onClick={() => setModal({ type: 'request' })}>
                Pedir outro orçamento
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
          Por segurança, telefone, e-mail e links somem das mensagens. Combinem tudo por aqui.
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
                  <span className="small strong">{m.senderId === conv.me ? 'Seu orçamento' : `Orçamento de ${firstName(conv.other.name)}`}</span>
                  <span className={`badge ${p.status === 'aceita' ? 'ok' : p.status === 'pendente' ? 'accent' : ''}`}>
                    {{ pendente: 'Esperando resposta', aceita: 'Aceito', recusada: 'Recusado', substituida: 'Trocado por outro' }[p.status]}
                  </span>
                </div>
                <div className="amount">{brl(p.amountCents)}</div>
                <div className="small">Pronto até {ymdToBr(p.deadline)}</div>
                {p.notes && <div className="small mt" style={{ marginTop: 4 }}>{p.notes}</div>}
                {live && conv.side === 'client' && (
                  <div className="row mt">
                    <button className="btn sm" onClick={() => act('aceitar')} disabled={!!acting}>
                      <Check size={14} /> Fechar negócio
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

**Cartão de proposta**: quem propôs, situação, valor, prazo e observações. Os botões "Fechar negócio" (aceitar) e "Recusar" só aparecem para o contratante e só na proposta pendente.

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

Balões de mensagem: os próprios à direita, em azul; os da outra pessoa à esquerda. Mensagens que tiveram contato removido ganham contorno tracejado.

**Linhas 309 a 313**

```jsx
        {contract?.canReview && <ReviewBox contract={contract} onDone={() => { showToast('Valeu pela avaliação!', 'ok'); reload() }} />}
        {contract?.status === 'concluida' && contract.myReview && (
          <div className="sys-msg">Você deu {contract.myReview.rating} {contract.myReview.rating === 1 ? 'estrela' : 'estrelas'}.</div>
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
            Tiramos o contato da sua mensagem. Negociando por aqui fica tudo registrado e vocês podem se avaliar depois.
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
          Pedir orçamento
        </button>
      )}
```

O botão "Pedir orçamento", em destaque, quando ainda não há contratação.

**Linhas 333 a 338**

```jsx
      <form className="chat-input" onSubmit={send}>
        <input className="input" placeholder="Escreve aqui..." value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
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
        <Modal title="Tem certeza?" onClose={() => setModal(null)}>
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
              Sim
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
