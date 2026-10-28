export const brl = (cents) =>
  cents === null || cents === undefined ? '' : (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function priceRange(o) {
  const { priceMinCents: min, priceMaxCents: max, priceUnit } = o
  if (min === null && max === null) return 'Preço a combinar'
  const unit = priceUnit && priceUnit !== 'a combinar' ? ` ${priceUnit}` : ''
  if (min !== null && max !== null && min !== max) return `${brl(min)} a ${brl(max)}${unit}`
  if (min !== null && max !== null) return `${brl(min)}${unit}`
  if (min !== null) return `a partir de ${brl(min)}${unit}`
  return `até ${brl(max)}${unit}`
}

export const localYmd = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const date = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '')
export const dateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
export const time = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '')
export const ymdToBr = (s) => (s ? s.split('-').reverse().join('/') : '')

export function relative(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`
  return date(iso)
}

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

export const firstName = (name = '') => name.split(' ')[0]

export function formatPhoneInput(value) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2) return d.length ? `(${d}` : ''
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

export const since = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
