// Monta a aplicação Express (separado do index.js para os testes usarem sem abrir porta).
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import { config } from './config.js'
import { loadUser } from './lib/auth.js'
import authRoutes from './routes/auth.js'
import conversationRoutes from './routes/conversations.js'
import fieldRoutes from './routes/field.js'
import institutionRoutes from './routes/institution.js'
import metaRoutes from './routes/meta.js'
import moderationRoutes from './routes/moderation.js'
import notificationRoutes from './routes/notifications.js'
import offerRoutes from './routes/offers.js'
import providerRoutes from './routes/provider.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback')
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'same-origin')
    res.setHeader('X-Frame-Options', 'DENY')
    next()
  })
  app.use(express.json({ limit: '8mb' }))

  const api = express.Router()
  api.use(loadUser)
  for (const routes of [metaRoutes, authRoutes, offerRoutes, conversationRoutes, providerRoutes, notificationRoutes, moderationRoutes, fieldRoutes, institutionRoutes]) {
    api.use(routes)
  }
  api.use((_req, _res, next) => next(Object.assign(new Error('Rota não encontrada'), { status: 404 })))
  app.use('/api', api)

  fs.mkdirSync(config.uploadsDir, { recursive: true })
  app.use('/uploads', express.static(config.uploadsDir, { maxAge: '30d', immutable: true }))

  // Interface web compilada (npm run build). Rotas desconhecidas caem no index.html (SPA).
  if (fs.existsSync(path.join(config.webDist, 'index.html'))) {
    app.use(express.static(config.webDist, { index: false, maxAge: '1h' }))
    app.get(/^\/(?!api\/|uploads\/).*/, (_req, res) => res.sendFile(path.join(config.webDist, 'index.html')))
  } else {
    app.get('/', (_req, res) =>
      res.type('text').send('API do ConectaBairro no ar. A interface ainda não foi compilada: rode "npm run build" ou use "npm run dev".'),
    )
  }

  app.use((err, _req, res, _next) => {
    const status = err.status || (err.type === 'entity.too.large' ? 413 : err.type === 'entity.parse.failed' ? 400 : 500)
    if (status >= 500) console.error(err)
    res.status(status).json({ error: status >= 500 ? 'Deu um problema aqui do nosso lado. Tenta de novo daqui a pouco.' : err.message })
  })
  return app
}
