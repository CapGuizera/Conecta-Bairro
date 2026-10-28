import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, ClipboardList, Download, LayoutDashboard, LogOut, ShieldCheck, Smile } from 'lucide-react'
import { api } from '../api.js'
import { Avatar, ErrorBox, Modal, StarInput } from '../components/ui.jsx'
import { since } from '../format.js'
import { useSession } from '../session.jsx'

const ROLE = { usuario: null, agente: 'Agente de campo', moderador: 'Moderação', instituicao: 'Instituição parceira' }

// Plano de aplicação, etapa 3: questionário estruturado de satisfação.
function SatisfactionDialog({ group, onClose, onDone }) {
  const [score, setScore] = useState(0)
  const [ease, setEase] = useState(0)
  const [willContinue, setWillContinue] = useState(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState(null)
  return (
    <Modal title="Pesquisa de satisfação" onClose={onClose}>
      <p className="small muted">Leva 30 segundos e ajuda o projeto a melhorar.</p>
      <div className="field">
        <span>De modo geral, qual sua satisfação com o ConectaBairro?</span>
        <StarInput value={score} onChange={setScore} />
      </div>
      <div className="field">
        <span>Foi fácil usar?</span>
        <StarInput value={ease} onChange={setEase} />
      </div>
      <div className="field">
        <span>Pretende continuar usando?</span>
        <div className="segmented">
          <button type="button" className={willContinue === true ? 'on' : ''} onClick={() => setWillContinue(true)}>
            Sim
          </button>
          <button type="button" className={willContinue === false ? 'on' : ''} onClick={() => setWillContinue(false)}>
            Não
          </button>
        </div>
      </div>
      <label className="field">
        <span>Comentário (opcional)</span>
        <textarea className="input" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={800} />
      </label>
      <ErrorBox error={error} />
      <button
        className="btn block"
        disabled={!score || !ease || willContinue === null}
        onClick={async () => {
          try {
            await api('/satisfaction', { method: 'POST', body: { group, score, ease, willContinue, comment } })
            onDone()
          } catch (err) {
            setError(err)
          }
        }}
      >
        Enviar respostas
      </button>
    </Modal>
  )
}

export default function Profile() {
  const { user, setUser, logout, showToast } = useSession()
  const navigate = useNavigate()
  const [name, setName] = useState(user.name)
  const [bio, setBio] = useState(user.bio || '')
  const [busy, setBusy] = useState(false)
  const [survey, setSurvey] = useState(false)
  const [answeredAt, setAnsweredAt] = useState(undefined)
  const [installEvent, setInstallEvent] = useState(null)

  useEffect(() => {
    api('/satisfaction/mine').then((r) => setAnsweredAt(r.answeredAt)).catch(() => {})
    const onPrompt = (e) => {
      e.preventDefault()
      setInstallEvent(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  async function save(patch) {
    setBusy(true)
    try {
      const r = await api('/me', { method: 'PATCH', body: patch })
      setUser(r.user)
      showToast('Perfil atualizado', 'ok')
      return r.user
    } catch (err) {
      showToast(err.message, 'error')
      return null
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="row gap-lg mb">
        <Avatar name={user.name} size="lg" />
        <div className="grow">
          <h1 style={{ marginBottom: 2 }}>{user.name}</h1>
          <div className="small muted">
            {user.phone.replace('+55', '').replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')} · desde {since(user.memberSince)}
          </div>
          {ROLE[user.role] && <span className="badge primary mt">{ROLE[user.role]}</span>}
        </div>
      </div>

      <div className="list mb">
        {user.isProvider && user.role === 'usuario' && (
          <Link to="/painel" className="list-item">
            <LayoutDashboard size={20} /> <span className="grow">Painel do prestador</span>
          </Link>
        )}
        {['agente', 'moderador'].includes(user.role) && (
          <Link to="/campo" className="list-item">
            <ClipboardList size={20} /> <span className="grow">Cadastro de campo</span>
          </Link>
        )}
        {user.role === 'moderador' && (
          <Link to="/moderacao" className="list-item">
            <ShieldCheck size={20} /> <span className="grow">Moderação</span>
          </Link>
        )}
        {['instituicao', 'moderador'].includes(user.role) && (
          <Link to="/indicadores" className="list-item">
            <BarChart3 size={20} /> <span className="grow">Indicadores do bairro</span>
          </Link>
        )}
        <button className="list-item" onClick={() => setSurvey(true)}>
          <Smile size={20} />
          <span className="grow">Pesquisa de satisfação</span>
          {answeredAt ? <span className="badge ok">Respondida</span> : answeredAt === null && <span className="badge accent">Pendente</span>}
        </button>
        {installEvent && (
          <button
            className="list-item"
            onClick={async () => {
              installEvent.prompt()
              await installEvent.userChoice
              setInstallEvent(null)
            }}
          >
            <Download size={20} /> <span className="grow">Instalar o aplicativo neste aparelho</span>
          </button>
        )}
      </div>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          save({ name, bio })
        }}
      >
        <h2>Meus dados</h2>
        <label className="field">
          <span>Nome</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        {user.isProvider && (
          <label className="field">
            <span>Apresentação</span>
            <textarea className="input" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={400} placeholder="Conte aos vizinhos o que você faz" />
          </label>
        )}
        <button className="btn" disabled={busy}>
          Salvar
        </button>
      </form>

      {user.role === 'usuario' && (
        <div className="card">
          <h2>Oferecer serviços</h2>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={user.isProvider}
              disabled={busy}
              onChange={async (e) => {
                const u = await save({ isProvider: e.target.checked })
                if (u?.isProvider) navigate('/painel')
              }}
            />
            <span>
              Quero oferecer serviços ou produtos no bairro
              <br />
              <span className="small muted">Sem CNPJ e sem mostrar seu endereço: os vizinhos veem só a distância aproximada.</span>
            </span>
          </label>
        </div>
      )}

      <button
        className="btn danger block mt-lg"
        onClick={() => {
          logout()
          navigate('/')
        }}
      >
        <LogOut size={18} /> Sair
      </button>

      {survey && (
        <SatisfactionDialog
          group={user.isProvider ? 'prestador' : 'contratante'}
          onClose={() => setSurvey(false)}
          onDone={() => {
            setSurvey(false)
            setAnsweredAt(new Date().toISOString())
            showToast('Obrigado pelas respostas!', 'ok')
          }}
        />
      )}
    </div>
  )
}
