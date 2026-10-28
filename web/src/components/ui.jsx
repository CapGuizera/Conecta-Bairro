import { useCallback, useEffect, useState } from 'react'
import { Loader2, Star, X } from 'lucide-react'

export function Stars({ value, count, size = 14 }) {
  if (value === null || value === undefined) return <span className="muted small">Sem avaliações</span>
  const full = Math.round(value)
  return (
    <span className="stars" title={`${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} fill={i <= full ? 'currentColor' : 'none'} strokeWidth={i <= full ? 0 : 2} />
      ))}
      <span className="num">{String(value).replace('.', ',')}</span>
      {count !== undefined && <span className="muted small">&nbsp;({count})</span>}
    </span>
  )
}

export function StarInput({ value, onChange }) {
  return (
    <div className="star-input" role="radiogroup" aria-label="Nota">
      {[1, 2, 3, 4, 5].map((i) => (
        <button type="button" key={i} className={i <= value ? 'on' : ''} onClick={() => onChange(i)} aria-label={`${i} estrela${i > 1 ? 's' : ''}`}>
          <Star size={32} fill="currentColor" strokeWidth={0} />
        </button>
      ))}
    </div>
  )
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="empty">
      {Icon && <Icon size={40} />}
      <h3>{title}</h3>
      {children && <div className="small">{children}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Avatar({ name = '', size }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
  return <div className={`avatar ${size || ''}`}>{initials || '?'}</div>
}

export function Loading({ label = 'Carregando...' }) {
  return (
    <div className="empty">
      <Loader2 className="spin" size={28} />
      <div className="small">{label}</div>
    </div>
  )
}

export function ErrorBox({ error }) {
  if (!error) return null
  return <div className="error">{error.message || String(error)}</div>
}

export function Stat({ label, value, sub }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

// Gráfico de barras simples (sem biblioteca), com até duas séries.
export function Bars({ data, a, b, labelA, labelB }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d[a] || 0, b ? d[b] || 0 : 0)))
  return (
    <div>
      <div className="bars">
        {data.map((d, i) => (
          <div className="bar" key={i} title={`${d.label}: ${labelA} ${d[a]}${b ? `, ${labelB} ${d[b]}` : ''}`}>
            <i style={{ height: `${((d[a] || 0) / max) * 100}%` }} />
            {b && <i className="alt" style={{ height: `${((d[b] || 0) / max) * 100}%` }} />}
          </div>
        ))}
      </div>
      <div className="legend">
        <span>
          <i style={{ background: 'var(--primary)' }} />
          {labelA}
        </span>
        {b && (
          <span>
            <i style={{ background: 'var(--accent)' }} />
            {labelB}
          </span>
        )}
      </div>
    </div>
  )
}

export function HBar({ label, value, max, display, accent }) {
  return (
    <div className={`hbar ${accent ? 'accent' : ''}`}>
      <div className="top">
        <span>{label}</span>
        <span className="strong nowrap">{display ?? value}</span>
      </div>
      <div className="track">
        <i style={{ width: `${max ? Math.min(100, (value / max) * 100) : 0}%` }} />
      </div>
    </div>
  )
}

// Carrega dados assíncronos com estado de carregamento, erro e recarga.
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      setState({ data: await fn(), error: null, loading: false })
    } catch (error) {
      setState({ data: null, error, loading: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(() => {
    load()
  }, [load])
  const setData = useCallback((next) => setState((s) => ({ ...s, data: typeof next === 'function' ? next(s.data) : next })), [])
  return { ...state, reload: load, setData }
}
