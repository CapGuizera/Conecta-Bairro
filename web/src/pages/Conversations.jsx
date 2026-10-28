import { Link } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { api } from '../api.js'
import { Thumb } from '../components/OfferCard.jsx'
import { Empty, ErrorBox, Loading, useLoad } from '../components/ui.jsx'
import { relative } from '../format.js'
import { useRealtime } from '../session.jsx'

export default function Conversations() {
  const { data, error, loading, reload } = useLoad(() => api('/conversations'), [])
  useRealtime((ev) => ev === 'message' && reload())
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} />
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
