// RF01: autenticação por telefone verificado (código de 6 dígitos) e sessão via JWT.
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import { one } from '../db.js'
import { HttpError } from './http.js'

export function hashCode(phone, code) {
  return crypto.createHmac('sha256', config.jwtSecret).update(`${phone}:${code}`).digest('hex')
}

export function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
}

export function signToken(user) {
  return jwt.sign({ sub: user.id }, config.jwtSecret, { expiresIn: '30d' })
}

export async function userFromToken(token) {
  try {
    const { sub } = jwt.verify(token, config.jwtSecret)
    const user = await one('SELECT * FROM users WHERE id = $1', [sub])
    if (!user || user.blocked) return null
    return user
  } catch {
    return null
  }
}

// Preenche req.user quando há token válido; não bloqueia a requisição.
export async function loadUser(req, _res, next) {
  const header = req.headers.authorization || ''
  if (header.startsWith('Bearer ')) req.user = await userFromToken(header.slice(7))
  next()
}

export function requireAuth(req, _res, next) {
  if (!req.user) throw new HttpError(401, 'Entre com seu telefone para continuar')
  next()
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) throw new HttpError(401, 'Entre com seu telefone para continuar')
  if (!roles.includes(req.user.role)) throw new HttpError(403, 'Seu perfil não tem acesso a esta área')
  next()
}

export function requireProvider(req, _res, next) {
  if (!req.user) throw new HttpError(401, 'Entre com seu telefone para continuar')
  if (!req.user.is_provider) throw new HttpError(403, 'Ative o perfil de prestador para usar esta função')
  next()
}

// Dados do usuário que podem ser vistos por terceiros: nunca telefone nem localização.
export function publicUser(u) {
  return { id: u.id, name: u.name, isProvider: u.is_provider, memberSince: u.created_at }
}

export function selfUser(u) {
  return { ...publicUser(u), phone: u.phone, role: u.role, bio: u.bio }
}
