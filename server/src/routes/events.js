// Tempo real no modo "poll" (Vercel) e rotina diária chamada pelo Cron da Vercel.
import { Router } from 'express'
import { config } from '../config.js'
import { many, one, q } from '../db.js'
import { requireAuth } from '../lib/auth.js'
import { fail } from '../lib/http.js'
import { runActivityCheck } from '../jobs.js'

const r = Router()

// GET /api/events?after=<id>: eventos do usuário depois do id informado.
// Sem "after", devolve só o último id, que vira o ponto de partida do navegador.
r.get('/events', requireAuth, async (req, res) => {
  const after = Number(req.query.after)
  if (!Number.isFinite(after) || after < 0) {
    const last = await one('SELECT coalesce(max(id), 0)::int AS id FROM realtime_events WHERE user_id = $1', [req.user.id])
    return res.json({ events: [], last: last.id })
  }
  const rows = await many(
    'SELECT id::int, event, payload FROM realtime_events WHERE user_id = $1 AND id > $2 ORDER BY id LIMIT 100',
    [req.user.id, after],
  )
  res.json({ events: rows, last: rows.length ? rows[rows.length - 1].id : after })
})

// Cron da Vercel (vercel.json). Ela envia "Authorization: Bearer <CRON_SECRET>".
r.get('/cron/activity', async (req, res) => {
  if (config.cronSecret && req.headers.authorization !== `Bearer ${config.cronSecret}`) fail(401, 'Não autorizado')
  const notified = await runActivityCheck()
  await q("DELETE FROM realtime_events WHERE created_at < now() - interval '1 day'")
  res.json({ ok: true, notified })
})

export default r
