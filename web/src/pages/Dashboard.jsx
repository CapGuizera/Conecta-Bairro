// RF14 (painel do prestador), RF13 (plano de destaque) e RF16 (confirmação de atividade).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, ClipboardList, Eye, MapPin, Megaphone, Pause, Pencil, Play, Plus, QrCode } from 'lucide-react'
import { api } from '../api.js'
import { Thumb } from '../components/OfferCard.jsx'
import { ProviderLocation } from '../components/ProviderLocation.jsx'
import { Bars, Empty, ErrorBox, Loading, Modal, Stat, Stars, useLoad } from '../components/ui.jsx'
import { brl, date, plural, priceRange } from '../format.js'
import { useSession } from '../session.jsx'

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

export default function Dashboard() {
  const { location, showToast } = useSession()
  const [days, setDays] = useState(30)
  const [editingLocation, setEditingLocation] = useState(false)
  const [highlight, setHighlight] = useState(null)
  const dash = useLoad(() => api(`/my/dashboard?days=${days}`), [days])
  const offers = useLoad(() => api('/my/offers'), [])

  if (!location.hasLocation || editingLocation) {
    return (
      <div>
        <h1>Seu painel</h1>
        {!location.hasLocation && <p className="muted">Antes de anunciar, marca de onde você atende.</p>}
        <ProviderLocation onSaved={() => setEditingLocation(false)} onCancel={location.hasLocation ? () => setEditingLocation(false) : undefined} />
      </div>
    )
  }
  if ((dash.loading && !dash.data) || (offers.loading && !offers.data)) return <Loading />
  if (dash.error || offers.error) return <ErrorBox error={dash.error || offers.error} />

  const d = dash.data
  const myOffers = offers.data.offers
  const stale = myOffers.filter((o) => o.needsConfirmation && o.status === 'ativa')

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

  const series = d.series.map((s) => ({ ...s, label: s.day.split('-').reverse().slice(0, 2).join('/') }))

  return (
    <div>
      <div className="row between wrap">
        <h1 style={{ margin: 0 }}>Seu painel</h1>
        <Link to="/painel/ofertas/nova" className="btn">
          <Plus size={18} /> Novo anúncio
        </Link>
      </div>

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

      {(d.pending.awaitingProposal > 0 || d.pending.inProgress > 0) && (
        <Link to="/contratacoes" className="notice accent mt" style={{ color: 'inherit' }}>
          <ClipboardList size={18} />
          <span className="small">
            {d.pending.awaitingProposal > 0 && <strong>{plural(d.pending.awaitingProposal, 'pessoa esperando', 'pessoas esperando')} seu orçamento. </strong>}
            {d.pending.inProgress > 0 && <span>{plural(d.pending.inProgress, 'serviço em andamento', 'serviços em andamento')}.</span>}
          </span>
        </Link>
      )}

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
      <div className="grid stats">
        <Stat label="Pessoas que viram" value={d.totals.views} />
        <Stat label="Te chamaram no chat" value={d.totals.contacts} sub={plural(d.totals.requests, 'pediu orçamento', 'pediram orçamento')} />
        <Stat
          label="Serviços feitos"
          value={d.totals.concluded}
          sub={d.totals.conversion <= 100 ? `${String(d.totals.conversion).replace('.', ',')}% de quem chamou` : 'tem cliente voltando!'}
        />
        <Stat label="Você recebeu" value={brl(d.revenue.net)} sub={`de ${brl(d.revenue.gross)}, já tirando ${brl(d.revenue.commission)} de taxa`} />
      </div>
      <div className="card mt">
        <div className="row between">
          <h3 style={{ margin: 0 }}>Dia a dia</h3>
          <Stars value={d.rating.avg} count={d.rating.count} />
        </div>
        <Bars data={series} a="views" b="contacts" labelA="Viram o anúncio" labelB="Chamaram" />
      </div>

      <div className="section-title">
        <h2>Seus anúncios</h2>
        <button className="btn ghost sm" onClick={() => setEditingLocation(true)}>
          <MapPin size={14} /> Atendo até {String(location.serviceRadiusKm).replace('.', ',')} km
        </button>
      </div>
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
