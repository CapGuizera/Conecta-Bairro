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
