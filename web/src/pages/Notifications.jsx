// RF17
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, BellRing, CheckCheck, ClipboardList, MessageCircle, ShieldCheck, Sparkles, Star } from 'lucide-react'
import { api } from '../api.js'
import { Empty, ErrorBox, Loading, useLoad } from '../components/ui.jsx'
import { relative } from '../format.js'
import { useSession } from '../session.jsx'

const ICONS = { mensagem: MessageCircle, conversa: MessageCircle, proposta: ClipboardList, contratacao: ClipboardList, avaliacao: Star, destaque: Sparkles, confirmacao: BellRing, moderacao: ShieldCheck }

export default function Notifications() {
  const navigate = useNavigate()
  const { setUnread, unread } = useSession()
  const { data, error, loading, reload } = useLoad(() => api('/notifications'), [])
  useEffect(() => {
    reload()
  }, [unread]) // eslint-disable-line react-hooks/exhaustive-deps

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

  return (
    <div>
      <div className="row between">
        <h1 style={{ margin: 0 }}>Notificações</h1>
        {data.unread > 0 && (
          <button
            className="btn ghost sm"
            onClick={async () => {
              await api('/notifications/read-all', { method: 'POST' })
              setUnread(0)
              reload()
            }}
          >
            <CheckCheck size={16} /> Marcar todas como lidas
          </button>
        )}
      </div>
      {'Notification' in window && Notification.permission === 'default' && (
        <div className="notice mt">
          <BellRing size={18} />
          <span className="grow small">Receba um aviso no aparelho quando chegar mensagem ou proposta.</span>
          <button className="btn sm" onClick={() => Notification.requestPermission().then(reload)}>
            Ativar
          </button>
        </div>
      )}
      <div className="mt">
        {data.notifications.length === 0 ? (
          <Empty icon={Bell} title="Tudo em dia" />
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
