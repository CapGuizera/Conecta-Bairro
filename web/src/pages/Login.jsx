// RF01: entrada por celular com código de verificação.
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react'
import { api } from '../api.js'
import { formatPhoneInput } from '../format.js'
import { useSession } from '../session.jsx'

export default function Login() {
  const { user, login, meta } = useSession()
  const navigate = useNavigate()
  const from = useLocation().state?.from || '/'
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState('')
  const [name, setName] = useState('')
  const [isProvider, setIsProvider] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to={from} replace />

  async function requestCode(e, phoneValue = phone) {
    e?.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await api('/auth/request-code', { method: 'POST', body: { phone: phoneValue } })
      setDevCode(r.devCode || '')
      setCode(r.devCode || '')
      setStep('code')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function verify(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await api('/auth/verify', { method: 'POST', body: { phone, code, name: step === 'name' ? name : undefined, isProvider } })
      if (r.needsName) {
        setStep('name')
      } else {
        await login(r.token)
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="card">
        <img src="/icon.svg" alt="" className="logo" />
        <h1>ConectaBairro</h1>
        <p className="muted">Serviços e comércio do seu bairro, sem expor o endereço de ninguém.</p>

        {step === 'phone' && (
          <form onSubmit={requestCode}>
            <label className="field">
              <span>Seu celular</span>
              <input
                className="input"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(15) 99876-5432"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                autoFocus
              />
              <span className="hint">Enviamos um código para confirmar que o número é seu. Não pedimos CNPJ nem documentos.</span>
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn block" disabled={busy || phone.replace(/\D/g, '').length < 10}>
              {busy && <Loader2 size={18} className="spin" />} Receber código
            </button>
            {meta?.demoAccounts?.length > 0 && (
              <div className="mt-lg">
                <div className="small strong">Contas de demonstração</div>
                <div className="tiny muted">Modo de teste: o código aparece na tela, sem SMS.</div>
                <div className="demo-accounts">
                  {meta.demoAccounts.map((a) => (
                    <button
                      type="button"
                      key={a.phone}
                      onClick={() => {
                        setPhone(a.phone)
                        requestCode(null, a.phone)
                      }}
                    >
                      <span className="strong">{a.name}</span> <span className="muted">· {a.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={verify}>
            <button type="button" className="btn ghost sm mb" onClick={() => setStep('phone')}>
              <ArrowLeft size={16} /> {phone}
            </button>
            {devCode && (
              <div className="notice mb">
                <ShieldCheck size={18} />
                <span>
                  Modo demonstração: seu código é <strong>{devCode}</strong>. Em produção ele chega por SMS.
                </span>
              </div>
            )}
            <label className="field">
              <span>Código de 6 dígitos</span>
              <input
                className="input code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn block" disabled={busy || code.length !== 6}>
              {busy && <Loader2 size={18} className="spin" />} Confirmar
            </button>
          </form>
        )}

        {step === 'name' && (
          <form onSubmit={verify}>
            <h2>Bem-vindo ao bairro</h2>
            <label className="field">
              <span>Como podemos te chamar?</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus autoComplete="name" />
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={isProvider} onChange={(e) => setIsProvider(e.target.checked)} />
              <span>
                <strong>Também quero oferecer serviços ou produtos</strong>
                <br />
                <span className="small muted">Você aparece para os vizinhos só pela distância aproximada. Seu endereço nunca é mostrado.</span>
              </span>
            </label>
            {error && <div className="error">{error}</div>}
            <button className="btn block mt" disabled={busy || !name.trim()}>
              {busy && <Loader2 size={18} className="spin" />} Criar minha conta
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
