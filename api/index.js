// Função da Vercel: a mesma API Express do servidor local, sem abrir porta.
// O banco PGlite fica em /tmp e é criado (com os dados de demonstração) na primeira chamada
// de cada instância. Veja "Publicar na Vercel" no README.
import { createApp } from '../server/src/app.js'
import { initDb } from '../server/src/db.js'
import { seedIfEmpty } from '../server/src/seed.js'

let ready = null
const app = createApp()

function boot() {
  ready ??= (async () => {
    await initDb()
    await seedIfEmpty()
  })().catch((err) => {
    ready = null // tenta de novo na próxima chamada
    throw err
  })
  return ready
}

export default async function handler(req, res) {
  try {
    await boot()
  } catch (err) {
    console.error('[inicialização]', err)
    res.statusCode = 503
    res.setHeader('Content-Type', 'application/json')
    return res.end(JSON.stringify({ error: 'Servidor iniciando. Tente de novo em instantes.' }))
  }
  return app(req, res)
}
