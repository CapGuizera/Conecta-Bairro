import { useState } from 'react'
import { Crosshair, Home, Loader2 } from 'lucide-react'
import { getCurrentPosition } from '../position.js'
import { PickPointMap } from './Maps.jsx'
import { Modal } from './ui.jsx'

// Escolha do ponto de busca do morador: GPS, clique no mapa ou centro do bairro piloto.
export function LocationDialog({ current, pilot, onClose, onSave }) {
  const [point, setPoint] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function useGps() {
    setBusy(true)
    setError('')
    try {
      const p = await getCurrentPosition()
      onSave({ ...p, source: 'gps' })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="De onde você está buscando?" onClose={onClose}>
      <button className="btn block" onClick={useGps} disabled={busy}>
        {busy ? <Loader2 size={18} className="spin" /> : <Crosshair size={18} />} Usar minha localização atual
      </button>
      {error && <div className="error mt">{error}</div>}
      <p className="small muted mt">Ou toque no mapa para escolher um ponto. Sua posição fica só neste aparelho.</p>
      <PickPointMap value={point} fallback={pilot} onChange={(p) => setPoint({ ...p, source: 'mapa' })} />
      <div className="row mt">
        <button className="btn ghost" onClick={() => onSave({ lat: pilot.lat, lng: pilot.lng, source: 'piloto' })}>
          <Home size={16} /> Centro do bairro
        </button>
        <span className="grow" />
        <button className="btn" disabled={!point || point.source !== 'mapa'} onClick={() => onSave(point)}>
          Usar este ponto
        </button>
      </div>
    </Modal>
  )
}
