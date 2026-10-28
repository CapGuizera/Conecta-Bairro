// RF04 e RF06: tratamento de localização.
import crypto from 'node:crypto'

const EARTH_RADIUS_M = 6_371_000

export function validLatLng(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

// Desloca o ponto exato para uma direção aleatória, entre 100 e 300 metros.
// As distâncias públicas são medidas a partir desse ponto, nunca do endereço real.
export function randomAnchor(lat, lng, minM = 100, maxM = 300) {
  const distance = minM + (crypto.randomInt(0, 10_001) / 10_000) * (maxM - minM)
  const bearing = (crypto.randomInt(0, 360_000) / 1000) * (Math.PI / 180)
  const φ1 = (lat * Math.PI) / 180
  const λ1 = (lng * Math.PI) / 180
  const δ = distance / EARTH_RADIUS_M
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(bearing))
  const λ2 = λ1 + Math.atan2(Math.sin(bearing) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2))
  return { lat: (φ2 * 180) / Math.PI, lng: (λ2 * 180) / Math.PI }
}

// Distância exibida ao usuário: arredondada em 100 m e com piso de 0,5 km.
export function approxDistance(meters) {
  const km = Math.max(0.5, Math.round(meters / 100) / 10)
  const label = meters < 500 ? 'menos de 0,5 km' : `${km.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`
  return { km, label }
}

export const RADIUS_OPTIONS_KM = [0.5, 1, 2, 3, 5, 10]
export const MAX_RADIUS_KM = 10
