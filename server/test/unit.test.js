// Testes unitários das regras de negócio sensíveis (Seção 5.5: Qualidade e Testes de Software).
import test from 'node:test'
import assert from 'node:assert/strict'
import { computeCommission, parseMoneyToCents } from '../src/lib/money.js'
import { availableActions, nextStatus } from '../src/lib/contract-states.js'
import { approxDistance, randomAnchor } from '../src/lib/geo.js'
import { maskContacts, normalizePhone, searchTokens } from '../src/lib/text.js'
import { categoriesForTokens } from '../src/lib/categories.js'

test('RF10: comissão de 6% em centavos, arredondada meio para cima', () => {
  assert.deepEqual(computeCommission(15000, 0.06), { grossCents: 15000, rate: 0.06, commissionCents: 900, netCents: 14100 })
  assert.equal(computeCommission(1234, 0.06).commissionCents, 74) // 74,04
  assert.equal(computeCommission(25, 0.06).commissionCents, 2) // 1,5 sobe
  assert.equal(computeCommission(24, 0.06).commissionCents, 1) // 1,44 desce
  assert.equal(computeCommission(9999999, 0.06).commissionCents, 600000) // 599.999,94
  for (const v of [1, 99, 12345, 333333]) {
    const c = computeCommission(v, 0.06)
    assert.equal(c.commissionCents + c.netCents, v, 'bruto = comissão + líquido')
  }
  assert.throws(() => computeCommission(0, 0.06))
  assert.throws(() => computeCommission(10.5, 0.06))
})

test('conversão de valores digitados para centavos', () => {
  assert.equal(parseMoneyToCents('150'), 15000)
  assert.equal(parseMoneyToCents('1.500,90'), 150090)
  assert.equal(parseMoneyToCents('R$ 35,5'), 3550)
  assert.equal(parseMoneyToCents(''), null)
  assert.equal(parseMoneyToCents('abc'), null)
})

test('RF09: máquina de estados da contratação', () => {
  assert.equal(nextStatus('solicitada', 'propor', 'provider'), 'proposta_enviada')
  assert.equal(nextStatus('proposta_enviada', 'aceitar', 'client'), 'aceita')
  assert.equal(nextStatus('proposta_enviada', 'recusar', 'client'), 'solicitada')
  assert.equal(nextStatus('aceita', 'iniciar', 'provider'), 'em_andamento')
  assert.equal(nextStatus('em_andamento', 'concluir', 'provider'), 'concluida')
  assert.equal(nextStatus('aceita', 'cancelar', 'client'), 'cancelada')
  // Quem não pode
  assert.throws(() => nextStatus('proposta_enviada', 'aceitar', 'provider'), { status: 403 })
  assert.throws(() => nextStatus('solicitada', 'propor', 'client'), { status: 403 })
  // Estados inválidos
  assert.throws(() => nextStatus('solicitada', 'concluir', 'provider'), { status: 409 })
  assert.throws(() => nextStatus('concluida', 'cancelar', 'client'), { status: 409 })
  assert.throws(() => nextStatus('cancelada', 'propor', 'provider'), { status: 409 })
  assert.deepEqual(availableActions('proposta_enviada', 'client'), ['aceitar', 'recusar', 'cancelar'])
  assert.deepEqual(availableActions('concluida', 'provider'), [])
})

test('RF04: ponto público fica entre 100 e 300 m do endereço real', () => {
  const lat = -23.48
  const lng = -47.42
  for (let i = 0; i < 300; i++) {
    const a = randomAnchor(lat, lng)
    const dy = (a.lat - lat) * 111_320
    const dx = (a.lng - lng) * 111_320 * Math.cos((lat * Math.PI) / 180)
    const d = Math.hypot(dx, dy)
    assert.ok(d >= 99 && d <= 301, `deslocamento ${d.toFixed(1)} m fora da faixa`)
  }
})

test('RF04: distância exibida é arredondada e tem piso de 0,5 km', () => {
  assert.deepEqual(approxDistance(120), { km: 0.5, label: 'menos de 0,5 km' })
  assert.equal(approxDistance(1234).km, 1.2)
  assert.equal(approxDistance(1251).km, 1.3)
  assert.equal(approxDistance(2049).label, '2,0 km')
})

test('RF07: o chat remove telefone, e-mail, links e convites para outros apps', () => {
  const cases = [
    'me chama no (15) 99876-5432',
    'meu numero é 15998765432',
    '+55 15 9 9876 5432',
    'manda email pra cleusa.bolos@gmail.com',
    'me chama no zap',
    'segue no insta @cleusabolos',
    'olha www.meusite.com.br',
    'me liga',
  ]
  for (const c of cases) {
    const r = maskContacts(c)
    assert.equal(r.masked, true, `não mascarou: ${c}`)
    assert.ok(!/\d{4}-?\d{4}|@gmail|zap|cleusabolos|meusite/i.test(r.text), `sobrou contato em: ${r.text}`)
  }
  for (const ok of ['O bolo custa R$ 120,00', 'Posso ir dia 12/11 às 14h', 'Cento de salgados por 85 reais', 'Faço 2 bolos de 1,5 kg']) {
    const r = maskContacts(ok)
    assert.equal(r.masked, false, `mascarou indevidamente: ${ok}`)
    assert.equal(r.text, ok)
  }
})

test('RF01: normalização de celular brasileiro', () => {
  assert.equal(normalizePhone('(15) 99876-5432'), '+5515998765432')
  assert.equal(normalizePhone('+55 15 99876 5432'), '+5515998765432')
  assert.equal(normalizePhone('1532345678'), '+551532345678')
  assert.equal(normalizePhone('12345'), null)
  assert.equal(normalizePhone('0159987654'), null)
})

test('RF05: busca por necessidade identifica a categoria', () => {
  assert.deepEqual(searchTokens('Preciso de alguém para consertar meu chuveiro'), ['consertar', 'chuveiro'])
  assert.ok(categoriesForTokens(searchTokens('meu chuveiro queimou')).includes('manutencao'))
  assert.ok(categoriesForTokens(searchTokens('bolo de aniversário')).includes('alimentacao'))
  assert.ok(categoriesForTokens(searchTokens('ajustar a barra da calça')).includes('costura'))
})
