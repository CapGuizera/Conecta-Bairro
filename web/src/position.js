// Posição de busca do usuário (RF05/RF06). Fica apenas neste navegador; o servidor
// recebe o ponto a cada busca para calcular distâncias e não o armazena.
import { useCallback, useEffect, useState } from 'react'

const KEY = 'cb.position'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null')
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
    if (!('geolocation' in navigator)) return reject(new Error('Este navegador não informa localização'))
    if (!window.isSecureContext) {
      return reject(new Error('O navegador só libera a localização em https ou em localhost. Escolha o ponto no mapa.'))
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      (err) =>
        reject(new Error(err.code === 1 ? 'Permissão de localização negada. Escolha o ponto no mapa.' : 'Não foi possível obter sua localização')),
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
  gps: 'Sua localização atual',
  mapa: 'Ponto escolhido no mapa',
  piloto: 'Centro do bairro piloto',
}
