import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BarChart3, ClipboardList, Download, LayoutDashboard, LogOut, ShieldCheck, Smile } from 'lucide-react'
import { api } from '../api.js'
import { Avatar, ErrorBox, Modal, StarInput } from '../components/ui.jsx'
import { since } from '../format.js'
import { useSession } from '../session.jsx'

const ROLE = { usuario: null, agente: 'Agente de campo', moderador: 'Moderação', instituicao: 'Parceiro do projeto' }

// Plano de aplicação, etapa 3: questionário estruturado de satisfação.
function SatisfactionDialog({ group, onClose, onDone }) {
  const [score, setScore] = useState(0)
  const [ease, setEase] = useState(0)
  const [willContinue, setWillContinue] = useState(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState(null)
  return (
    <Modal title="O que você está achando?" onClose={onClose}>
      <p className="small muted">São três perguntas. Sua resposta ajuda a gente a melhorar o projeto.</p>
      <div className="field">
        <span>No geral, está gostando?</span>
        <StarInput value={score} onChange={setScore} />
      </div>
      <div className="field">
        <span>Foi fácil de usar?</span>
        <StarInput value={ease} onChange={setEase} />
      </div>
      <div className="field">
        <span>Vai continuar usando?</span>
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
        <span>Quer falar mais alguma coisa? (opcional)</span>
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
        Enviar
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
      showToast('Salvo!', 'ok')
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
            <LayoutDashboard size={20} /> <span className="grow">Seu painel de anúncios</span>
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
          <span className="grow">O que você está achando?</span>
          {answeredAt ? <span className="badge ok">Respondido, valeu!</span> : answeredAt === null && <span className="badge accent">3 perguntas</span>}
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
            <Download size={20} /> <span className="grow">Instalar o app no celular</span>
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
        <h2>Seus dados</h2>
        <label className="field">
          <span>Nome</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </label>
        {user.isProvider && (
          <label className="field">
            <span>Sobre você</span>
            <textarea className="input" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={400} placeholder="Há quanto tempo faz, o que mais gosta de fazer..." />
          </label>
        )}
        <button className="btn" disabled={busy}>
          Salvar
        </button>
      </form>

      {user.role === 'usuario' && (
        <div className="card">
          <h2>Anunciar no bairro</h2>
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
              Quero anunciar o que eu faço ou vendo
              <br />
              <span className="small muted">Não precisa de CNPJ e ninguém vê seu endereço, só a que distância você está.</span>
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
            showToast('Valeu por responder!', 'ok')
          }}
        />
      )}
    </div>
  )
}
