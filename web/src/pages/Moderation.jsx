// RF15: fila de denúncias da moderação.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { api } from '../api.js'
import { Empty, ErrorBox, Loading, Modal, useLoad } from '../components/ui.jsx'
import { dateTime } from '../format.js'
import { useSession } from '../session.jsx'

const ACTIONS = {
  oferta: [
    ['remover_oferta', 'Remover a oferta'],
    ['advertir', 'Advertir o prestador'],
  ],
  usuario: [
    ['advertir', 'Advertir o usuário'],
    ['bloquear_usuario', 'Suspender a conta'],
  ],
  mensagem: [
    ['ocultar_mensagem', 'Ocultar a mensagem'],
    ['advertir', 'Advertir o autor'],
    ['bloquear_usuario', 'Suspender o autor'],
  ],
}

function ResolveDialog({ report, onClose, onDone }) {
  const [decision, setDecision] = useState('procedente')
  const [action, setAction] = useState(ACTIONS[report.targetType][0][0])
  const [resolution, setResolution] = useState('')
  const [error, setError] = useState(null)
  return (
    <Modal title="Analisar denúncia" onClose={onClose}>
      <div className="segmented mb">
        <button className={decision === 'procedente' ? 'on' : ''} onClick={() => setDecision('procedente')}>
          Procedente
        </button>
        <button className={decision === 'improcedente' ? 'on' : ''} onClick={() => setDecision('improcedente')}>
          Improcedente
        </button>
      </div>
      {decision === 'procedente' && (
        <div className="field">
          <span>Providência</span>
          {[...ACTIONS[report.targetType], ['nenhuma', 'Apenas registrar']].map(([id, label]) => (
            <label className="checkbox" key={id}>
              <input type="radio" name="action" checked={action === id} onChange={() => setAction(id)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      )}
      <label className="field">
        <span>Justificativa</span>
        <textarea className="input" value={resolution} onChange={(e) => setResolution(e.target.value)} maxLength={500} />
      </label>
      <ErrorBox error={error} />
      <button
        className="btn block"
        onClick={async () => {
          try {
            await api(`/moderation/reports/${report.id}/resolve`, { method: 'POST', body: { decision, action: decision === 'procedente' ? action : 'nenhuma', resolution } })
            onDone()
          } catch (err) {
            setError(err)
          }
        }}
      >
        Registrar decisão
      </button>
    </Modal>
  )
}

export default function Moderation() {
  const { showToast } = useSession()
  const [status, setStatus] = useState('aberta')
  const [resolving, setResolving] = useState(null)
  const { data, error, loading, reload } = useLoad(() => api(`/moderation/reports?status=${status}`), [status])

  return (
    <div>
      <h1>Moderação</h1>
      <div className="tabs">
        {[
          ['aberta', `Abertas${data?.counts ? ` (${data.counts.aberta})` : ''}`],
          ['procedente', 'Procedentes'],
          ['improcedente', 'Improcedentes'],
        ].map(([id, label]) => (
          <button key={id} className={status === id ? 'on' : ''} onClick={() => setStatus(id)}>
            {label}
          </button>
        ))}
      </div>
      {loading && !data && <Loading />}
      <ErrorBox error={error} />
      {data && data.reports.length === 0 && <Empty icon={ShieldCheck} title="Nenhuma denúncia aqui" />}
      <div className="stack">
        {data?.reports.map((r) => (
          <div key={r.id} className="card">
            <div className="row between wrap">
              <span className="badge warn">{r.reasonLabel}</span>
              <span className="tiny muted">
                {dateTime(r.createdAt)} · por {r.reporterName}
              </span>
            </div>
            <div className="mt">
              <div className="small muted">
                {{ oferta: 'Oferta', usuario: 'Usuário', mensagem: 'Mensagem' }[r.targetType]}
                {r.target?.ownerName ? ` de ${r.target.ownerName}` : ''}
              </div>
              <div className="strong">{r.target?.link ? <Link to={r.target.link}>{r.target.title}</Link> : r.target?.title || 'Item removido'}</div>
              {r.target?.text && <p className="small" style={{ whiteSpace: 'pre-wrap', margin: '4px 0' }}>{r.target.text}</p>}
            </div>
            {r.details && (
              <div className="notice small">
                <span>{r.details}</span>
              </div>
            )}
            {r.status === 'aberta' ? (
              <button className="btn sm mt" onClick={() => setResolving(r)}>
                Analisar
              </button>
            ) : (
              <div className="small muted mt">Decisão: {r.resolution || r.status}</div>
            )}
          </div>
        ))}
      </div>
      {resolving && (
        <ResolveDialog
          report={resolving}
          onClose={() => setResolving(null)}
          onDone={() => {
            setResolving(null)
            showToast('Decisão registrada', 'ok')
            reload()
          }}
        />
      )}
    </div>
  )
}
