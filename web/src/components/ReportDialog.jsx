import { useState } from 'react'
import { api } from '../api.js'
import { useSession } from '../session.jsx'
import { Modal } from './ui.jsx'

// RF15
export function ReportDialog({ targetType, targetId, onClose }) {
  const { meta, showToast } = useSession()
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/reports', { method: 'POST', body: { targetType, targetId, reason, details } })
      showToast('Recebemos. A moderação vai dar uma olhada.', 'ok')
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="O que aconteceu?" onClose={onClose}>
      <form onSubmit={submit}>
        {Object.entries(meta?.reportReasons || {}).map(([id, label]) => (
          <label className="checkbox" key={id}>
            <input type="radio" name="reason" checked={reason === id} onChange={() => setReason(id)} />
            <span>{label}</span>
          </label>
        ))}
        <label className="field mt">
          <span>Quer contar mais? (opcional)</span>
          <textarea className="input" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={800} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn block" disabled={!reason || busy}>
          Enviar
        </button>
      </form>
    </Modal>
  )
}
