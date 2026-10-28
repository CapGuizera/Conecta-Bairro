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

export default function ProviderProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useSession()
  const [report, setReport] = useState(false)
  const { data, error, loading } = useLoad(() => api(`/providers/${id}`), [id])
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  const { provider, reputation, offers, reviews } = data

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

      <div className="grid stats">
        <Stat label="Serviços concluídos" value={reputation.concluded} />
        <Stat label="Avaliação média" value={reputation.avgRating !== null ? String(reputation.avgRating).replace('.', ',') : '-'} sub={`${reputation.reviews} avaliações`} />
      </div>

      <div className="section-title">
        <h2>Ofertas</h2>
      </div>
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
