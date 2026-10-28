import { Router } from 'express'
import { config } from '../config.js'
import { CATEGORIES } from '../lib/categories.js'
import { RADIUS_OPTIONS_KM } from '../lib/geo.js'
import { BARRIERS } from './field.js'
import { REPORT_REASONS } from './moderation.js'
import { HIGHLIGHT_PLANS } from './provider.js'

const r = Router()

const DEMO_ACCOUNTS = [
  { phone: '(15) 90000-0001', name: 'Cleusa Batista', label: 'Persona 1: prestadora (bolos e salgados)' },
  { phone: '(15) 90000-0002', name: 'Thiago Nunes', label: 'Persona 2: morador contratante' },
  { phone: '(15) 90000-0003', name: 'Marcelo Duarte', label: 'Persona 3: prestador técnico' },
  { phone: '(15) 90000-0005', name: 'Agente de campo', label: 'Cadastro assistido e levantamento' },
  { phone: '(15) 90000-0006', name: 'Moderação', label: 'Denúncias' },
  { phone: '(15) 90000-0007', name: 'Associação de Moradores', label: 'Painel de indicadores' },
]

r.get('/meta', (_req, res) => {
  res.json({
    categories: CATEGORIES.map(({ slug, name }) => ({ slug, name })),
    pilot: config.pilot,
    radiusOptionsKm: RADIUS_OPTIONS_KM,
    commissionRate: config.commissionRate,
    highlightPlans: HIGHLIGHT_PLANS,
    barriers: BARRIERS,
    reportReasons: REPORT_REASONS,
    smsMode: config.smsMode,
    // Atalhos da tela de login no modo demonstração (sem SMS real).
    demoAccounts: config.smsMode === 'dev' ? DEMO_ACCOUNTS : [],
  })
})

export default r
