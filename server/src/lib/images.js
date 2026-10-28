// RF02: imagens opcionais das ofertas, enviadas pelo navegador já redimensionadas (data URL).
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { config } from '../config.js'
import { fail } from './http.js'

const MAX_IMAGES = 4
const MAX_BYTES = 1_500_000
const SIGNATURES = {
  jpg: (b) => b[0] === 0xff && b[1] === 0xd8,
  png: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  webp: (b) => b.slice(0, 4).toString() === 'RIFF' && b.slice(8, 12).toString() === 'WEBP',
}

export function saveImages(list) {
  if (!Array.isArray(list)) return []
  if (list.length > MAX_IMAGES) fail(400, `Envie no máximo ${MAX_IMAGES} imagens`)
  fs.mkdirSync(config.uploadsDir, { recursive: true })
  return list.map((item) => {
    if (typeof item !== 'string') fail(400, 'Imagem inválida')
    if (/^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp)$/.test(item)) return item
    const m = item.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/)
    if (!m) fail(400, 'Formato de imagem não suportado (use JPG, PNG ou WEBP)')
    const ext = m[1] === 'jpeg' ? 'jpg' : m[1]
    const buf = Buffer.from(m[2], 'base64')
    if (buf.length > MAX_BYTES) fail(400, 'Imagem muito grande (máximo 1,5 MB)')
    if (!SIGNATURES[ext](buf)) fail(400, 'O arquivo enviado não é uma imagem válida')
    const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`
    fs.writeFileSync(path.join(config.uploadsDir, name), buf)
    return `/uploads/${name}`
  })
}
