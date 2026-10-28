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

// Segredo do JWT: se não for definido, gera um e guarda em server/data para sobreviver a reinícios.
function resolveSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET
  const dir = path.join(ROOT, 'server', 'data')
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
  pgliteDir: process.env.PGLITE_DIR || path.join(ROOT, 'server', 'data', 'pglite'),
  uploadsDir: path.join(ROOT, 'server', 'data', 'uploads'),
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
  // Dias sem confirmação até a oferta pedir confirmação e até sair da busca (RF16).
  activity: { askAfterDays: 30, hideAfterDays: 45 },
}
