// RF05 (busca por categoria e necessidade) e RF06 (filtro por raio), ordenados por distância.
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, Lock, MapPin, Search, SearchX } from 'lucide-react'
import { api, qs } from '../api.js'
import { LocationDialog } from '../components/LocationDialog.jsx'
import { RadiusMap } from '../components/Maps.jsx'
import { OfferCard } from '../components/OfferCard.jsx'
import { Empty, ErrorBox } from '../components/ui.jsx'
import { SOURCE_LABEL, geolocationAvailable, getCurrentPosition, usePosition } from '../position.js'
import { useSession } from '../session.jsx'

export default function Home() {
  const { meta, user } = useSession()
  const [params, setParams] = useSearchParams()
  const [position, setPosition] = usePosition(meta?.pilot)
  const [text, setText] = useState(params.get('q') || '')
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showLocation, setShowLocation] = useState(false)
  const [showMap, setShowMap] = useState(false)

  // Na primeira visita tenta usar o GPS uma única vez; se negar, fica o centro do bairro.
  useEffect(() => {
    let asked = true
    try {
      asked = localStorage.getItem('cb.gpsAsked') === '1'
      localStorage.setItem('cb.gpsAsked', '1')
    } catch {
      /* ignora */
    }
    if (!asked && geolocationAvailable()) {
      getCurrentPosition()
        .then((p) => setPosition({ ...p, source: 'gps' }))
        .catch(() => {})
    }
  }, [setPosition])

  const category = params.get('categoria') || ''
  const q = params.get('q') || ''
  const radius = Number(params.get('raio')) || 2

  const update = (changes) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v === '' || v === null || v === undefined) next.delete(k)
      else next.set(k, v)
    }
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (!position) return undefined
    const ctrl = new AbortController()
    setLoading(true)
    setError(null)
    const t = setTimeout(async () => {
      try {
        const r = await api(`/search?${qs({ lat: position.lat, lng: position.lng, radius, category, q })}`, { signal: ctrl.signal })
        setResults(r.results)
      } catch (err) {
        if (err.name !== 'AbortError') setError(err)
      } finally {
        setLoading(false)
      }
    }, 150)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [position?.lat, position?.lng, radius, category, q]) // eslint-disable-line react-hooks/exhaustive-deps

  const radiusOptions = meta?.radiusOptionsKm || [0.5, 1, 2, 3, 5, 10]
  const radiusIndex = Math.max(0, radiusOptions.indexOf(radius))
  const heading = useMemo(() => {
    if (q) return `Resultados para "${q}"`
    if (category) return meta?.categories.find((c) => c.slug === category)?.name || 'Resultados'
    return 'Perto de você'
  }, [q, category, meta])

  if (!position) return null

  return (
    <div>
      <h1>{user ? `Olá, ${user.name.split(' ')[0]}` : 'O que você precisa hoje?'}</h1>
      <p className="muted small">Encontre quem atende a poucos minutos de caminhada.</p>

      <form
        className="search-box mb"
        onSubmit={(e) => {
          e.preventDefault()
          update({ q: text.trim() })
        }}
      >
        <Search size={20} />
        <input
          className="input"
          type="search"
          placeholder="Ex.: bolo de aniversário, conserto de chuveiro"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            if (!e.target.value) update({ q: '' })
          }}
          enterKeyHint="search"
        />
      </form>

      <div className="chips">
        <button className={`chip ${!category ? 'on' : ''}`} onClick={() => update({ categoria: '' })}>
          Todas
        </button>
        {meta?.categories.map((c) => (
          <button key={c.slug} className={`chip ${category === c.slug ? 'on' : ''}`} onClick={() => update({ categoria: category === c.slug ? '' : c.slug })}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="card tight">
        <div className="row">
          <MapPin size={18} color="var(--accent)" />
          <div className="grow">
            <div className="small strong">{SOURCE_LABEL[position.source] || 'Ponto de busca'}</div>
            <div className="tiny muted">Raio de busca: até {String(radius).replace('.', ',')} km</div>
          </div>
          <button className="btn ghost sm" onClick={() => setShowLocation(true)}>
            Alterar
          </button>
          <button className="icon-btn" onClick={() => setShowMap((v) => !v)} aria-label="Mostrar mapa" aria-expanded={showMap}>
            <ChevronDown size={18} style={{ transform: showMap ? 'rotate(180deg)' : 'none', transition: '.2s' }} />
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={radiusOptions.length - 1}
          step={1}
          value={radiusIndex}
          onChange={(e) => update({ raio: radiusOptions[Number(e.target.value)] })}
          aria-label="Raio de busca"
          className="mt"
        />
        <div className="row between tiny muted">
          {radiusOptions.map((r) => (
            <span key={r}>{String(r).replace('.', ',')} km</span>
          ))}
        </div>
        {showMap && (
          <div className="mt">
            <RadiusMap position={position} radiusKm={radius} onPick={(p) => setPosition({ ...p, source: 'mapa' })} />
            <div className="row tiny muted mt">
              <Lock size={12} /> Por privacidade, o mapa não mostra onde os prestadores moram. Você vê só a distância aproximada.
            </div>
          </div>
        )}
      </div>

      <div className="section-title">
        <h2>{heading}</h2>
        {results && !loading && <span className="small muted">{results.length} encontrados</span>}
      </div>

      <ErrorBox error={error} />
      {loading && !results && (
        <div className="offer-list">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" />
          ))}
        </div>
      )}
      {results && results.length === 0 && (
        <Empty icon={SearchX} title="Nada encontrado neste raio">
          Tente aumentar o raio de busca ou usar outras palavras.
          {radius < 10 && (
            <div className="mt">
              <button className="btn outline sm" onClick={() => update({ raio: radiusOptions[Math.min(radiusOptions.length - 1, radiusIndex + 1)] })}>
                Ampliar para {String(radiusOptions[Math.min(radiusOptions.length - 1, radiusIndex + 1)]).replace('.', ',')} km
              </button>
            </div>
          )}
        </Empty>
      )}
      {results && results.length > 0 && (
        <div className="offer-list" style={{ opacity: loading ? 0.6 : 1 }}>
          {results.map((o) => (
            <OfferCard key={o.id} offer={o} />
          ))}
        </div>
      )}

      {showLocation && (
        <LocationDialog
          current={position}
          pilot={meta.pilot}
          onClose={() => setShowLocation(false)}
          onSave={(p) => {
            setPosition(p)
            setShowLocation(false)
          }}
        />
      )}
    </div>
  )
}
