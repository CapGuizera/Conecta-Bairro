import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { api } from '../api.js'
import { Empty, ErrorBox, Loading, useLoad } from '../components/ui.jsx'
import { brl, relative, ymdToBr } from '../format.js'
import { useRealtime } from '../session.jsx'

const TONE = { solicitada: 'warn', proposta_enviada: 'accent', aceita: 'primary', em_andamento: 'primary', concluida: 'ok', cancelada: '' }

export default function Contracts() {
  const [tab, setTab] = useState('abertas')
  const { data, error, loading, reload } = useLoad(() => api('/contracts'), [])
  useRealtime((ev) => ev === 'contract' && reload())
  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} />
  const list = data.contracts.filter((c) =>
    tab === 'abertas' ? !['concluida', 'cancelada'].includes(c.status) : tab === 'concluidas' ? c.status === 'concluida' : c.status === 'cancelada',
  )
  return (
    <div>
      <h1>Contratações</h1>
      <div className="tabs">
        {[
          ['abertas', 'Em aberto'],
          ['concluidas', 'Concluídas'],
          ['canceladas', 'Canceladas'],
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty icon={ClipboardList} title="Nada por aqui">
          As contratações começam pelo chat, com o botão "Solicitar este serviço".
        </Empty>
      ) : (
        <div className="list">
          {list.map((c) => (
            <Link key={c.id} to={`/conversas/${c.conversationId}`} className="list-item">
              <div className="grow">
                <div className="row between">
                  <span className="strong ellipsis">{c.offerTitle}</span>
                  <span className={`badge ${TONE[c.status]}`}>{c.statusLabel}</span>
                </div>
                <div className="small muted">
                  {c.side === 'client' ? 'Prestador' : 'Cliente'}: {c.counterpart.name}
                </div>
                <div className="row between small">
                  <span>{c.amountCents ? `${brl(c.amountCents)} · prazo ${ymdToBr(c.deadline)}` : 'Aguardando proposta'}</span>
                  <span className="tiny muted">{relative(c.updatedAt)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
