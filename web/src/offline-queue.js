// RF18: fila de cadastros feitos sem conexão durante a pesquisa de campo.
// Guarda no IndexedDB do aparelho e envia em lote quando a conexão volta.
import { get, set } from 'idb-keyval'
import { api } from './api.js'

const KEY = 'cb.field-queue'

export async function listQueue() {
  return (await get(KEY)) || []
}

export async function enqueue(item) {
  const q = await listQueue()
  q.push({ ...item, queuedAt: new Date().toISOString() })
  await set(KEY, q)
  return q.length
}

let syncing = null

// Retorna { sent, failed: [{clientUuid, error}] }. Itens com erro de validação ficam na fila com a mensagem.
export function syncQueue() {
  if (syncing) return syncing
  syncing = (async () => {
    const q = await listQueue()
    if (!q.length || !navigator.onLine) return { sent: 0, failed: [] }
    const { results } = await api('/field/surveys/batch', { method: 'POST', body: { items: q } })
    const ok = new Set(results.filter((r) => r.ok).map((r) => r.clientUuid))
    const errors = Object.fromEntries(results.filter((r) => !r.ok).map((r) => [r.clientUuid, r.error]))
    const rest = q.filter((x) => !ok.has(x.clientUuid)).map((x) => ({ ...x, lastError: errors[x.clientUuid] || x.lastError }))
    await set(KEY, rest)
    return { sent: ok.size, failed: rest.map((x) => ({ clientUuid: x.clientUuid, error: x.lastError })) }
  })().finally(() => {
    syncing = null
  })
  return syncing
}

export function newUuid() {
  if (crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`
}
