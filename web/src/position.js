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
    if (!('geolocation' in navigator)) return reject(new Error('Este navegador não informa a localização'))
    if (!window.isSecureContext) {
      return reject(new Error('Por este endereço o navegador não libera o GPS. Marca o ponto no mapa.'))
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
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
