// RF03 (cadastro assistido) e RF18 (operação offline) usados na pesquisa de campo.
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, CloudOff, Crosshair, Loader2, MapPin, RefreshCw, UploadCloud } from 'lucide-react'
import { ApiError, api } from '../api.js'
import { PickPointMap } from '../components/Maps.jsx'
import { Empty, ErrorBox, useLoad } from '../components/ui.jsx'
import { dateTime, formatPhoneInput } from '../format.js'
import { enqueue, listQueue, newUuid, syncQueue } from '../offline-queue.js'
import { getCurrentPosition } from '../position.js'
import { useSession } from '../session.jsx'

const EMPTY = {
  businessName: '',
  category: '',
  appearsOnMaps: '',
  barriers: [],
  notes: '',
  accepted: null,
  consent: false,
  name: '',
  phone: '',
  point: null,
  serviceRadiusKm: 2,
  offerTitle: '',
  offerDescription: '',
  offerKind: 'servico',
  priceMin: '',
  priceMax: '',
}

function toPayload(f) {
  return {
    clientUuid: newUuid(),
    collectedAt: new Date().toISOString(),
    businessName: f.businessName,
    category: f.category,
    appearsOnMaps: f.appearsOnMaps,
    barriers: f.barriers,
    notes: f.notes,
    accepted: f.accepted === true,
    provider: f.accepted
      ? {
          consent: f.consent,
          name: f.name,
          phone: f.phone,
          lat: f.point?.lat,
          lng: f.point?.lng,
          serviceRadiusKm: f.serviceRadiusKm,
          offer: { title: f.offerTitle || f.businessName, description: f.offerDescription, category: f.category, kind: f.offerKind, priceMin: f.priceMin, priceMax: f.priceMax },
        }
      : undefined,
  }
}

export default function Field() {
  const { meta, showToast } = useSession()
  const [f, setF] = useState(EMPTY)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState(null)
  const [queue, setQueue] = useState([])
  const history = useLoad(() => api('/field/surveys'), [])

  const refreshQueue = useCallback(async () => setQueue(await listQueue()), [])

  const sync = useCallback(async () => {
    if (!navigator.onLine) return
    setBusy((b) => b || 'sync')
    try {
      const r = await syncQueue()
      if (r.sent) {
        showToast(`${r.sent} cadastro(s) offline enviado(s)`, 'ok')
        history.reload()
      }
    } catch {
      /* continua na fila */
    } finally {
      setBusy((b) => (b === 'sync' ? '' : b))
      refreshQueue()
    }
  }, [refreshQueue, showToast]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refreshQueue().then(sync)
    window.addEventListener('online', sync)
    return () => window.removeEventListener('online', sync)
  }, [refreshQueue, sync])

  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? (v.target.type === 'checkbox' ? v.target.checked : v.target.value) : v }))
  const toggleBarrier = (id) => setF((s) => ({ ...s, barriers: s.barriers.includes(id) ? s.barriers.filter((b) => b !== id) : [...s.barriers, id] }))

  async function gps() {
    setBusy('gps')
    try {
      set('point')(await getCurrentPosition())
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setBusy('')
    }
  }

  async function submit(e) {
    e.preventDefault()
    setError(null)
    const payload = toPayload(f)
    setBusy('save')
    try {
      if (!navigator.onLine) throw new ApiError(0, 'offline')
      await api('/field/surveys', { method: 'POST', body: payload })
      showToast('Registro enviado', 'ok')
      history.reload()
      setF(EMPTY)
    } catch (err) {
      if (err.status === 0) {
        await enqueue(payload)
        await refreshQueue()
        showToast('Sem conexão: registro guardado no aparelho e será enviado depois', 'ok')
        setF(EMPTY)
      } else {
        setError(err)
      }
    } finally {
      setBusy('')
    }
  }

  const valid =
    f.businessName && f.category && f.appearsOnMaps && f.accepted !== null && (!f.accepted || (f.consent && f.name && f.phone.replace(/\D/g, '').length >= 10 && f.point))

  return (
    <div style={{ maxWidth: 720 }}>
      <h1>Cadastro de campo</h1>
      <p className="muted small">Levantamento dos negócios do bairro e cadastro assistido. Funciona sem internet: os registros ficam no aparelho até a conexão voltar.</p>

      {queue.length > 0 && (
        <div className="notice warn mb">
          <CloudOff size={18} />
          <div className="grow small">
            <strong>{queue.length} registro(s) aguardando envio.</strong>
            {queue.some((q) => q.lastError) && (
              <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                {queue
                  .filter((q) => q.lastError)
                  .map((q) => (
                    <li key={q.clientUuid}>
                      {q.businessName}: {q.lastError}
                    </li>
                  ))}
              </ul>
            )}
          </div>
          <button className="btn sm" onClick={sync} disabled={busy === 'sync' || !navigator.onLine}>
            {busy === 'sync' ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} Enviar agora
          </button>
        </div>
      )}

      <form className="card" onSubmit={submit}>
        <h2>1. Negócio levantado</h2>
        <label className="field">
          <span>Nome do negócio ou do prestador</span>
          <input className="input" value={f.businessName} onChange={set('businessName')} maxLength={100} placeholder="Ex.: Bolos da Ivone" />
        </label>
        <label className="field">
          <span>Categoria</span>
          <select className="input" value={f.category} onChange={set('category')}>
            <option value="">Escolha...</option>
            {meta.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>O negócio aparece no Google Maps ou em outro mapa digital?</span>
          <div className="segmented">
            {[
              ['sim', 'Sim'],
              ['nao', 'Não'],
              ['nao_sabe', 'Não sabe'],
            ].map(([v, l]) => (
              <button type="button" key={v} className={f.appearsOnMaps === v ? 'on' : ''} onClick={() => set('appearsOnMaps')(v)}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Motivos declarados para não estar em plataformas digitais</span>
          {Object.entries(meta.barriers).map(([id, label]) => (
            <label className="checkbox" key={id}>
              <input type="checkbox" checked={f.barriers.includes(id)} onChange={() => toggleBarrier(id)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <label className="field">
          <span>Observações</span>
          <textarea className="input" value={f.notes} onChange={set('notes')} maxLength={800} />
        </label>

        <h2 className="mt-lg">2. Cadastro na plataforma</h2>
        <div className="segmented mb">
          <button type="button" className={f.accepted === true ? 'on' : ''} onClick={() => set('accepted')(true)}>
            Aceitou se cadastrar
          </button>
          <button type="button" className={f.accepted === false ? 'on' : ''} onClick={() => set('accepted')(false)}>
            Não aceitou
          </button>
        </div>

        {f.accepted && (
          <>
            <label className="checkbox mb">
              <input type="checkbox" checked={f.consent} onChange={set('consent')} />
              <span className="small">
                <strong>O prestador autorizou o cadastro em seu nome</strong> e foi informado de que o endereço não será divulgado, de que os vizinhos verão só
                a distância aproximada e de que ele poderá entrar depois com o próprio celular.
              </span>
            </label>
            <div className="grid two">
              <label className="field">
                <span>Nome do prestador</span>
                <input className="input" value={f.name} onChange={set('name')} maxLength={80} />
              </label>
              <label className="field">
                <span>Celular do prestador</span>
                <input className="input" inputMode="tel" value={f.phone} onChange={(e) => set('phone')(formatPhoneInput(e.target.value))} placeholder="(15) 99876-5432" />
              </label>
            </div>
            <div className="field">
              <span>Ponto de atendimento</span>
              <button type="button" className="btn outline block" onClick={gps} disabled={busy === 'gps'}>
                {busy === 'gps' ? <Loader2 size={18} className="spin" /> : <Crosshair size={18} />} Usar minha posição (estou no local)
              </button>
              {f.point ? (
                <div className="small mt row">
                  <MapPin size={14} color="var(--ok)" /> Ponto registrado{f.point.accuracy ? ` (precisão de ${f.point.accuracy} m)` : ''}. Ele não é exibido a ninguém.
                </div>
              ) : (
                <div className="small muted mt">Com internet, também dá para tocar no mapa:</div>
              )}
              {navigator.onLine && (
                <div className="mt">
                  <PickPointMap value={f.point} onChange={set('point')} fallback={meta.pilot} radiusKm={f.serviceRadiusKm} />
                </div>
              )}
            </div>
            <label className="field">
              <span>Atende até {String(f.serviceRadiusKm).replace('.', ',')} km</span>
              <input type="range" min={0.5} max={20} step={0.5} value={f.serviceRadiusKm} onChange={(e) => set('serviceRadiusKm')(Number(e.target.value))} />
            </label>
            <h3>Primeira oferta</h3>
            <div className="segmented mb">
              <button type="button" className={f.offerKind === 'servico' ? 'on' : ''} onClick={() => set('offerKind')('servico')}>
                Serviço
              </button>
              <button type="button" className={f.offerKind === 'produto' ? 'on' : ''} onClick={() => set('offerKind')('produto')}>
                Produto
              </button>
            </div>
            <label className="field">
              <span>Título da oferta</span>
              <input className="input" value={f.offerTitle} onChange={set('offerTitle')} maxLength={80} placeholder={f.businessName || 'Ex.: Ajustes de roupa'} />
            </label>
            <label className="field">
              <span>Descrição</span>
              <textarea className="input" value={f.offerDescription} onChange={set('offerDescription')} maxLength={1500} />
            </label>
            <div className="grid two">
              <label className="field">
                <span>Preço a partir de (R$)</span>
                <input className="input" inputMode="decimal" value={f.priceMin} onChange={set('priceMin')} />
              </label>
              <label className="field">
                <span>Até (R$)</span>
                <input className="input" inputMode="decimal" value={f.priceMax} onChange={set('priceMax')} />
              </label>
            </div>
          </>
        )}

        <ErrorBox error={error} />
        <button className="btn block mt" disabled={!valid || busy === 'save'}>
          {busy === 'save' ? <Loader2 size={18} className="spin" /> : <UploadCloud size={18} />} Registrar
        </button>
      </form>

      <div className="section-title">
        <h2>Registros enviados</h2>
        {history.data && <span className="small muted">{history.data.surveys.length}</span>}
      </div>
      <ErrorBox error={history.error} />
      {history.data && history.data.surveys.length === 0 && <Empty title="Nenhum registro ainda" />}
      {history.data && history.data.surveys.length > 0 && (
        <div className="list">
          {history.data.surveys.map((s) => (
            <div key={s.id} className="list-item" style={{ cursor: 'default' }}>
              {s.accepted ? <CheckCircle2 size={20} color="var(--ok)" /> : <CloudOff size={20} color="var(--muted)" />}
              <div className="grow">
                <div className="strong">{s.businessName}</div>
                <div className="small muted">
                  {s.categoryName} · {s.accepted ? 'cadastrado' : 'não aceitou'} · mapas: {{ sim: 'sim', nao: 'não', nao_sabe: 'não sabe' }[s.appearsOnMaps]}
                </div>
              </div>
              <span className="tiny muted nowrap">{dateTime(s.collectedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
