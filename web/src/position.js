// Posição de busca do usuário (RF05/RF06). Fica apenas neste navegador; o servidor
// recebe o ponto a cada busca para calcular distâncias e não o armazena.
import { useCallback, useEffect, useState } from 'react'

const KEY = 'cb.position'

// Área atendida: só a região de Sorocaba (igual a server/src/config.js -> region).
export const REGION = { south: -23.65, west: -47.62, north: -23.33, east: -47.28 }
export const REGION_BOUNDS = [
  [REGION.south, REGION.west],
  [REGION.north, REGION.east],
]
export const inRegion = (p) =>
  !!p && p.lat >= REGION.south && p.lat <= REGION.north && p.lng >= REGION.west && p.lng <= REGION.east
export const OUT_OF_REGION = 'O ConectaBairro atende só a região de Sorocaba. Marca um ponto no mapa.'

function load() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null')
    // Ponto salvo antes da trava de região (ou fora dela) é descartado.
    return inRegion(p) ? p : null
  } catch {
    return null
  }
}

function save(pos) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pos))
  } catch {
    /* ignora */
  }
}

export const geolocationAvailable = () => 'geolocation' in navigator && window.isSecureContext

export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Este navegador não informa a localização'))
    if (!window.isSecureContext) {
      return reject(new Error('Por este endereço o navegador não libera o GPS. Marca o ponto no mapa.'))
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }
        if (!inRegion(pos)) return reject(new Error(OUT_OF_REGION))
        resolve(pos)
      },
      (err) =>
        reject(new Error(err.code === 1 ? 'Sem permissão pra usar a localização. Marca o ponto no mapa.' : 'Não deu pra achar sua localização agora')),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    )
  })
}

export function usePosition(pilot) {
  const [position, setPositionState] = useState(load)

  useEffect(() => {
    if (!position && pilot) setPositionState({ lat: pilot.lat, lng: pilot.lng, source: 'piloto' })
  }, [pilot, position])

  const setPosition = useCallback((pos) => {
    setPositionState(pos)
    save(pos)
  }, [])

  return [position, setPosition]
}

export const SOURCE_LABEL = {
  gps: 'Você está aqui',
  mapa: 'Ponto que você marcou no mapa',
  piloto: 'Centro do bairro',
}
