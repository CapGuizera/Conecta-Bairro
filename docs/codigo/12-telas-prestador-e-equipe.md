# 12. Telas: contratações, prestador, perfil e equipe

As telas de acompanhamento (contratações, comprovante, notificações, perfil), as do prestador (painel e formulário de oferta)
e as da equipe do projeto (cadastro de campo, moderação e indicadores).

## `web/src/pages/Contracts.jsx`

Lista de contratações, em abas.

**Linhas 1 a 9**

```jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { api } from '../api.js'
import { Empty, ErrorBox, Loading, useLoad } from '../components/ui.jsx'
import { brl, relative, ymdToBr } from '../format.js'
import { useRealtime } from '../session.jsx'

const TONE = { solicitada: 'warn', proposta_enviada: 'accent', aceita: 'primary', em_andamento: 'primary', concluida: 'ok', cancelada: '' }
```

Importações e a cor da etiqueta de cada estado.

**Linhas 11 a 19**

```jsx
export default function Contracts() {
  const [tab, setTab] = useState('abertas')
  const { data, error, loading, reload } = useLoad(() => api('/contracts'), [])
  useRealtime((ev) => ev === 'contract' && reload())
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} />
  const list = data.contracts.filter((c) =>
    tab === 'abertas' ? !['concluida', 'cancelada'].includes(c.status) : tab === 'concluidas' ? c.status === 'concluida' : c.status === 'cancelada',
  )
```

Carrega a lista (e recarrega a cada mudança em tempo real) e filtra pela aba escolhida: rolando (em aberto), concluídas ou canceladas. Na navegação esta tela se chama "Serviços".

**Linhas 20 a 61**

```jsx
  return (
    <div>
      <h1>Meus serviços</h1>
      <div className="tabs">
        {[
          ['abertas', 'Rolando'],
          ['concluidas', 'Concluídas'],
          ['canceladas', 'Canceladas'],
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty icon={ClipboardList} title="Nada por aqui">
          Tudo começa no chat, quando alguém pede um orçamento.
        </Empty>
      ) : (
        <div className="list">
          {list.map((c) => (
            <Link key={c.id} to={`/conversas/${c.conversationId}`} className="list-item">
              <div className="grow">
                <div className="row between">
                  <span className="strong ellipsis">{c.offerTitle}</span>
                  <span className={`badge ${TONE[c.status]}`}>{c.statusLabel}</span>
                </div>
                <div className="small muted">
                  {c.side === 'client' ? 'Com' : 'Para'} {c.counterpart.name}
                </div>
                <div className="row between small">
                  <span>{c.amountCents ? `${brl(c.amountCents)} · pronto até ${ymdToBr(c.deadline)}` : 'Esperando o orçamento'}</span>
                  <span className="tiny muted">{relative(c.updatedAt)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

As abas e a lista. Cada item mostra a oferta, o estado, a outra parte (prestador ou cliente, conforme o lado), valor e prazo ou "Aguardando proposta", e há quanto tempo mudou. Tocar abre a conversa.

---

## `web/src/pages/Receipt.jsx`

Comprovante da contratação concluída (RF10).

**Linhas 1 a 6**

```jsx
// RF10: comprovante da contratação concluída, com apuração da comissão.
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { api } from '../api.js'
import { ErrorBox, Loading, useLoad } from '../components/ui.jsx'
import { brl, dateTime, ymdToBr } from '../format.js'
```

Comentário e importações.

**Linhas 8 a 14**

```jsx
export default function Receipt() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, error, loading } = useLoad(() => api(`/contracts/${id}/receipt`), [id])
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  const r = data.receipt
```

Carrega o comprovante; o servidor só o entrega às duas partes.

**Linhas 15 a 24**

```jsx
  return (
    <div className="receipt">
      <div className="row between no-print mb">
        <button className="btn ghost sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <button className="btn outline sm" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir ou salvar PDF
        </button>
      </div>
```

Botões de voltar e de imprimir. "Imprimir ou salvar PDF" usa a impressão do navegador (`window.print()`), que permite salvar em PDF. O CSS de impressão esconde a navegação e os botões (`no-print`).

**Linhas 25 a 79**

```jsx
      <div className="card">
        <div className="row mb">
          <img src="/icon.svg" alt="" width={40} height={40} style={{ borderRadius: 10 }} />
          <div>
            <div className="strong">ConectaBairro</div>
            <div className="small muted">Comprovante de serviço</div>
          </div>
        </div>
        <div className="line">
          <span className="muted">Código</span>
          <span className="code strong">{r.receiptCode}</span>
        </div>
        <div className="line">
          <span className="muted">Emitido em</span>
          <span>{dateTime(r.issuedAt)}</span>
        </div>
        <div className="line">
          <span className="muted">Serviço</span>
          <span className="strong" style={{ textAlign: 'right' }}>{r.offerTitle}</span>
        </div>
        <div className="line">
          <span className="muted">Prestador</span>
          <span>{r.providerName}</span>
        </div>
        <div className="line">
          <span className="muted">Contratante</span>
          <span>{r.clientName}</span>
        </div>
        <div className="line">
          <span className="muted">Combinado para</span>
          <span>{ymdToBr(r.deadline)}</span>
        </div>
        <div className="line">
          <span className="muted">Concluído em</span>
          <span>{dateTime(r.concludedAt)}</span>
        </div>
        <div className="line mt">
          <span>Valor do serviço</span>
          <span>{brl(r.grossCents)}</span>
        </div>
        <div className="line">
          <span>Taxa do ConectaBairro ({(r.rate * 100).toLocaleString('pt-BR')}%)</span>
          <span>- {brl(r.commissionCents)}</span>
        </div>
        <div className="line total">
          <span>Fica para quem fez</span>
          <span>{brl(r.netCents)}</span>
        </div>
        <p className="tiny muted mt">
          Contratação nº {r.contractId}. Este é um protótipo do projeto UPX IV da FACENS: nenhum valor foi cobrado de verdade.
        </p>
      </div>
    </div>
  )
}
```

O comprovante: código, emissão, serviço, partes, prazo e conclusão; em seguida o valor do serviço, a comissão de 6% e o valor líquido do prestador. A nota final deixa claro que, por ser um protótipo acadêmico, não há cobrança real.

---

## `web/src/pages/Dashboard.jsx`

Painel do prestador (RF14), com o plano de destaque (RF13) e a confirmação de atividade (RF16).

**Linhas 1 a 10**

```jsx
// RF14 (painel do prestador), RF13 (plano de destaque) e RF16 (confirmação de atividade).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, ClipboardList, Eye, HandCoins, MapPin, Megaphone, MessageCircle, Pause, Pencil, Play, Plus, QrCode } from 'lucide-react'
import { api } from '../api.js'
import { Thumb } from '../components/OfferCard.jsx'
import { ProviderLocation } from '../components/ProviderLocation.jsx'
import { Bars, Empty, ErrorBox, Loading, Modal, Stat, Stars, useLoad } from '../components/ui.jsx'
import { brl, date, plural, priceRange } from '../format.js'
import { useSession } from '../session.jsx'
```

Comentário e importações.

**Linhas 12 a 57**

```jsx
function HighlightDialog({ offer, onClose, onDone }) {
  const { meta } = useSession()
  const [plan, setPlan] = useState('semanal')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const chosen = meta.highlightPlans.find((p) => p.id === plan)
  return (
    <Modal title="Destacar anúncio" onClose={onClose}>
      <p className="small muted">
        "{offer.title}" aparece em primeiro pra quem procura <strong>{offer.categoryName}</strong>, com a etiqueta Destaque, pelo tempo que você
        escolher.
      </p>
      <div className="stack">
        {meta.highlightPlans.map((p) => (
          <label key={p.id} className={`card tight row ${plan === p.id ? '' : 'flat'}`} style={{ cursor: 'pointer', borderColor: plan === p.id ? 'var(--accent)' : undefined }}>
            <input type="radio" name="plan" checked={plan === p.id} onChange={() => setPlan(p.id)} style={{ accentColor: 'var(--accent)' }} />
            <span className="grow">
              <span className="strong">{p.name}</span>
              <span className="small muted"> · {p.days} dias</span>
            </span>
            <span className="strong">{brl(p.priceCents)}</span>
          </label>
        ))}
      </div>
      {offer.highlightUntil && <p className="small mt">Já está em destaque até {date(offer.highlightUntil)}. O tempo novo é somado depois disso.</p>}
      <ErrorBox error={error} />
      <button
        className="btn accent block mt"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await api('/highlights', { method: 'POST', body: { offerId: offer.id, plan } })
            onDone()
          } catch (err) {
            setError(err)
            setBusy(false)
          }
        }}
      >
        <QrCode size={18} /> Pagar {brl(chosen.priceCents)} no PIX (simulado)
      </button>
      <p className="tiny muted center mt">No protótipo o PIX é de mentirinha e aprova na hora.</p>
    </Modal>
  )
}
```

**Diálogo de destaque**: explica o efeito (topo da busca na categoria, com etiqueta), lista os planos como opções e avisa quando o destaque atual será prolongado.
O botão mostra o valor e deixa claro que o PIX é simulado.

**Linhas 59 a 65**

```jsx
export default function Dashboard() {
  const { location, showToast } = useSession()
  const [days, setDays] = useState(30)
  const [editingLocation, setEditingLocation] = useState(false)
  const [highlight, setHighlight] = useState(null)
  const dash = useLoad(() => api(`/my/dashboard?days=${days}`), [days])
  const offers = useLoad(() => api('/my/offers'), [])
```

Estados: período do painel, edição do ponto de atendimento e oferta sendo destacada. Carrega o painel (que depende do período) e as ofertas.

**Linhas 67 a 75**

```jsx
  if (!location.hasLocation || editingLocation) {
    return (
      <div>
        <h1>Seu painel</h1>
        {!location.hasLocation && <p className="muted">Antes de anunciar, marca de onde você atende.</p>}
        <ProviderLocation onSaved={() => setEditingLocation(false)} onCancel={location.hasLocation ? () => setEditingLocation(false) : undefined} />
      </div>
    )
  }
```

Sem ponto de atendimento definido, o painel mostra primeiro o cartão "Onde você atende?". O mesmo cartão aparece ao clicar em alterar o raio.

**Linhas 76 a 81**

```jsx
  if ((dash.loading && !dash.data) || (offers.loading && !offers.data)) return <Loading />
  if (dash.error || offers.error) return <ErrorBox error={dash.error || offers.error} />

  const d = dash.data
  const myOffers = offers.data.offers
  const stale = myOffers.filter((o) => o.needsConfirmation && o.status === 'ativa')
```

Carregando, erro e o cálculo das ofertas que precisam de confirmação (RF16).

**Linhas 83 a 96**

```jsx
  async function setStatus(o, status) {
    try {
      await api(`/offers/${o.id}/status`, { method: 'PATCH', body: { status } })
      offers.reload()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  async function confirmAll() {
    await api('/my/offers/confirm-all', { method: 'POST' })
    showToast('Pronto! Seus anúncios continuam no ar.', 'ok')
    offers.reload()
  }
```

Pausar ou reativar uma oferta, e confirmar todas as ofertas de uma vez.

**Linha 98**

```jsx
  const series = d.series.map((s) => ({ ...s, label: s.day.split('-').reverse().slice(0, 2).join('/') }))
```

Prepara as datas do gráfico no formato dia/mês.

**Linhas 100 a 107**

```jsx
  return (
    <div>
      <div className="row between wrap">
        <h1 style={{ margin: 0 }}>Seu painel</h1>
        <Link to="/painel/ofertas/nova" className="btn">
          <Plus size={18} /> Novo anúncio
        </Link>
      </div>
```

Título e botão "Novo anúncio".

**Linhas 109 a 120**

```jsx
      {stale.length > 0 && (
        <div className="notice warn mt">
          <AlertTriangle size={18} />
          <div className="grow small">
            <strong>{stale.length === 1 ? 'Um anúncio está' : `${stale.length} anúncios estão`} há um tempo sem confirmação.</strong> Sem confirmar, ele sai
            da busca em 45 dias, pra ninguém chamar quem já parou.
          </div>
          <button className="btn sm" onClick={confirmAll}>
            <BadgeCheck size={14} /> Ainda estou atendendo
          </button>
        </div>
      )}
```

**Alerta de confirmação** (RF16): quantas ofertas precisam ser confirmadas e o aviso de que saem da busca aos 45 dias, com o botão "Ainda estou atendendo".

**Linhas 122 a 130**

```jsx
      {(d.pending.awaitingProposal > 0 || d.pending.inProgress > 0) && (
        <Link to="/contratacoes" className="notice accent mt" style={{ color: 'inherit' }}>
          <ClipboardList size={18} />
          <span className="small">
            {d.pending.awaitingProposal > 0 && <strong>{plural(d.pending.awaitingProposal, 'pessoa esperando', 'pessoas esperando')} seu orçamento. </strong>}
            {d.pending.inProgress > 0 && <span>{plural(d.pending.inProgress, 'serviço em andamento', 'serviços em andamento')}.</span>}
          </span>
        </Link>
      )}
```

Alerta de pedidos aguardando proposta e serviços em andamento, com link para as contratações.

**Linhas 132 a 141**

```jsx
      <div className="row between wrap mt-lg mb">
        <h2 style={{ margin: 0 }}>Como você está indo</h2>
        <div className="segmented">
          {[7, 30, 90].map((n) => (
            <button key={n} className={days === n ? 'on' : ''} onClick={() => setDays(n)}>
              {n} dias
            </button>
          ))}
        </div>
      </div>
```

Seletor de período: 7, 30 ou 90 dias.

**Linhas 142 a 153**

```jsx
      <div className="grid stats">
        <Stat label="Pessoas que viram" value={d.totals.views} icon={Eye} />
        <Stat label="Te chamaram no chat" icon={MessageCircle} tone="orange" value={d.totals.contacts} sub={plural(d.totals.requests, 'pediu orçamento', 'pediram orçamento')} />
        <Stat
          label="Serviços feitos"
          icon={BadgeCheck}
          tone="green"
          value={d.totals.concluded}
          sub={d.totals.conversion <= 100 ? `${String(d.totals.conversion).replace('.', ',')}% de quem chamou` : 'tem cliente voltando!'}
        />
        <Stat label="Você recebeu" icon={HandCoins} tone="yellow" value={brl(d.revenue.net)} sub={`de ${brl(d.revenue.gross)}, já tirando ${brl(d.revenue.commission)} de taxa`} />
      </div>
```

Os quatro números do RF14, cada um com ícone e cor próprios, com nomes do dia a dia: "Pessoas que viram" (visualizações), "Te chamaram no chat" (contatos, com quantos pediram orçamento), "Serviços feitos" e "Você recebeu" (o líquido, com o bruto e a taxa).
A porcentagem de conversão só aparece até 100%: ela passa disso quando o mesmo cliente volta a contratar na mesma conversa, e aí a tela comemora ("tem cliente voltando!") em vez de mostrar um número que confunde.

**Linhas 154 a 160**

```jsx
      <div className="card mt">
        <div className="row between">
          <h3 style={{ margin: 0 }}>Dia a dia</h3>
          <Stars value={d.rating.avg} count={d.rating.count} />
        </div>
        <Bars data={series} a="views" b="contacts" labelA="Viram o anúncio" labelB="Chamaram" />
      </div>
```

O gráfico diário de visualizações e contatos e a avaliação média.

**Linhas 162 a 167**

```jsx
      <div className="section-title">
        <h2>Seus anúncios</h2>
        <button className="btn ghost sm" onClick={() => setEditingLocation(true)}>
          <MapPin size={14} /> Atendo até {String(location.serviceRadiusKm).replace('.', ',')} km
        </button>
      </div>
```

Cabeçalho da lista de ofertas, com o raio de atendimento atual (tocar abre a edição).

**Linhas 168 a 202**

```jsx
      {myOffers.length === 0 ? (
        <Empty icon={Plus} title="Que tal colocar o primeiro anúncio?">
          <Link to="/painel/ofertas/nova" className="btn mt">
            Anunciar
          </Link>
        </Empty>
      ) : (
        <div className="stack">
          {myOffers.map((o) => {
            const stats = d.perOffer.find((p) => p.id === o.id)
            return (
              <div key={o.id} className="card tight">
                <div className="row" style={{ alignItems: 'flex-start' }}>
                  <Thumb offer={o} size={64} />
                  <div className="grow">
                    <div className="row wrap">
                      {o.status === 'pausada' ? <span className="badge">Pausada</span> : <span className="badge ok">No ar</span>}
                      {o.highlighted && (
                        <span className="badge accent">
                          <Megaphone size={12} /> Destaque até {date(o.highlightUntil)}
                        </span>
                      )}
                      {o.needsConfirmation && o.status === 'ativa' && <span className="badge warn">Falta confirmar</span>}
                    </div>
                    <Link to={`/oferta/${o.id}`} className="strong" style={{ color: 'var(--ink)', display: 'block', marginTop: 4 }}>
                      {o.title}
                    </Link>
                    <div className="small muted">{priceRange(o)}</div>
                    {stats && (
                      <div className="tiny muted row wrap" style={{ marginTop: 4 }}>
                        <Eye size={12} /> {stats.views} viram · {stats.contacts} chamaram · {stats.concluded} feitos · {brl(stats.gross)}
                      </div>
                    )}
                  </div>
                </div>
```

Sem ofertas, um convite para criar a primeira. Com ofertas, um cartão para cada uma com etiquetas (ativa ou pausada, destaque até quando, precisa confirmar), título, preço e os números da oferta no período.

**Linhas 203 a 237**

```jsx
                <div className="row wrap mt">
                  <Link to={`/painel/ofertas/${o.id}`} className="btn sm ghost">
                    <Pencil size={14} /> Editar
                  </Link>
                  {o.status === 'ativa' ? (
                    <button className="btn sm ghost" onClick={() => setStatus(o, 'pausada')}>
                      <Pause size={14} /> Pausar
                    </button>
                  ) : (
                    <button className="btn sm ghost" onClick={() => setStatus(o, 'ativa')}>
                      <Play size={14} /> Reativar
                    </button>
                  )}
                  {o.needsConfirmation && o.status === 'ativa' && (
                    <button
                      className="btn sm outline"
                      onClick={async () => {
                        await api(`/offers/${o.id}/confirm`, { method: 'POST' })
                        offers.reload()
                      }}
                    >
                      <BadgeCheck size={14} /> Ainda atendo
                    </button>
                  )}
                  {o.status === 'ativa' && (
                    <button className="btn sm accent" onClick={() => setHighlight(o)}>
                      <Megaphone size={14} /> Destacar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
```

Ações de cada oferta: editar, pausar ou reativar, confirmar (quando necessário) e destacar.

**Linhas 239 a 252**

```jsx
      {highlight && (
        <HighlightDialog
          offer={highlight}
          onClose={() => setHighlight(null)}
          onDone={() => {
            setHighlight(null)
            showToast('Pronto, seu anúncio está em destaque!', 'ok')
            offers.reload()
          }}
        />
      )}
    </div>
  )
}
```

O diálogo de destaque, que recarrega a lista ao concluir.

---

## `web/src/pages/OfferForm.jsx`

Formulário de nova oferta e de edição (RF02). O mesmo componente atende `/painel/ofertas/nova` e `/painel/ofertas/:id`.

**Linhas 1 a 11**

```jsx
// RF02: cadastro e edição de oferta.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import { api } from '../api.js'
import { ImagePicker } from '../components/ImagePicker.jsx'
import { ErrorBox, Loading, Modal } from '../components/ui.jsx'
import { useSession } from '../session.jsx'

const UNITS = ['a combinar', 'por serviço', 'por hora', 'por dia', 'por unidade', 'por peça', 'por encomenda', 'por kg', 'por m²', 'por atendimento']
const cents = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','))
```

Comentário, importações, as unidades de preço oferecidas e a conversão de centavos para o texto do campo (`3500` vira `35,00`).

**Linhas 13 a 22**

```jsx
export default function OfferForm() {
  const { id } = useParams()
  const editing = id && id !== 'nova'
  const navigate = useNavigate()
  const { meta, showToast } = useSession()
  const [form, setForm] = useState({ kind: 'servico', title: '', description: '', category: '', priceMin: '', priceMax: '', priceUnit: 'a combinar', images: [] })
  const [loading, setLoading] = useState(editing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
```

Descobre se é edição pelo endereço e cria o estado do formulário, já com valores padrão.

**Linhas 24 a 41**

```jsx
  useEffect(() => {
    if (!editing) return
    api(`/offers/${id}`)
      .then(({ offer: o }) =>
        setForm({
          kind: o.kind,
          title: o.title,
          description: o.description,
          category: o.category,
          priceMin: cents(o.priceMinCents),
          priceMax: cents(o.priceMaxCents),
          priceUnit: o.priceUnit,
          images: o.images,
        }),
      )
      .catch(setError)
      .finally(() => setLoading(false))
  }, [id, editing])
```

Na edição, carrega a oferta e preenche o formulário.

**Linha 43**

```jsx
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))
```

Função genérica para atualizar um campo: aceita tanto o evento de um campo do formulário quanto um valor direto.

**Linhas 45 a 57**

```jsx
  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await api(editing ? `/offers/${id}` : '/offers', { method: editing ? 'PUT' : 'POST', body: form })
      showToast(editing ? 'Anúncio atualizado' : 'Seu anúncio já está no ar pro bairro!', 'ok')
      navigate(`/oferta/${r.offer.id}`, { replace: true })
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }
```

Salva (`PUT` na edição, `POST` na criação) e abre a página da oferta. `replace` evita que o "voltar" retorne ao formulário.

**Linhas 59 a 67**

```jsx
  if (loading) return <Loading />

  return (
    <div style={{ maxWidth: 640 }}>
      <button className="btn ghost sm mb" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Voltar
      </button>
      <h1>{editing ? 'Editar anúncio' : 'Novo anúncio'}</h1>
      <form onSubmit={submit} className="card">
```

Título da tela.

**Linhas 68 a 75**

```jsx
        <div className="segmented mb">
          <button type="button" className={form.kind === 'servico' ? 'on' : ''} onClick={() => set('kind')('servico')}>
            Serviço
          </button>
          <button type="button" className={form.kind === 'produto' ? 'on' : ''} onClick={() => set('kind')('produto')}>
            Produto
          </button>
        </div>
```

Seleção entre serviço e produto.

**Linhas 76 a 95**

```jsx
        <label className="field">
          <span>O que você faz ou vende</span>
          <input className="input" value={form.title} onChange={set('title')} maxLength={80} placeholder="Bolos caseiros por encomenda" required />
        </label>
        <label className="field">
          <span>Categoria</span>
          <select className="input" value={form.category} onChange={set('category')} required>
            <option value="">Escolha uma...</option>
            {meta.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Conta mais</span>
          <textarea className="input" value={form.description} onChange={set('description')} maxLength={1500} placeholder="Sabores, como funciona, quanto tempo leva..." />
          <span className="hint">Não precisa colocar telefone nem endereço: quem se interessar te chama no chat.</span>
        </label>
```

Título, categoria (lista vinda do servidor) e descrição, com o lembrete de não colocar telefone nem endereço.

**Linhas 96 a 113**

```jsx
        <div className="grid two">
          <label className="field">
            <span>A partir de (R$)</span>
            <input className="input" inputMode="decimal" value={form.priceMin} onChange={(e) => set('priceMin')(e.target.value.replace(/[^\d,.]/g, ''))} placeholder="se quiser" />
          </label>
          <label className="field">
            <span>Até (R$)</span>
            <input className="input" inputMode="decimal" value={form.priceMax} onChange={(e) => set('priceMax')(e.target.value.replace(/[^\d,.]/g, ''))} placeholder="opcional" />
          </label>
        </div>
        <label className="field">
          <span>Cobrado</span>
          <select className="input" value={form.priceUnit} onChange={set('priceUnit')}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
```

Faixa de preço e unidade. Os campos de preço aceitam só números, vírgula e ponto; o servidor faz a conversão para centavos.

**Linhas 114 a 117**

```jsx
        <div className="field">
          <span>Fotos (até 4, se quiser)</span>
          <ImagePicker images={form.images} onChange={set('images')} />
        </div>
```

Até 4 fotos.

**Linhas 118 a 127**

```jsx
        <ErrorBox error={error} />
        <button className="btn block" disabled={busy}>
          {busy && <Loader2 size={18} className="spin" />} {editing ? 'Salvar' : 'Anunciar'}
        </button>
        {editing && (
          <button type="button" className="btn danger block mt" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> Apagar anúncio
          </button>
        )}
      </form>
```

Erro, botão de salvar e, na edição, o botão de excluir.

**Linhas 128 a 150**

```jsx
      {confirmDelete && (
        <Modal title="Apagar este anúncio?" onClose={() => setConfirmDelete(false)}>
          <p>Ele some da busca. As conversas e os serviços que já aconteceram continuam no seu histórico.</p>
          <div className="row">
            <button className="btn ghost grow" onClick={() => setConfirmDelete(false)}>
              Voltar
            </button>
            <button
              className="btn danger grow"
              onClick={async () => {
                await api(`/offers/${id}/status`, { method: 'PATCH', body: { status: 'removida' } })
                showToast('Anúncio apagado')
                navigate('/painel', { replace: true })
              }}
            >
              Apagar
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
```

Confirmação da exclusão, explicando que conversas e contratações continuam no histórico (a exclusão é lógica).

---

## `web/src/pages/Notifications.jsx`

Central de notificações (RF17).

**Linhas 1 a 10**

```jsx
// RF17
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellRing, CheckCheck, ClipboardList, Megaphone, MessageCircle, ShieldCheck, Star } from 'lucide-react'
import { api } from '../api.js'
import { Empty, ErrorBox, Loading, useLoad } from '../components/ui.jsx'
import { relative } from '../format.js'
import { useSession } from '../session.jsx'

const ICONS = { mensagem: MessageCircle, conversa: MessageCircle, proposta: ClipboardList, contratacao: ClipboardList, avaliacao: Star, destaque: Megaphone, confirmacao: BellRing, moderacao: ShieldCheck }
```

Comentário, importações e o ícone de cada tipo de notificação.

**Linhas 12 a 18**

```jsx
export default function Notifications() {
  const navigate = useNavigate()
  const { setUnread, unread } = useSession()
  const { data, error, loading, reload } = useLoad(() => api('/notifications'), [])
  useEffect(() => {
    reload()
  }, [unread]) // eslint-disable-line react-hooks/exhaustive-deps
```

Carrega a lista e recarrega quando chega uma notificação nova (o número de não lidas muda).

**Linhas 20 a 30**

```jsx
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} />

  async function open(n) {
    if (!n.readAt) {
      const r = await api(`/notifications/${n.id}/read`, { method: 'POST' })
      setUnread(r.unread)
    }
    if (n.link) navigate(n.link)
    else reload()
  }
```

Ao tocar numa notificação: marca como lida e abre a tela ligada a ela.

**Linhas 32 a 48**

```jsx
  return (
    <div>
      <div className="row between">
        <h1 style={{ margin: 0 }}>Avisos</h1>
        {data.unread > 0 && (
          <button
            className="btn ghost sm"
            onClick={async () => {
              await api('/notifications/read-all', { method: 'POST' })
              setUnread(0)
              reload()
            }}
          >
            <CheckCheck size={16} /> Já vi tudo
          </button>
        )}
      </div>
```

Título ("Avisos") e o botão "Já vi tudo", quando há não lidas.

**Linhas 49 a 57**

```jsx
      {'Notification' in window && Notification.permission === 'default' && (
        <div className="notice mt">
          <BellRing size={18} />
          <span className="grow small">Quer ser avisado no celular quando chegar mensagem ou orçamento?</span>
          <button className="btn sm" onClick={() => Notification.requestPermission().then(reload)}>
            Quero
          </button>
        </div>
      )}
```

Se o navegador permite notificações e a pessoa ainda não decidiu, oferece ativar os avisos do sistema operacional. O pedido de permissão só acontece com o toque no botão, pois os navegadores bloqueiam pedidos automáticos.

**Linhas 58 a 85**

```jsx
      <div className="mt">
        {data.notifications.length === 0 ? (
          <Empty icon={Bell} title="Nada novo por aqui" />
        ) : (
          <div className="list">
            {data.notifications.map((n) => {
              const Icon = ICONS[n.kind] || Bell
              return (
                <button key={n.id} className={`list-item ${n.readAt ? '' : 'unread'}`} onClick={() => open(n)}>
                  <div className="avatar">
                    <Icon size={20} />
                  </div>
                  <div className="grow">
                    <div className="row between">
                      <span className="strong">{n.title}</span>
                      <span className="tiny muted nowrap">{relative(n.createdAt)}</span>
                    </div>
                    {n.body && <div className="small muted">{n.body}</div>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

A lista, com ícone, título, tempo e texto. Não lidas ficam destacadas.

---

## `web/src/pages/Profile.jsx`

Perfil do usuário, atalhos por perfil, questionário de satisfação, instalação do aplicativo e saída.

**Linhas 1 a 9**

```jsx
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, ClipboardList, Download, LayoutDashboard, LogOut, ShieldCheck, Smile } from 'lucide-react'
import { api } from '../api.js'
import { Avatar, ErrorBox, Modal, StarInput } from '../components/ui.jsx'
import { since } from '../format.js'
import { useSession } from '../session.jsx'

const ROLE = { usuario: null, agente: 'Agente de campo', moderador: 'Moderação', instituicao: 'Parceiro do projeto' }
```

Importações e o nome de cada perfil especial.

**Linhas 11 a 61**

```jsx
// Plano de aplicação, etapa 3: questionário estruturado de satisfação.
function SatisfactionDialog({ group, onClose, onDone }) {
  const [score, setScore] = useState(0)
  const [ease, setEase] = useState(0)
  const [willContinue, setWillContinue] = useState(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState(null)
  return (
    <Modal title="O que você está achando?" onClose={onClose}>
      <p className="small muted">São três perguntas. Sua resposta ajuda a gente a melhorar o projeto.</p>
      <div className="field">
        <span>No geral, está gostando?</span>
        <StarInput value={score} onChange={setScore} />
      </div>
      <div className="field">
        <span>Foi fácil de usar?</span>
        <StarInput value={ease} onChange={setEase} />
      </div>
      <div className="field">
        <span>Vai continuar usando?</span>
        <div className="segmented">
          <button type="button" className={willContinue === true ? 'on' : ''} onClick={() => setWillContinue(true)}>
            Sim
          </button>
          <button type="button" className={willContinue === false ? 'on' : ''} onClick={() => setWillContinue(false)}>
            Não
          </button>
        </div>
      </div>
      <label className="field">
        <span>Quer falar mais alguma coisa? (opcional)</span>
        <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={800} />
      </label>
      <ErrorBox error={error} />
      <button
        className="btn block"
        disabled={!score || !ease || willContinue === null}
        onClick={async () => {
          try {
            await api('/satisfaction', { method: 'POST', body: { group, score, ease, willContinue, comment } })
            onDone()
          } catch (err) {
            setError(err)
          }
        }}
      >
        Enviar
      </button>
    </Modal>
  )
}
```

**Questionário de satisfação** (etapa 3 da Tabela 5): satisfação geral e facilidade com estrelas, intenção de continuar (sim ou não) e comentário. O botão só é liberado com as três perguntas respondidas.

**Linhas 63 a 71**

```jsx
export default function Profile() {
  const { user, setUser, logout, showToast } = useSession()
  const navigate = useNavigate()
  const [name, setName] = useState(user.name)
  const [bio, setBio] = useState(user.bio || '')
  const [busy, setBusy] = useState(false)
  const [survey, setSurvey] = useState(false)
  const [answeredAt, setAnsweredAt] = useState(undefined)
  const [installEvent, setInstallEvent] = useState(null)
```

Estados do perfil e do questionário. `installEvent` guarda o pedido de instalação do aplicativo, quando o navegador oferece.

**Linhas 73 a 81**

```jsx
  useEffect(() => {
    api('/satisfaction/mine').then((r) => setAnsweredAt(r.answeredAt)).catch(() => {})
    const onPrompt = (e) => {
      e.preventDefault()
      setInstallEvent(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])
```

Ao abrir, consulta se o questionário já foi respondido e escuta o evento `beforeinstallprompt`, disparado pelo Chrome e pelo Edge quando o site pode ser instalado como aplicativo (PWA). O `preventDefault` guarda o pedido para usar no botão.

**Linhas 83 a 96**

```jsx
  async function save(patch) {
    setBusy(true)
    try {
      const r = await api('/me', { method: 'PATCH', body: patch })
      setUser(r.user)
      showToast('Salvo!', 'ok')
      return r.user
    } catch (err) {
      showToast(err.message, 'error')
      return null
    } finally {
      setBusy(false)
    }
  }
```

Salva alterações do perfil e atualiza a sessão.

**Linhas 98 a 109**

```jsx
  return (
    <div style={{ maxWidth: 640 }}>
      <div className="row gap-lg mb">
        <Avatar name={user.name} size="lg" />
        <div className="grow">
          <h1 style={{ marginBottom: 2 }}>{user.name}</h1>
          <div className="small muted">
            {user.phone.replace('+55', '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')} · desde {since(user.memberSince)}
          </div>
          {ROLE[user.role] && <span className="badge primary mt">{ROLE[user.role]}</span>}
        </div>
      </div>
```

Cabeçalho com iniciais, nome, celular, data de entrada e a etiqueta do perfil especial.

**Linhas 111 a 149**

```jsx
      <div className="list mb">
        {user.isProvider && user.role === 'usuario' && (
          <Link to="/painel" className="list-item">
            <LayoutDashboard size={20} /> <span className="grow">Seu painel de anúncios</span>
          </Link>
        )}
        {['agente', 'moderador'].includes(user.role) && (
          <Link to="/campo" className="list-item">
            <ClipboardList size={20} /> <span className="grow">Cadastro de campo</span>
          </Link>
        )}
        {user.role === 'moderador' && (
          <Link to="/moderacao" className="list-item">
            <ShieldCheck size={20} /> <span className="grow">Moderação</span>
          </Link>
        )}
        {['instituicao', 'moderador'].includes(user.role) && (
          <Link to="/indicadores" className="list-item">
            <BarChart3 size={20} /> <span className="grow">Indicadores do bairro</span>
          </Link>
        )}
        <button className="list-item" onClick={() => setSurvey(true)}>
          <Smile size={20} />
          <span className="grow">O que você está achando?</span>
          {answeredAt ? <span className="badge ok">Respondido, valeu!</span> : answeredAt === null && <span className="badge accent">3 perguntas</span>}
        </button>
        {installEvent && (
          <button
            className="list-item"
            onClick={async () => {
              installEvent.prompt()
              await installEvent.userChoice
              setInstallEvent(null)
            }}
          >
            <Download size={20} /> <span className="grow">Instalar o app no celular</span>
          </button>
        )}
      </div>
```

Atalhos conforme o perfil (painel, campo, moderação, indicadores), o questionário com a situação ("Respondido, valeu!" ou "3 perguntas") e, quando possível, "Instalar o app no celular".

**Linhas 151 a 172**

```jsx
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          save({ name, bio })
        }}
      >
        <h2>Seus dados</h2>
        <label className="field">
          <span>Nome</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        {user.isProvider && (
          <label className="field">
            <span>Sobre você</span>
            <textarea className="input" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={400} placeholder="Há quanto tempo faz, o que mais gosta de fazer..." />
          </label>
        )}
        <button className="btn" disabled={busy}>
          Salvar
        </button>
      </form>
```

Edição do nome e, para prestadores, da apresentação.

**Linhas 174 a 194**

```jsx
      {user.role === 'usuario' && (
        <div className="card">
          <h2>Anunciar no bairro</h2>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={user.isProvider}
              disabled={busy}
              onChange={async (e) => {
                const u = await save({ isProvider: e.target.checked })
                if (u?.isProvider) navigate('/painel')
              }}
            />
            <span>
              Quero anunciar o que eu faço ou vendo
              <br />
              <span className="small muted">Não precisa de CNPJ e ninguém vê seu endereço, só a que distância você está.</span>
            </span>
          </label>
        </div>
      )}
```

A opção de oferecer serviços. Ao ativar, a pessoa já é levada ao painel do prestador.

**Linhas 196 a 219**

```jsx
      <button
        className="btn danger block mt-lg"
        onClick={() => {
          logout()
          navigate('/')
        }}
      >
        <LogOut size={18} /> Sair
      </button>

      {survey && (
        <SatisfactionDialog
          group={user.isProvider ? 'prestador' : 'contratante'}
          onClose={() => setSurvey(false)}
          onDone={() => {
            setSurvey(false)
            setAnsweredAt(new Date().toISOString())
            showToast('Valeu por responder!', 'ok')
          }}
        />
      )}
    </div>
  )
}
```

Sair da conta e o diálogo do questionário, que sabe o grupo da pessoa (prestador ou contratante).

---

## `web/src/pages/Field.jsx`

Cadastro de campo do agente (RF03 e RF18 e etapa 1 do Plano de Aplicação). Funciona sem internet.

**Linhas 1 a 10**

```jsx
// RF03 (cadastro assistido) e RF18 (operação offline) usados na pesquisa de campo.
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, CloudOff, Crosshair, Loader2, MapPin, RefreshCw, UploadCloud } from 'lucide-react'
import { ApiError, api } from '../api.js'
import { PickPointMap } from '../components/Maps.jsx'
import { Empty, ErrorBox, useLoad } from '../components/ui.jsx'
import { dateTime, formatPhoneInput } from '../format.js'
import { enqueue, listQueue, newUuid, syncQueue } from '../offline-queue.js'
import { getCurrentPosition } from '../position.js'
import { useSession } from '../session.jsx'
```

Comentário e importações.

**Linhas 12 a 29**

```jsx
const EMPTY = {
  businessName: '',
  category: '',
  appearsOnMaps: '',
  barriers: [],
  notes: '',
  accepted: null,
  consent: false,
  name: '',
  phone: '',
  point: null,
  serviceRadiusKm: 2,
  offerTitle: '',
  offerDescription: '',
  offerKind: 'servico',
  priceMin: '',
  priceMax: '',
}
```

O formulário vazio, usado no início e depois de cada registro.

**Linhas 31 a 53**

```jsx
function toPayload(f) {
  return {
    clientUuid: newUuid(),
    collectedAt: new Date().toISOString(),
    businessName: f.businessName,
    category: f.category,
    appearsOnMaps: f.appearsOnMaps,
    barriers: f.barriers,
    notes: f.notes,
    accepted: f.accepted === true,
    provider: f.accepted
      ? {
          consent: f.consent,
          name: f.name,
          phone: f.phone,
          lat: f.point?.lat,
          lng: f.point?.lng,
          serviceRadiusKm: f.serviceRadiusKm,
          offer: { title: f.offerTitle || f.businessName, description: f.offerDescription, category: f.category, kind: f.offerKind, priceMin: f.priceMin, priceMax: f.priceMax },
        }
      : undefined,
  }
}
```

Converte o formulário no formato da API. O `clientUuid` e a data da coleta são gerados **no momento do registro**, no aparelho: é isso que garante que um registro reenviado pela fila não seja duplicado e que a data seja a da visita, não a da sincronização.

**Linhas 55 a 61**

```jsx
export default function Field() {
  const { meta, showToast } = useSession()
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState(null)
  const [queue, setQueue] = useState([])
  const history = useLoad(() => api('/field/surveys'), [])
```

Estados: formulário, ação em andamento, erro, fila offline e o histórico de registros enviados.

**Linha 63**

```jsx
  const refreshQueue = useCallback(async () => setQueue(await listQueue()), [])
```

Lê a fila guardada no aparelho.

**Linhas 65 a 80**

```jsx
  const sync = useCallback(async () => {
    if (!navigator.onLine) return
    setBusy((b) => b || 'sync')
    try {
      const r = await syncQueue()
      if (r.sent) {
        showToast(`${r.sent} cadastro(s) offline enviado(s)`, 'ok')
        history.reload()
      }
    } catch {
      /* continua na fila */
    } finally {
      setBusy((b) => (b === 'sync' ? '' : b))
      refreshQueue()
    }
  }, [refreshQueue, showToast]) // eslint-disable-line react-hooks/exhaustive-deps
```

Envia a fila quando há conexão e avisa quantos registros subiram. Se falhar, os registros simplesmente continuam na fila.

**Linhas 82 a 86**

```jsx
  useEffect(() => {
    refreshQueue().then(sync)
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [refreshQueue, sync])
```

Ao abrir a tela, lê a fila e tenta enviar. Também envia automaticamente quando a conexão volta (evento `online`).

**Linhas 88 a 89**

```jsx
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }))
  const toggleBarrier = (id) => setF((s) => ({ ...s, barriers: s.barriers.includes(id) ? s.barriers.filter((b) => b !== id) : [...s.barriers, id] }))
```

Atualizador genérico de campo (aceita caixa de seleção, campo de texto ou valor direto) e a marcação das barreiras.

**Linhas 91 a 100**

```jsx
  async function gps() {
    setBusy('gps')
    try {
      set('point')(await getCurrentPosition())
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy('')
    }
  }
```

Registra o ponto de atendimento pelo GPS. O GPS funciona sem internet, porque usa o satélite.

**Linhas 102 a 125**

```jsx
  async function submit(e) {
    e.preventDefault()
    setError(null)
    const payload = toPayload(f)
    setBusy('save')
    try {
      if (!navigator.onLine) throw new ApiError(0, 'offline')
      await api('/field/surveys', { method: 'POST', body: payload })
      showToast('Registro enviado', 'ok')
      history.reload()
      setF(EMPTY)
    } catch (err) {
      if (err.status === 0) {
        await enqueue(payload)
        await refreshQueue()
        showToast('Sem conexão: registro guardado no aparelho e será enviado depois', 'ok')
        setF(EMPTY)
      } else {
        setError(err)
      }
    } finally {
      setBusy('')
    }
  }
```

**Registrar.** Com conexão, envia direto. Se estiver offline, ou se o envio falhar por falta de conexão (erro com código 0), guarda na fila e avisa. Erros de validação do servidor aparecem na tela para correção.

**Linhas 127 a 128**

```jsx
  const valid =
    f.businessName && f.category && f.appearsOnMaps && f.accepted !== null && (!f.accepted || (f.consent && f.name && f.phone.replace(/\D/g, '').length >= 10 && f.point))
```

O botão só é liberado com os dados obrigatórios: negócio, categoria, mapas e a decisão de cadastro; se aceitou, também consentimento, nome, celular e ponto.

**Linhas 130 a 133**

```jsx
  return (
    <div style={{ maxWidth: 720 }}>
      <h1>Cadastro de campo</h1>
      <p className="muted small">Levantamento dos negócios do bairro e cadastro assistido. Funciona sem internet: os registros ficam no aparelho até a conexão voltar.</p>
```

Título e explicação de que funciona sem internet.

**Linhas 135 a 156**

```jsx
      {queue.length > 0 && (
        <div className="notice warn mb">
          <CloudOff size={18} />
          <div className="grow small">
            <strong>{queue.length} registro(s) aguardando envio.</strong>
            {queue.some((q) => q.lastError) && (
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {queue
                  .filter((q) => q.lastError)
                  .map((q) => (
                    <li key={q.clientUuid}>
                      {q.businessName}: {q.lastError}
                    </li>
                  ))}
              </ul>
            )}
          </div>
          <button className="btn sm" onClick={sync} disabled={busy === 'sync' || !navigator.onLine}>
            {busy === 'sync' ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Enviar agora
          </button>
        </div>
      )}
```

Aviso da fila: quantos registros aguardam envio, os erros de cada um (se houver) e o botão "Enviar agora".

**Linhas 158 a 201**

```jsx
      <form className="card" onSubmit={submit}>
        <h2>1. Negócio levantado</h2>
        <label className="field">
          <span>Nome do negócio ou do prestador</span>
          <input className="input" value={f.businessName} onChange={set('businessName')} maxLength={100} placeholder="Ex.: Bolos da Ivone" />
        </label>
        <label className="field">
          <span>Categoria</span>
          <select className="input" value={f.category} onChange={set('category')}>
            <option value="">Escolha...</option>
            {meta.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>O negócio aparece no Google Maps ou em outro mapa digital?</span>
          <div className="segmented">
            {[
              ['sim', 'Sim'],
              ['nao', 'Não'],
              ['nao_sabe', 'Não sabe'],
            ].map(([v, l]) => (
              <button type="button" key={v} className={f.appearsOnMaps === v ? 'on' : ''} onClick={() => set('appearsOnMaps')(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Motivos declarados para não estar em plataformas digitais</span>
          {Object.entries(meta.barriers).map(([id, label]) => (
            <label className="checkbox" key={id}>
              <input type="checkbox" checked={f.barriers.includes(id)} onChange={() => toggleBarrier(id)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <label className="field">
          <span>Observações</span>
          <textarea className="input" value={f.notes} onChange={set('notes')} maxLength={800} />
        </label>
```

**Parte 1, o levantamento**: nome do negócio, categoria, se aparece em mapas digitais (o indicador principal do artigo), as barreiras declaradas e observações.

**Linhas 203 a 211**

```jsx
        <h2 className="mt-lg">2. Cadastro na plataforma</h2>
        <div className="segmented mb">
          <button type="button" className={f.accepted === true ? 'on' : ''} onClick={() => set('accepted')(true)}>
            Aceitou se cadastrar
          </button>
          <button type="button" className={f.accepted === false ? 'on' : ''} onClick={() => set('accepted')(false)}>
            Não aceitou
          </button>
        </div>
```

**Parte 2, o cadastro**: aceitou ou não.

**Linhas 213 a 253**

```jsx
        {f.accepted && (
          <>
            <label className="checkbox mb">
              <input type="checkbox" checked={f.consent} onChange={set('consent')} />
              <span className="small">
                <strong>O prestador autorizou o cadastro em seu nome</strong> e foi informado de que o endereço não será divulgado, de que os vizinhos verão só
                a distância aproximada e de que ele poderá entrar depois com o próprio celular.
              </span>
            </label>
            <div className="grid two">
              <label className="field">
                <span>Nome do prestador</span>
                <input className="input" value={f.name} onChange={set('name')} maxLength={80} />
              </label>
              <label className="field">
                <span>Celular do prestador</span>
                <input className="input" inputMode="tel" value={f.phone} onChange={(e) => set('phone')(formatPhoneInput(e.target.value))} placeholder="(15) 99876-5432" />
              </label>
            </div>
            <div className="field">
              <span>Ponto de atendimento</span>
              <button type="button" className="btn outline block" onClick={gps} disabled={busy === 'gps'}>
                {busy === 'gps' ? <Loader2 size={18} className="spin" /> : <Crosshair size={18} />} Usar minha posição (estou no local)
              </button>
              {f.point ? (
                <div className="small mt row">
                  <MapPin size={14} color="var(--ok)" /> Ponto registrado{f.point.accuracy ? ` (precisão de ${f.point.accuracy} m)` : ''}. Ele não é exibido a ninguém.
                </div>
              ) : (
                <div className="small muted mt">Com internet, também dá para tocar no mapa:</div>
              )}
              {navigator.onLine && (
                <div className="mt">
                  <PickPointMap value={f.point} onChange={set('point')} fallback={meta.pilot} radiusKm={f.serviceRadiusKm} />
                </div>
              )}
            </div>
            <label className="field">
              <span>Atende até {String(f.serviceRadiusKm).replace('.', ',')} km</span>
              <input type="range" min={0.5} max={20} step={0.5} value={f.serviceRadiusKm} onChange={(e) => set('serviceRadiusKm')(Number(e.target.value))} />
            </label>
```

Se aceitou: o termo de consentimento (obrigatório), nome e celular do prestador, o ponto de atendimento (GPS ou mapa, este só com internet, já que os blocos do mapa vêm da rede) e o raio de atendimento.

**Linhas 254 a 282**

```jsx
            <h3>Primeira oferta</h3>
            <div className="segmented mb">
              <button type="button" className={f.offerKind === 'servico' ? 'on' : ''} onClick={() => set('offerKind')('servico')}>
                Serviço
              </button>
              <button type="button" className={f.offerKind === 'produto' ? 'on' : ''} onClick={() => set('offerKind')('produto')}>
                Produto
              </button>
            </div>
            <label className="field">
              <span>Título da oferta</span>
              <input className="input" value={f.offerTitle} onChange={set('offerTitle')} maxLength={80} placeholder={f.businessName || 'Ex.: Ajustes de roupa'} />
            </label>
            <label className="field">
              <span>Descrição</span>
              <textarea className="input" value={f.offerDescription} onChange={set('offerDescription')} maxLength={1500} />
            </label>
            <div className="grid two">
              <label className="field">
                <span>Preço a partir de (R$)</span>
                <input className="input" inputMode="decimal" value={f.priceMin} onChange={set('priceMin')} />
              </label>
              <label className="field">
                <span>Até (R$)</span>
                <input className="input" inputMode="decimal" value={f.priceMax} onChange={set('priceMax')} />
              </label>
            </div>
          </>
        )}
```

A primeira oferta: tipo, título (se vazio, usa o nome do negócio), descrição e preço.

**Linhas 284 a 288**

```jsx
        <ErrorBox error={error} />
        <button className="btn block mt" disabled={!valid || busy === 'save'}>
          {busy === 'save' ? <Loader2 size={18} className="spin" /> : <UploadCloud size={18} />} Registrar
        </button>
      </form>
```

Erro e botão de registrar.

**Linhas 290 a 314**

```jsx
      <div className="section-title">
        <h2>Registros enviados</h2>
        {history.data && <span className="small muted">{history.data.surveys.length}</span>}
      </div>
      <ErrorBox error={history.error} />
      {history.data && history.data.surveys.length === 0 && <Empty title="Nenhum registro ainda" />}
      {history.data && history.data.surveys.length > 0 && (
        <div className="list">
          {history.data.surveys.map((s) => (
            <div key={s.id} className="list-item" style={{ cursor: 'default' }}>
              {s.accepted ? <CheckCircle2 size={20} color="var(--ok)" /> : <CloudOff size={20} color="var(--muted)" />}
              <div className="grow">
                <div className="strong">{s.businessName}</div>
                <div className="small muted">
                  {s.categoryName} · {s.accepted ? 'cadastrado' : 'não aceitou'} · mapas: {{ sim: 'sim', nao: 'não', nao_sabe: 'não sabe' }[s.appearsOnMaps]}
                </div>
              </div>
              <span className="tiny muted nowrap">{dateTime(s.collectedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

Histórico dos registros já enviados pelo agente, com a situação de cada um.

---

## `web/src/pages/Moderation.jsx`

Fila de denúncias da moderação (RF15).

**Linhas 1 a 24**

```jsx
// RF15: fila de denúncias da moderação.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { api } from '../api.js'
import { Empty, ErrorBox, Loading, Modal, useLoad } from '../components/ui.jsx'
import { dateTime } from '../format.js'
import { useSession } from '../session.jsx'

const ACTIONS = {
  oferta: [
    ['remover_oferta', 'Remover a oferta'],
    ['advertir', 'Advertir o prestador'],
  ],
  usuario: [
    ['advertir', 'Advertir o usuário'],
    ['bloquear_usuario', 'Suspender a conta'],
  ],
  mensagem: [
    ['ocultar_mensagem', 'Ocultar a mensagem'],
    ['advertir', 'Advertir o autor'],
    ['bloquear_usuario', 'Suspender o autor'],
  ],
}
```

Comentário, importações e as providências disponíveis para cada tipo de alvo.

**Linhas 26 a 72**

```jsx
function ResolveDialog({ report, onClose, onDone }) {
  const [decision, setDecision] = useState('procedente')
  const [action, setAction] = useState(ACTIONS[report.targetType][0][0])
  const [resolution, setResolution] = useState('')
  const [error, setError] = useState(null)
  return (
    <Modal title="Analisar denúncia" onClose={onClose}>
      <div className="segmented mb">
        <button className={decision === 'procedente' ? 'on' : ''} onClick={() => setDecision('procedente')}>
          Procedente
        </button>
        <button className={decision === 'improcedente' ? 'on' : ''} onClick={() => setDecision('improcedente')}>
          Improcedente
        </button>
      </div>
      {decision === 'procedente' && (
        <div className="field">
          <span>Providência</span>
          {[...ACTIONS[report.targetType], ['nenhuma', 'Apenas registrar']].map(([id, label]) => (
            <label className="checkbox" key={id}>
              <input type="radio" name="action" checked={action === id} onChange={() => setAction(id)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
      <label className="field">
        <span>Justificativa</span>
        <textarea className="input" value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={500} />
      </label>
      <ErrorBox error={error} />
      <button
        className="btn block"
        onClick={async () => {
          try {
            await api(`/moderation/reports/${report.id}/resolve`, { method: 'POST', body: { decision, action: decision === 'procedente' ? action : 'nenhuma', resolution } })
            onDone()
          } catch (err) {
            setError(err)
          }
        }}
      >
        Registrar decisão
      </button>
    </Modal>
  )
}
```

**Diálogo de decisão**: procedente ou improcedente; se procedente, a providência (incluindo "Apenas registrar"); e a justificativa, que é enviada ao responsável quando há advertência ou remoção.

**Linhas 74 a 78**

```jsx
export default function Moderation() {
  const { showToast } = useSession()
  const [status, setStatus] = useState('aberta')
  const [resolving, setResolving] = useState(null)
  const { data, error, loading, reload } = useLoad(() => api(`/moderation/reports?status=${status}`), [status])
```

Carrega as denúncias da aba escolhida.

**Linhas 80 a 93**

```jsx
  return (
    <div>
      <h1>Moderação</h1>
      <div className="tabs">
        {[
          ['aberta', `Abertas${data?.counts ? ` (${data.counts.aberta})` : ''}`],
          ['procedente', 'Procedentes'],
          ['improcedente', 'Improcedentes'],
        ].map(([id, label]) => (
          <button key={id} className={status === id ? 'on' : ''} onClick={() => setStatus(id)}>
            {label}
          </button>
        ))}
      </div>
```

As abas (abertas, com a quantidade; procedentes; improcedentes).

**Linhas 94 a 128**

```jsx
      {loading && !data && <Loading />}
      <ErrorBox error={error} />
      {data && data.reports.length === 0 && <Empty icon={ShieldCheck} title="Nenhuma denúncia aqui" />}
      <div className="stack">
        {data?.reports.map((r) => (
          <div key={r.id} className="card">
            <div className="row between wrap">
              <span className="badge warn">{r.reasonLabel}</span>
              <span className="tiny muted">
                {dateTime(r.createdAt)} · por {r.reporterName}
              </span>
            </div>
            <div className="mt">
              <div className="small muted">
                {{ oferta: 'Oferta', usuario: 'Usuário', mensagem: 'Mensagem' }[r.targetType]}
                {r.target?.ownerName ? ` de ${r.target.ownerName}` : ''}
              </div>
              <div className="strong">{r.target?.link ? <Link to={r.target.link}>{r.target.title}</Link> : r.target?.title || 'Item removido'}</div>
              {r.target?.text && <p className="small" style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{r.target.text}</p>}
            </div>
            {r.details && (
              <div className="notice small">
                <span>{r.details}</span>
              </div>
            )}
            {r.status === 'aberta' ? (
              <button className="btn sm mt" onClick={() => setResolving(r)}>
                Analisar
              </button>
            ) : (
              <div className="small muted mt">Decisão: {r.resolution || r.status}</div>
            )}
          </div>
        ))}
      </div>
```

Cada denúncia mostra o motivo, data e quem denunciou ("Sistema (automático)" para o filtro do chat), o item denunciado com link e texto, os detalhes e o botão "Analisar" ou a decisão já tomada.

**Linhas 129 a 142**

```jsx
      {resolving && (
        <ResolveDialog
          report={resolving}
          onClose={() => setResolving(null)}
          onDone={() => {
            setResolving(null)
            showToast('Decisão registrada', 'ok')
            reload()
          }}
        />
      )}
    </div>
  )
}
```

O diálogo de decisão, que recarrega a fila ao concluir.

---

## `web/src/pages/Institution.jsx`

Indicadores do bairro para instituições parceiras, organizados pelas três etapas da Tabela 5 do artigo.

**Linhas 1 a 6**

```jsx
// Painel para instituições parceiras (Business Intelligence): indicadores do Plano de Aplicação
// (Tabela 5 do artigo) com dados apenas agregados.
import { BadgeCheck, ClipboardList, Download, HandCoins, MapPinOff, Percent, Store, UserPlus, Users } from 'lucide-react'
import { api, getToken } from '../api.js'
import { Bars, ErrorBox, HBar, Loading, Stat, useLoad } from '../components/ui.jsx'
import { brl } from '../format.js'
```

Comentário e importações.

**Linha 8**

```jsx
const pct = (v) => `${String(v).replace('.', ',')}%`
```

Formatação de porcentagem com vírgula.

**Linhas 10 a 19**

```jsx
async function downloadCsv() {
  const res = await fetch('/api/institution/export.csv', { headers: { Authorization: `Bearer ${getToken()}` } })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'conectabairro-indicadores.csv'
  a.click()
  URL.revokeObjectURL(url)
}
```

Baixa a planilha. Um link comum não serve porque a rota exige o token no cabeçalho; por isso o arquivo é buscado com `fetch`, transformado num objeto temporário (`Blob`) e "clicado" por um link criado na hora.

**Linhas 21 a 28**

```jsx
export default function Institution() {
  const { data, error, loading } = useLoad(() => api('/institution/overview'), [])
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  const { field, platform, satisfaction, weekly } = data
  const maxBarrier = Math.max(1, ...field.barriers.map((b) => b.count))
  const maxCat = Math.max(1, ...platform.offersByCategory.map((c) => Math.max(c.offers, c.surveyed)))
  const sat = Object.fromEntries(satisfaction.map((s) => [s.group, s]))
```

Carrega os indicadores e calcula as escalas das barras (o maior valor de cada gráfico).

**Linhas 30 a 40**

```jsx
  return (
    <div>
      <div className="row between wrap">
        <div>
          <h1 style={{ marginBottom: 2 }}>Indicadores do bairro</h1>
          <p className="muted small" style={{ margin: 0 }}>Dados agregados, sem identificação de pessoas ou endereços.</p>
        </div>
        <button className="btn outline sm" onClick={downloadCsv}>
          <Download size={16} /> Exportar planilha (CSV)
        </button>
      </div>
```

Título, aviso de que os dados são agregados e o botão de exportar.

**Linhas 42 a 79**

```jsx
      <div className="section-title">
        <h2>Etapa 1: validação do problema</h2>
      </div>
      <div className="grid stats">
        <Stat icon={ClipboardList} label="Negócios levantados" value={field.approached} />
        <Stat icon={MapPinOff} tone="orange" label="Ausentes de mapas digitais" value={pct(field.notOnMapsPct)} sub={`${field.notOnMaps} de ${field.approached}`} />
        <Stat icon={UserPlus} tone="green" label="Cadastrados" value={field.accepted} />
        <Stat icon={Percent} tone="plum" label="Conversão abordados x cadastrados" value={pct(field.conversionPct)} />
      </div>
      <div className="grid two mt">
        <div className="card">
          <h3>Barreiras declaradas</h3>
          {field.barriers.map((b) => (
            <HBar key={b.id} label={b.label} value={b.count} max={maxBarrier} display={`${b.count} (${pct(b.pct)})`} accent />
          ))}
        </div>
        <div className="card">
          <h3>Oferta por categoria</h3>
          <div className="legend mb">
            <span>
              <i style={{ background: 'var(--primary)' }} />
              Ofertas ativas
            </span>
            <span>
              <i style={{ background: 'var(--accent)' }} />
              Levantados em campo
            </span>
          </div>
          {platform.offersByCategory.map((c) => (
            <div key={c.category}>
              <HBar label={c.name} value={c.offers} max={maxCat} />
              <div style={{ marginTop: -6 }}>
                <HBar label="" value={c.surveyed} max={maxCat} display={c.surveyed ? `${c.surveyed} levantados · ${c.notOnMaps} fora de mapas` : ' '} accent />
              </div>
            </div>
          ))}
        </div>
      </div>
```

**Etapa 1, validação do problema**: negócios levantados, proporção ausente dos mapas, cadastrados e taxa de conversão; as barreiras declaradas em ordem de frequência; e, por categoria, ofertas ativas comparadas com os levantamentos de campo.

**Linhas 81 a 104**

```jsx
      <div className="section-title">
        <h2>Etapa 2: validação da solução</h2>
      </div>
      <div className="grid stats">
        <Stat icon={Store} label="Prestadores com oferta ativa" value={platform.active_providers} sub={`${platform.assisted} via cadastro assistido`} />
        <Stat icon={Users} tone="orange" label="Moradores que contataram" value={platform.active_clients} />
        <Stat icon={BadgeCheck} tone="green" label="Contratações concluídas" value={platform.concluded} />
        <Stat icon={HandCoins} tone="yellow" label="Volume movimentado" value={brl(platform.grossCents)} sub={`comissão apurada ${brl(platform.commissionCents)}`} />
      </div>
      <div className="grid two mt">
        <div className="card">
          <h3>Contatos e contratações por semana</h3>
          <Bars data={weekly.map((w) => ({ ...w, label: w.week }))} a="contacts" b="concluded" labelA="Contatos" labelB="Concluídas" />
        </div>
        <div className="card">
          <h3>Contratações por estado</h3>
          {platform.contractsByStatus.map((c) => (
            <HBar key={c.status} label={c.label} value={c.count} max={Math.max(...platform.contractsByStatus.map((x) => x.count))} />
          ))}
          <p className="small muted mt">
            Avaliação média: <strong>{platform.avgRating ? String(platform.avgRating).replace('.', ',') : '-'}</strong> em {platform.reviews} avaliações
          </p>
        </div>
      </div>
```

**Etapa 2, validação da solução**: prestadores ativos (e quantos vieram do cadastro assistido), moradores que fizeram contato, contratações concluídas e volume movimentado; gráfico semanal; contratações por estado e avaliação média.

**Linhas 106 a 128**

```jsx
      <div className="section-title">
        <h2>Etapa 3: avaliação de satisfação</h2>
      </div>
      <div className="grid two">
        {['contratante', 'prestador'].map((g) => (
          <div className="card" key={g}>
            <h3>{g === 'contratante' ? 'Moradores contratantes' : 'Prestadores'}</h3>
            {sat[g] ? (
              <>
                <HBar label="Satisfação geral" value={sat[g].score} max={5} display={`${String(sat[g].score).replace('.', ',')} / 5`} />
                <HBar label="Facilidade de uso" value={sat[g].ease} max={5} display={`${String(sat[g].ease).replace('.', ',')} / 5`} />
                <HBar label="Intenção de continuar" value={sat[g].continuePct} max={100} display={pct(sat[g].continuePct)} accent />
                <div className="tiny muted">{sat[g].responses} respostas</div>
              </>
            ) : (
              <p className="muted small">Sem respostas ainda.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Etapa 3, satisfação**: para contratantes e prestadores, satisfação geral, facilidade de uso e intenção de continuar, com o número de respostas.

---

## `web/src/pages/NotFound.jsx`

Página para endereços inexistentes.

**Linhas 1 a 13**

```jsx
import { Link } from 'react-router-dom'
import { MapPinOff } from 'lucide-react'
import { Empty } from '../components/ui.jsx'

export default function NotFound() {
  return (
    <Empty icon={MapPinOff} title="Página não encontrada">
      <Link to="/" className="btn mt">
        Voltar ao início
      </Link>
    </Empty>
  )
}
```

Mensagem "Página não encontrada" com botão para voltar ao início.

---
