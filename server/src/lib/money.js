// RF10: valores sempre em centavos (inteiros) para não haver erro de ponto flutuante.

// Comissão com arredondamento "meio para cima" no centavo.
export function computeCommission(grossCents, rate) {
  if (!Number.isInteger(grossCents) || grossCents <= 0) throw new Error('Valor bruto inválido')
  if (!(rate >= 0 && rate < 1)) throw new Error('Taxa inválida')
  // Trabalha em milionésimos de centavo para a taxa não introduzir erro binário (0.06 * 100 = 6.000000000000001)
  const ratePpm = Math.round(rate * 1_000_000)
  const commissionCents = Math.floor((grossCents * ratePpm + 500_000) / 1_000_000)
  return { grossCents, rate, commissionCents, netCents: grossCents - commissionCents }
}

export function formatBRL(cents) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// Converte "150", "150,5", "1.500,00" ou 150.5 em centavos.
export function parseMoneyToCents(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value * 100) : null
  let s = String(value).replace(/[R$\s]/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? Math.round(n * 100) : null
}
