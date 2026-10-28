// RF14 (painel do prestador), RF13 (plano de destaque) e RF16 (confirmação de atividade).
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BadgeCheck, Eye, MapPin, Pause, Pencil, Play, Plus, Sparkles } from 'lucide-react'
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
    <Modal title="Destacar oferta" onClose={onClose}>
      <p className="small muted">
        "{offer.title}" aparece no topo das buscas da categoria <strong>{offer.categoryName}</strong>, com a etiqueta Destaque, durante o período
        contratado.
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
      {offer.highlightUntil && <p className="small mt">Já em destaque até {date(offer.highlightUntil)}. O novo período começa depois.</p>}
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
        <Sparkles size={18} /> Pagar {brl(chosen.priceCents)} com PIX (simulado)
      </button>
      <p className="tiny muted center mt">Protótipo: o pagamento é simulado e confirmado na hora.</p>
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
        <h1>Painel do prestador</h1>
        {!location.hasLocation && <p className="muted">Antes de publicar, informe de onde você atende.</p>}
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
    showToast('Ofertas confirmadas. Obrigado por manter o bairro atualizado!', 'ok')
    offers.reload()
  }

  const series = d.series.map((s) => ({ ...s, label: s.day.split('-').reverse().slice(0, 2).join('/') }))

  return (
    <div>
      <div className="row between wrap">
        <h1 style={{ margin: 0 }}>Painel do prestador</h1>
        <Link to="/painel/ofertas/nova" className="btn">
          <Plus size={18} /> Nova oferta
        </Link>
      </div>

      {stale.length > 0 && (
        <div className="notice warn mt">
          <AlertTriangle size={18} />
          <div className="grow small">
            <strong>{stale.length === 1 ? 'Uma oferta precisa' : `${stale.length} ofertas precisam`} de confirmação.</strong> Ofertas sem confirmação há 45 dias
            saem da busca.
          </div>
          <button className="btn sm" onClick={confirmAll}>
            <BadgeCheck size={14} /> Continuam ativas
          </button>
        </div>
      )}

      {(d.pending.awaitingProposal > 0 || d.pending.inProgress > 0) && (
        <Link to="/contratacoes" className="notice accent mt" style={{ color: 'inherit' }}>
          <Sparkles size={18} />
          <span className="small">
            {d.pending.awaitingProposal > 0 && <strong>{d.pending.awaitingProposal} pedido(s) aguardando sua proposta. </strong>}
            {d.pending.inProgress > 0 && <span>{d.pending.inProgress} serviço(s) em andamento.</span>}
          </span>
        </Link>
      )}

      <div className="row between mt-lg mb">
        <h2 style={{ margin: 0 }}>Desempenho</h2>
        <div className="segmented" style={{ width: 240 }}>
          {[7, 30, 90].map((n) => (
            <button key={n} className={days === n ? 'on' : ''} onClick={() => setDays(n)}>
              {n} dias
            </button>
          ))}
        </div>
      </div>
      <div className="grid stats">
        <Stat label="Visualizações do perfil" value={d.totals.views} />
        <Stat label="Contatos iniciados" value={d.totals.contacts} sub={plural(d.totals.requests, 'pedido de serviço', 'pedidos de serviço')} />
        <Stat label="Contratações concluídas" value={d.totals.concluded} sub={`${String(d.totals.conversion).replace('.', ',')}% dos contatos`} />
        <Stat label="Receita líquida" value={brl(d.revenue.net)} sub={`bruto ${brl(d.revenue.gross)} · comissão ${brl(d.revenue.commission)}`} />
      </div>
      <div className="card mt">
        <div className="row between">
          <h3 style={{ margin: 0 }}>Visualizações e contatos por dia</h3>
          <Stars value={d.rating.avg} count={d.rating.count} />
        </div>
        <Bars data={series} a="views" b="contacts" labelA="Visualizações" labelB="Contatos" />
      </div>

      <div className="section-title">
        <h2>Minhas ofertas</h2>
        <button className="btn ghost sm" onClick={() => setEditingLocation(true)}>
          <MapPin size={14} /> Atendo até {String(location.serviceRadiusKm).replace('.', ',')} km
        </button>
      </div>
      {myOffers.length === 0 ? (
        <Empty icon={Plus} title="Publique sua primeira oferta">
          <Link to="/painel/ofertas/nova" className="btn mt">
            Criar oferta
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
                      {o.status === 'pausada' ? <span className="badge">Pausada</span> : <span className="badge ok">Ativa</span>}
                      {o.highlighted && (
                        <span className="badge accent">
                          <Sparkles size={12} /> Destaque até {date(o.highlightUntil)}
                        </span>
                      )}
                      {o.needsConfirmation && o.status === 'ativa' && <span className="badge warn">Confirmar atividade</span>}
                    </div>
                    <Link to={`/oferta/${o.id}`} className="strong" style={{ color: 'var(--ink)', display: 'block', marginTop: 4 }}>
                      {o.title}
                    </Link>
                    <div className="small muted">{priceRange(o)}</div>
                    {stats && (
                      <div className="tiny muted row wrap" style={{ marginTop: 4 }}>
                        <Eye size={12} /> {stats.views} visualizações · {stats.contacts} contatos · {stats.concluded} concluídas · {brl(stats.gross)}
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
                      <BadgeCheck size={14} /> Confirmar
                    </button>
                  )}
                  {o.status === 'ativa' && (
                    <button className="btn sm accent" onClick={() => setHighlight(o)}>
                      <Sparkles size={14} /> Destacar
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
            showToast('Destaque ativado!', 'ok')
            offers.reload()
          }}
        />
      )}
    </div>
  )
}
