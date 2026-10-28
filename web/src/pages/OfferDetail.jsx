import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Flag, Lock, MapPin, MessageCircle, Package, Pencil, Sparkles, Wrench } from 'lucide-react'
import { api, qs } from '../api.js'
import { ReportDialog } from '../components/ReportDialog.jsx'
import { Avatar, ErrorBox, Loading, Stars, useLoad } from '../components/ui.jsx'
import { plural, priceRange, since } from '../format.js'
import { usePosition } from '../position.js'
import { useSession } from '../session.jsx'

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

  if (loading && !data) return <Loading />
  if (loadError) return <ErrorBox error={loadError} />
  const { offer, isOwner, conversationId } = data
  const Icon = offer.kind === 'produto' ? Package : Wrench

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

  return (
    <div>
      <button className="btn ghost sm mb" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Voltar
      </button>

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

      {offer.outsideServiceArea && (
        <div className="notice warn mb">
          <MapPin size={18} />
          <span>Você está além do raio de atendimento informado pelo prestador ({String(offer.serviceRadiusKm).replace('.', ',')} km). Combine pelo chat.</span>
        </div>
      )}

      {offer.description && <p style={{ whiteSpace: 'pre-wrap' }}>{offer.description}</p>}

      <div className="notice mb">
        <Lock size={18} />
        <span className="small">
          O endereço do prestador não é divulgado. A negociação acontece pelo chat do ConectaBairro, sem troca de telefone, e fica registrada para a
          segurança dos dois lados.
        </span>
      </div>

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
