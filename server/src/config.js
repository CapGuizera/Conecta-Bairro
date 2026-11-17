// Configuração central. Lê o arquivo .env da raiz (se existir) sem dependências externas,
// para funcionar igual no Windows, Linux e macOS.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const envFile = path.join(ROOT, '.env')
if (fs.existsSync(envFile)) {
  for (const raw of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    const key = line.slice(0, i).trim()
    const value = line.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

// Na Vercel o servidor vira função e só a pasta /tmp aceita gravação. O banco embutido e
// as fotos ficam lá: são recriados (com os dados de demonstração) quando a função reinicia.
const SERVERLESS = !!process.env.VERCEL
const DATA_DIR = SERVERLESS ? path.join('/tmp', 'conecta-bairro') : path.join(ROOT, 'server', 'data')

// Segredo do JWT: se não for definido, gera um e guarda na pasta de dados para sobreviver a reinícios.
// Na Vercel defina JWT_SECRET nas variáveis do projeto, senão cada reinício derruba os logins.
function resolveSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  const dir = DATA_DIR
  const file = path.join(dir, '.jwt-secret')
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim()
  fs.mkdirSync(dir, { recursive: true })
  const secret = crypto.randomBytes(48).toString('hex')
  fs.writeFileSync(file, secret)
  return secret
}

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  databaseUrl: process.env.DATABASE_URL || '',
  pgliteDir: process.env.PGLITE_DIR || path.join(DATA_DIR, 'pglite'),
  uploadsDir: path.join(DATA_DIR, 'uploads'),
  serverless: SERVERLESS,
  // "socket": WebSocket (servidor contínuo). "poll": o navegador consulta /api/events (Vercel).
  realtime: SERVERLESS ? 'poll' : 'socket',
  // Protege a rota da rotina diária chamada pelo Cron da Vercel.
  cronSecret: process.env.CRON_SECRET || '',
  webDist: path.join(ROOT, 'web', 'dist'),
  jwtSecret: process.env.NODE_ENV === 'test' ? 'test-secret' : resolveSecret(),
  // "dev": o código de verificação aparece na tela e no terminal (não há envio de SMS real).
  smsMode: process.env.SMS_MODE || 'dev',
  commissionRate: 0.06,
  // Centro do bairro piloto usado quando o usuário não compartilha a localização.
  pilot: {
    name: process.env.PILOT_NAME || 'Bairro piloto - Sorocaba/SP',
    lat: Number(process.env.PILOT_LAT || -23.4806),
    lng: Number(process.env.PILOT_LNG || -47.4205),
  },
  // Área atendida: só a região de Sorocaba. Pontos fora deste retângulo são recusados
  // e o mapa não deixa sair dele.
  region: {
    name: 'Região de Sorocaba/SP',
    south: -23.65,
    west: -47.62,
    north: -23.33,
    east: -47.28,
  },
  // Dias sem confirmação até a oferta pedir confirmação e até sair da busca (RF16).
  activity: { askAfterDays: 30, hideAfterDays: 45 },
}
