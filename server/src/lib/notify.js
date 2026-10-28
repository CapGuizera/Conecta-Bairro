// RF17: notificação gravada no banco e enviada em tempo real para o usuário conectado.
import { one, q } from '../db.js'
import { emitTo } from '../realtime.js'

export async function notify(userId, { kind, title, body = '', link = '' }, tx = null) {
  const run = tx ? tx.query : q
  const { rows } = await run(
    'INSERT INTO notifications (user_id, kind, title, body, link) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [userId, kind, title, body, link],
  )
  emitTo(userId, 'notification', serializeNotification(rows[0]))
  return rows[0]
}

export function serializeNotification(n) {
  return { id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, readAt: n.read_at, createdAt: n.created_at }
}

export async function unreadCount(userId) {
  const r = await one('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [userId])
  return r.n
}
