// RF10: comprovante da contratação concluída, com apuração da comissão.
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { api } from '../api.js'
import { ErrorBox, Loading, useLoad } from '../components/ui.jsx'
import { brl, dateTime, ymdToBr } from '../format.js'

export default function Receipt() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, error, loading } = useLoad(() => api(`/contracts/${id}/receipt`), [id])
  if (loading) return <Loading />
  if (error) return <ErrorBox error={error} />
  const r = data.receipt
  return (
    <div className="receipt">
      <div className="row between no-print mb">
        <button className="btn ghost sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} /> Voltar
        </button>
        <button className="btn outline sm" onClick={() => window.print()}>
          <Printer size={16} /> Imprimir ou salvar PDF
        </button>
      </div>
      <div className="card">
        <div className="row mb">
          <img src="/icon.svg" alt="" width={40} height={40} style={{ borderRadius: 10 }} />
          <div>
            <div className="strong">ConectaBairro</div>
            <div className="small muted">Comprovante de serviço</div>
          </div>
        </div>
        <div className="line">
          <span className="muted">Código</span>
          <span className="code strong">{r.receiptCode}</span>
        </div>
        <div className="line">
          <span className="muted">Emitido em</span>
          <span>{dateTime(r.issuedAt)}</span>
        </div>
        <div className="line">
          <span className="muted">Serviço</span>
          <span className="strong" style={{ textAlign: 'right' }}>{r.offerTitle}</span>
        </div>
        <div className="line">
          <span className="muted">Prestador</span>
          <span>{r.providerName}</span>
        </div>
        <div className="line">
          <span className="muted">Contratante</span>
          <span>{r.clientName}</span>
        </div>
        <div className="line">
          <span className="muted">Combinado para</span>
          <span>{ymdToBr(r.deadline)}</span>
        </div>
        <div className="line">
          <span className="muted">Concluído em</span>
          <span>{dateTime(r.concludedAt)}</span>
        </div>
        <div className="line mt">
          <span>Valor do serviço</span>
          <span>{brl(r.grossCents)}</span>
        </div>
        <div className="line">
          <span>Taxa do ConectaBairro ({(r.rate * 100).toLocaleString('pt-BR')}%)</span>
          <span>- {brl(r.commissionCents)}</span>
        </div>
        <div className="line total">
          <span>Fica para quem fez</span>
          <span>{brl(r.netCents)}</span>
        </div>
        <p className="tiny muted mt">
          Contratação nº {r.contractId}. Este é um protótipo do projeto UPX IV da FACENS: nenhum valor foi cobrado de verdade.
        </p>
      </div>
    </div>
  )
}
