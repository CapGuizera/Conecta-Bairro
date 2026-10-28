// RF16: pede periodicamente a confirmação de que a oferta continua ativa.
// Depois de 30 dias sem confirmação o prestador é avisado; depois de 45 a oferta sai da busca.
import { config } from './config.js'
import { many, q } from './db.js'
import { notify } from './lib/notify.js'

export async function runActivityCheck() {
  const stale = await many(
    `SELECT o.id, o.title, o.provider_id FROM offers o
      WHERE o.status = 'ativa'
        AND o.confirmed_at < now() - make_interval(days => $1::int)
        AND (o.confirm_notified_at IS NULL OR o.confirm_notified_at < now() - interval '7 days')`,
    [config.activity.askAfterDays],
  )
  for (const o of stale) {
    await notify(o.provider_id, {
      kind: 'confirmacao',
      title: 'Seu anúncio continua valendo?',
      body: `Confirma "${o.title}" pra ele continuar aparecendo pros vizinhos.`,
      link: '/painel',
    })
    await q('UPDATE offers SET confirm_notified_at = now() WHERE id = $1', [o.id])
  }
  return stale.length
}

export function scheduleJobs() {
  const run = () => runActivityCheck().catch((err) => console.error('[rotina de atividade]', err.message))
  setTimeout(run, 5_000)
  return setInterval(run, 6 * 60 * 60 * 1000)
}
