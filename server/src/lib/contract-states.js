// RF09: máquina de estados da contratação. Toda mudança de estado passa por aqui.
//
//  solicitada --(prestador envia proposta)--> proposta_enviada
//  proposta_enviada --(contratante aceita)--> aceita
//  proposta_enviada --(contratante recusa)--> solicitada
//  proposta_enviada --(prestador envia nova proposta)--> proposta_enviada
//  aceita --(prestador inicia)--> em_andamento
//  em_andamento --(prestador conclui)--> concluida
//  solicitada | proposta_enviada | aceita | em_andamento --(qualquer parte cancela)--> cancelada

export const STATUS_LABELS = {
  solicitada: 'Orçamento pedido',
  proposta_enviada: 'Orçamento enviado',
  aceita: 'Negócio fechado',
  em_andamento: 'Em andamento',
  concluida: 'Concluído',
  cancelada: 'Cancelado',
}

export const TRANSITIONS = {
  propor: { from: ['solicitada', 'proposta_enviada'], to: 'proposta_enviada', by: 'provider' },
  aceitar: { from: ['proposta_enviada'], to: 'aceita', by: 'client' },
  recusar: { from: ['proposta_enviada'], to: 'solicitada', by: 'client' },
  iniciar: { from: ['aceita'], to: 'em_andamento', by: 'provider' },
  concluir: { from: ['em_andamento'], to: 'concluida', by: 'provider' },
  cancelar: { from: ['solicitada', 'proposta_enviada', 'aceita', 'em_andamento'], to: 'cancelada', by: 'any' },
}

export const FINAL_STATUSES = ['concluida', 'cancelada']

// Retorna o novo estado ou lança erro explicando por que a ação não é permitida.
export function nextStatus(currentStatus, action, actorSide) {
  const t = TRANSITIONS[action]
  if (!t) throw Object.assign(new Error(`Ação desconhecida: ${action}`), { status: 400 })
  if (t.by !== 'any' && t.by !== actorSide) {
    const who = t.by === 'provider' ? 'quem presta o serviço' : 'quem está contratando'
    throw Object.assign(new Error(`Só ${who} pode fazer isso`), { status: 403 })
  }
  if (!t.from.includes(currentStatus)) {
    throw Object.assign(
      new Error(`Isso não dá pra fazer agora (situação atual: ${STATUS_LABELS[currentStatus].toLowerCase()})`),
      { status: 409 },
    )
  }
  return t.to
}

// Ações disponíveis para um lado no estado atual (usado pela interface).
export function availableActions(currentStatus, actorSide) {
  return Object.entries(TRANSITIONS)
    .filter(([, t]) => t.from.includes(currentStatus) && (t.by === 'any' || t.by === actorSide))
    .map(([action]) => action)
}
