// RF17
import { Router } from 'express'
import { many, q } from '../db.js'
import { requireAuth } from '../lib/auth.js'
import { serializeNotification, unreadCount } from '../lib/notify.js'

const r = Router()
r.use('/notifications', requireAuth)

r.get('/notifications', async (req, res) => {
  const rows = await many('SELECT * FROM notifications WHERE user_id = $1 ORDER BY id DESC LIMIT 100', [req.user.id])
  res.json({ notifications: rows.map(serializeNotification), unread: await unreadCount(req.user.id) })
})

r.get('/notifications/unread-count', async (req, res) => {
  res.json({ unread: await unreadCount(req.user.id) })
})

r.post('/notifications/read-all', async (req, res) => {
  await q('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.id])
  res.json({ unread: 0 })
})

r.post('/notifications/:id/read', async (req, res) => {
  await q('UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL', [
    Number(req.params.id) || 0,
    req.user.id,
  ])
  res.json({ unread: await unreadCount(req.user.id) })
})

export default r
