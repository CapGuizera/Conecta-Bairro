// RF04: o prestador marca onde atende. O ponto vai para o servidor e não volta mais para nenhum cliente.
import { useState } from 'react'
import { Crosshair, Loader2, Lock } from 'lucide-react'
import { api } from '../api.js'
import { getCurrentPosition } from '../position.js'
import { useSession } from '../session.jsx'
import { PickPointMap } from './Maps.jsx'

export function ProviderLocation({ onSaved, onCancel }) {
  const { meta, location, setLocation, showToast } = useSession()
  const [point, setPoint] = useState(null)
  const [radius, setRadius] = useState(location.serviceRadiusKm || 3)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function gps() {
    setBusy('gps')
    setError('')
    try {
      setPoint(await getCurrentPosition())
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  async function save() {
    setBusy('save')
    setError('')
    try {
      const r = point
        ? await api('/me/location', { method: 'PUT', body: { lat: point.lat, lng: point.lng, serviceRadiusKm: radius } })
        : await api('/me/location', { method: 'PATCH', body: { serviceRadiusKm: radius } })
      setLocation(r.location)
      showToast('Salvo!', 'ok')
      onSaved?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="card">
      <h2>De onde você atende?</h2>
      <div className="notice mb">
        <Lock size={18} />
        <span className="small">
          Esse ponto serve só pra calcular a distância. Os vizinhos veem algo como "a 1,2 km de você", e a conta é feita a partir de um ponto que a
          gente afasta de 100 a 300 metros da sua casa. Ninguém vê sua rua nem seu número.
        </span>
      </div>
      <button className="btn outline block mb" onClick={gps} disabled={!!busy}>
        {busy === 'gps' ? <Loader2 size={18} className="spin" /> : <Crosshair size={18} />} Estou no lugar onde atendo
      </button>
      <p className="small muted">Ou toca no mapa pra marcar.</p>
      <PickPointMap value={point} onChange={setPoint} fallback={meta.pilot} radiusKm={radius} />
      <label className="field mt">
        <span>
          Atendo até {String(radius).replace('.', ',')} km de distância
          <span className="hint">Até onde vale a pena o cliente vir até você, ou você ir até ele.</span>
        </span>
        <input type="range" min={0.5} max={20} step={0.5} value={radius} onChange={(e) => setRadius(Number(e.target.value))} />
      </label>
      {error && <div className="error">{error}</div>}
      <div className="row">
        {onCancel && (
          <button className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
        <button className="btn grow" onClick={save} disabled={!!busy || (!point && !location.hasLocation)}>
          {busy === 'save' && <Loader2 size={18} className="spin" />}
          {point || !location.hasLocation ? 'Salvar' : 'Salvar distância'}
        </button>
      </div>
    </div>
  )
}
