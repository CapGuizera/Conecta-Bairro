// Mapas com Leaflet + OpenStreetMap. Por decisão de projeto (RF04), nenhum mapa mostra
// onde os prestadores estão: o mapa da busca exibe só o ponto do próprio usuário e o raio.
import 'leaflet/dist/leaflet.css'
import { useEffect } from 'react'
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'

const TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

function zoomForRadius(km) {
  if (km <= 0.5) return 15
  if (km <= 1) return 14
  if (km <= 2) return 13
  if (km <= 5) return 12
  return 11
}

function Recenter({ center, zoom }) {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom ?? map.getZoom(), { animate: true })
  }, [center[0], center[1], zoom]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

function ClickToPick({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

export function RadiusMap({ position, radiusKm, onPick, tall }) {
  const center = [position.lat, position.lng]
  return (
    <MapContainer center={center} zoom={zoomForRadius(radiusKm)} className={`map ${tall ? 'tall' : ''}`} scrollWheelZoom={false} attributionControl>
      <TileLayer url={TILE} attribution={ATTR} />
      <Recenter center={center} zoom={zoomForRadius(radiusKm)} />
      <Circle center={center} radius={radiusKm * 1000} pathOptions={{ color: '#1c4b86', weight: 2, fillOpacity: 0.08 }} />
      <CircleMarker center={center} radius={8} pathOptions={{ color: '#fff', weight: 3, fillColor: '#e9a800', fillOpacity: 1 }} />
      {onPick && <ClickToPick onPick={onPick} />}
    </MapContainer>
  )
}

export function PickPointMap({ value, onChange, fallback, radiusKm }) {
  const point = value || fallback
  const center = [point.lat, point.lng]
  return (
    <MapContainer center={center} zoom={16} className="map tall" scrollWheelZoom attributionControl>
      <TileLayer url={TILE} attribution={ATTR} />
      <Recenter center={center} />
      {value && radiusKm && <Circle center={center} radius={radiusKm * 1000} pathOptions={{ color: '#1c4b86', weight: 1, fillOpacity: 0.05 }} />}
      {value && <CircleMarker center={center} radius={9} pathOptions={{ color: '#fff', weight: 3, fillColor: '#1c4b86', fillOpacity: 1 }} />}
      <ClickToPick onPick={onChange} />
    </MapContainer>
  )
}
