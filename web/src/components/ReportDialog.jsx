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
      showToast('Denúncia enviada. A moderação vai analisar.', 'ok')
      onClose()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <Modal title="Denunciar" onClose={onClose}>
      <form onSubmit={submit}>
        {Object.entries(meta?.reportReasons || {}).map(([id, label]) => (
          <label className="checkbox" key={id}>
            <input type="radio" name="reason" checked={reason === id} onChange={() => setReason(id)} />
            <span>{label}</span>
          </label>
        ))}
        <label className="field mt">
          <span>Detalhes (opcional)</span>
          <textarea className="input" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={800} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn block" disabled={!reason || busy}>
          Enviar denúncia
        </button>
      </form>
    </Modal>
  )
}
