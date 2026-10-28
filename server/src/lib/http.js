export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export const fail = (status, message) => {
  throw new HttpError(status, message)
}

export function str(value, { max = 500, required = false, name = 'campo' } = {}) {
  const s = typeof value === 'string' ? value.trim() : ''
  if (required && !s) fail(400, `Preencha o campo ${name}`)
  if (s.length > max) fail(400, `O campo ${name} aceita até ${max} caracteres`)
  return s
}

export function int(value, { min = -Infinity, max = Infinity, name = 'valor' } = {}) {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) fail(400, `${name} inválido`)
  return n
}
