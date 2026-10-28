import { Link } from 'react-router-dom'
import { MapPin, Megaphone } from 'lucide-react'
import { categoryIcon } from '../categories.jsx'
import { plural, priceRange } from '../format.js'
import { Stars } from './ui.jsx'

export function Thumb({ offer, size }) {
  const img = offer.images?.[0]
  const Icon = categoryIcon(offer.category)
  return (
    <div className="thumb" style={size ? { width: size, height: size } : undefined}>
      {img ? <img src={img} alt="" loading="lazy" /> : <Icon size={30} strokeWidth={1.6} />}
    </div>
  )
}

export function OfferCard({ offer }) {
  return (
    <Link to={`/oferta/${offer.id}`} className={`offer-card ${offer.highlighted ? 'highlighted' : ''}`}>
      <Thumb offer={offer} />
      <div className="grow">
        <div className="row between">
          <span className="badge">{offer.categoryName}</span>
          {offer.highlighted && (
            <span className="badge accent">
              <Megaphone size={12} /> Destaque
            </span>
          )}
        </div>
        <h3 className="ellipsis">{offer.title}</h3>
        <div className="meta">
          {offer.distance && (
            <span className="distance">
              <MapPin size={14} />
              {offer.distance.label}
            </span>
          )}
          <span>{offer.provider?.name}</span>
        </div>
        <div className="meta mt" style={{ marginTop: 6 }}>
          <span className="strong" style={{ color: 'var(--ink)' }}>
            {priceRange(offer)}
          </span>
          {offer.reputation && offer.reputation.reviews > 0 && <Stars value={offer.reputation.avgRating} count={offer.reputation.reviews} size={12} />}
          {offer.reputation && offer.reputation.concluded > 0 && <span>{plural(offer.reputation.concluded, 'serviço', 'serviços')}</span>}
        </div>
      </div>
    </Link>
  )
}
