// RF07 a RF11 numa única tela: chat interno, proposta e aceite, estados da contratação,
// conclusão com comissão e avaliação mútua.
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Flag, Loader2, Play, Receipt, Send, ShieldAlert, X } from 'lucide-react'
import { api } from '../api.js'
import { ReportDialog } from '../components/ReportDialog.jsx'
import { Avatar, ErrorBox, Loading, Modal, StarInput, useLoad } from '../components/ui.jsx'
import { brl, firstName, localYmd, time, ymdToBr } from '../format.js'
import { useRealtime, useSession } from '../session.jsx'

const STEPS = ['solicitada', 'proposta_enviada', 'aceita', 'em_andamento', 'concluida']

function Progress({ status }) {
  const idx = status === 'cancelada' ? STEPS.length : STEPS.indexOf(status)
  return (
    <div className={`steps ${status === 'cancelada' ? 'cancelled' : ''}`}>
      {STEPS.map((s, i) => (
        <span key={s} className={i <= idx ? 'on' : ''} />
      ))}
    </div>
  )
}

function ProposalForm({ onSubmit, onClose }) {
  const [amount, setAmount] = useState('')
  const [deadline, setDeadline] = useState(localYmd(new Date(Date.now() + 2 * 86400000)))
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  return (
    <Modal title="Mandar orçamento" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await onSubmit({ amount, deadline, notes })
            onClose()
          } catch (err) {
            setError(err)
            setBusy(false)
          }
        }}
      >
        <label className="field">
          <span>Valor total (R$)</span>
          <input className="input" inputMode="decimal" placeholder="150,00" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ''))} autoFocus />
        </label>
        <label className="field">
          <span>Fica pronto até</span>
          <input className="input" type="date" value={deadline} min={localYmd()} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <label className="field">
          <span>Observações (opcional)</span>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} placeholder="O que está incluso, se entrega ou busca..." />
        </label>
        <ErrorBox error={error} />
        <button className="btn block" disabled={busy || !amount}>
          Mandar orçamento
        </button>
      </form>
    </Modal>
  )
}

function RequestForm({ offerTitle, onSubmit, onClose }) {
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  return (
    <Modal title="Pedir orçamento" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          try {
            await onSubmit(note)
            onClose()
          } catch (err) {
            setError(err)
            setBusy(false)
          }
        }}
      >
        <p className="small muted">Conta o que você precisa de "{offerTitle}". A resposta vem com preço e prazo.</p>
        <label className="field">
          <span>O que você precisa</span>
          <textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Bolo de chocolate pra 20 pessoas, sábado de manhã" autoFocus />
        </label>
        <ErrorBox error={error} />
        <button className="btn block" disabled={busy}>
          Pedir orçamento
        </button>
      </form>
    </Modal>
  )
}

function ReviewBox({ contract, onDone }) {
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  return (
    <div className="card mt">
      <h3>Como foi com {firstName(contract.counterpart.name)}?</h3>
      <p className="small muted">
        Os dois se avaliam. É isso que ajuda os vizinhos a saber em quem confiar.
      </p>
      <StarInput value={rating} onChange={setRating} />
      <textarea className="input mt" placeholder="Quer deixar um comentário? (opcional)" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} />
      <ErrorBox error={error} />
      <button
        className="btn block mt"
        disabled={!rating || busy}
        onClick={async () => {
          setBusy(true)
          try {
            await api(`/contracts/${contract.id}/review`, { method: 'POST', body: { rating, comment } })
            onDone()
          } catch (err) {
            setError(err)
            setBusy(false)
          }
        }}
      >
        Avaliar
      </button>
    </div>
  )
}

export default function Chat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { showToast, refreshUnread } = useSession()
  const { data, error, loading, reload, setData } = useLoad(() => api(`/conversations/${id}`), [id])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [modal, setModal] = useState(null)
  const [acting, setActing] = useState('')
  const [maskedNotice, setMaskedNotice] = useState(false)
  const bodyRef = useRef(null)

  const markRead = () => api(`/conversations/${id}/read`, { method: 'POST' }).then(refreshUnread).catch(() => {})

  useEffect(() => {
    markRead()
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight
  }, [data?.messages?.length, data?.contract?.status, data?.contract?.canReview])

  useRealtime((ev, payload) => {
    if (String(payload.conversationId) !== String(id)) return
    if (ev === 'message') {
      setData((d) => (d && !d.messages.some((m) => m.id === payload.id) ? { ...d, messages: [...d.messages, payload] } : d))
      markRead()
    }
    if (ev === 'contract') reload()
  })

  if (loading && !data) return <Loading />
  if (error) return <ErrorBox error={error} />
  const { conversation: conv, messages, contract, canRequest } = data

  async function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    try {
      const r = await api(`/conversations/${id}/messages`, { method: 'POST', body: { body: text } })
      setData((d) => (d.messages.some((m) => m.id === r.message.id) ? d : { ...d, messages: [...d.messages, r.message] }))
      setText('')
      if (r.message.masked) setMaskedNotice(true)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSending(false)
    }
  }

  async function act(action, confirmText) {
    if (confirmText) return setModal({ type: 'confirm', action, text: confirmText })
    setActing(action)
    try {
      await api(`/contracts/${contract.id}/actions`, { method: 'POST', body: { action } })
      await reload()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setActing('')
    }
  }

  const pendingProposal = contract?.proposals?.find((p) => p.status === 'pendente')
  const can = (a) => contract?.actions?.includes(a)

  return (
    <div className="chat">
      <div className="chat-head">
        <button className="icon-btn" onClick={() => navigate('/conversas')} aria-label="Voltar">
          <ArrowLeft size={20} />
        </button>
        <Avatar name={conv.other.name} />
        <div className="grow">
          <div className="strong ellipsis">
            {conv.other.isProvider ? <Link to={`/prestador/${conv.other.id}`}>{conv.other.name}</Link> : conv.other.name}
          </div>
          <Link to={`/oferta/${conv.offerId}`} className="small muted ellipsis" style={{ display: 'block' }}>
            {conv.offerTitle}
          </Link>
        </div>
        <button className="icon-btn" onClick={() => setModal({ type: 'report-user' })} aria-label="Denunciar">
          <Flag size={18} />
        </button>
      </div>

      {contract && (
        <div className="contract-bar">
          <div className="row between">
            <span className="strong small">{contract.statusLabel}</span>
            {contract.amountCents && (
              <span className="small">
                {brl(contract.amountCents)} · até {ymdToBr(contract.deadline)}
              </span>
            )}
          </div>
          <Progress status={contract.status} />
          <div className="row wrap" style={{ marginTop: 8 }}>
            {can('propor') && (
              <button className="btn sm" onClick={() => setModal({ type: 'proposal' })}>
                {contract.status === 'proposta_enviada' ? 'Refazer orçamento' : 'Mandar orçamento'}
              </button>
            )}
            {can('iniciar') && (
              <button className="btn sm" onClick={() => act('iniciar')} disabled={!!acting}>
                <Play size={14} /> Comecei o serviço
              </button>
            )}
            {can('concluir') && (
              <button className="btn sm" onClick={() => act('concluir', 'Marcar como concluído? A taxa da plataforma é de 6% e o comprovante sai na hora.')} disabled={!!acting}>
                <Check size={14} /> Terminei
              </button>
            )}
            {contract.status === 'concluida' && (
              <Link to={`/comprovante/${contract.id}`} className="btn sm outline">
                <Receipt size={14} /> Comprovante
              </Link>
            )}
            {can('cancelar') && (
              <button className="btn sm ghost" onClick={() => act('cancelar', 'Cancelar? A outra pessoa vai ser avisada.')} disabled={!!acting}>
                Cancelar
              </button>
            )}
            {canRequest && contract && (
              <button className="btn sm outline" onClick={() => setModal({ type: 'request' })}>
                Pedir outro orçamento
              </button>
            )}
            {acting && <Loader2 size={16} className="spin" />}
          </div>
        </div>
      )}

      <div className="chat-body" ref={bodyRef}>
        <div className="sys-msg">
          Por segurança, telefone, e-mail e links somem das mensagens. Combinem tudo por aqui.
        </div>
        {messages.map((m) => {
          if (m.kind === 'sistema') return <div key={m.id} className="sys-msg">{m.body}</div>
          if (m.kind === 'proposta' && m.proposal) {
            const p = m.proposal
            const live = pendingProposal && pendingProposal.id === p.id
            return (
              <div key={m.id} className="proposal-card">
                <div className="row between">
                  <span className="small strong">{m.senderId === conv.me ? 'Seu orçamento' : `Orçamento de ${firstName(conv.other.name)}`}</span>
                  <span className={`badge ${p.status === 'aceita' ? 'ok' : p.status === 'pendente' ? 'accent' : ''}`}>
                    {{ pendente: 'Esperando resposta', aceita: 'Aceito', recusada: 'Recusado', substituida: 'Trocado por outro' }[p.status]}
                  </span>
                </div>
                <div className="amount">{brl(p.amountCents)}</div>
                <div className="small">Pronto até {ymdToBr(p.deadline)}</div>
                {p.notes && <div className="small mt" style={{ marginTop: 4 }}>{p.notes}</div>}
                {live && conv.side === 'client' && (
                  <div className="row mt">
                    <button className="btn sm" onClick={() => act('aceitar')} disabled={!!acting}>
                      <Check size={14} /> Fechar negócio
                    </button>
                    <button className="btn sm ghost" onClick={() => act('recusar')} disabled={!!acting}>
                      <X size={14} /> Recusar
                    </button>
                  </div>
                )}
              </div>
            )
          }
          const mine = m.senderId === conv.me
          return (
            <div key={m.id} className={`bubble ${mine ? 'mine' : ''} ${m.masked ? 'masked' : ''}`}>
              {m.body}
              <span className="when">{time(m.createdAt)}</span>
            </div>
          )
        })}
        {contract?.canReview && <ReviewBox contract={contract} onDone={() => { showToast('Valeu pela avaliação!', 'ok'); reload() }} />}
        {contract?.status === 'concluida' && contract.myReview && (
          <div className="sys-msg">Você deu {contract.myReview.rating} {contract.myReview.rating === 1 ? 'estrela' : 'estrelas'}.</div>
        )}
      </div>

      {maskedNotice && (
        <div className="notice warn" style={{ marginTop: 8 }}>
          <ShieldAlert size={18} />
          <span className="small grow">
            Tiramos o contato da sua mensagem. Negociando por aqui fica tudo registrado e vocês podem se avaliar depois.
          </span>
          <button className="icon-btn" onClick={() => setMaskedNotice(false)} aria-label="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      )}

      {canRequest && !contract && (
        <button className="btn accent block" style={{ marginTop: 8 }} onClick={() => setModal({ type: 'request' })}>
          Pedir orçamento
        </button>
      )}

      <form className="chat-input" onSubmit={send}>
        <input className="input" placeholder="Escreve aqui..." value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
        <button className="btn" disabled={sending || !text.trim()} aria-label="Enviar">
          <Send size={18} />
        </button>
      </form>

      {modal?.type === 'proposal' && (
        <ProposalForm
          onClose={() => setModal(null)}
          onSubmit={async (body) => {
            await api(`/contracts/${contract.id}/proposals`, { method: 'POST', body })
            await reload()
          }}
        />
      )}
      {modal?.type === 'request' && (
        <RequestForm
          offerTitle={conv.offerTitle}
          onClose={() => setModal(null)}
          onSubmit={async (note) => {
            await api(`/conversations/${id}/contracts`, { method: 'POST', body: { note } })
            await reload()
          }}
        />
      )}
      {modal?.type === 'confirm' && (
        <Modal title="Tem certeza?" onClose={() => setModal(null)}>
          <p>{modal.text}</p>
          <div className="row">
            <button className="btn ghost grow" onClick={() => setModal(null)}>
              Voltar
            </button>
            <button
              className="btn grow"
              onClick={() => {
                const { action } = modal
                setModal(null)
                act(action)
              }}
            >
              Sim
            </button>
          </div>
        </Modal>
      )}
      {modal?.type === 'report-user' && <ReportDialog targetType="usuario" targetId={conv.other.id} onClose={() => setModal(null)} />}
    </div>
  )
}
