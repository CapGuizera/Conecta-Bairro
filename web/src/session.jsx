// Estado global: usuário logado, metadados da plataforma, notificações e conexão em tempo real.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { api, getToken, setToken } from './api.js'

const SessionContext = createContext(null)

export function SessionProvider({ children }) {
  const [user, setUser] = useState(null)
  const [location, setLocation] = useState({ hasLocation: false })
  const [meta, setMeta] = useState(null)
  const [ready, setReady] = useState(false)
  const [unread, setUnread] = useState(0)
  const [toast, setToast] = useState(null)
  const socketRef = useRef(null)
  const listeners = useRef(new Set())

  const showToast = useCallback((message, kind = 'info') => {
    setToast({ message, kind, id: Date.now() })
  }, [])

  const refreshMe = useCallback(async () => {
    if (!getToken()) {
      setUser(null)
      return null
    }
    try {
      const data = await api('/me')
      setUser(data.user)
      setLocation(data.location)
      return data.user
    } catch {
      return null
    }
  }, [])

  const refreshUnread = useCallback(async () => {
    if (!getToken()) return
    try {
      setUnread((await api('/notifications/unread-count')).unread)
    } catch {
      /* offline */
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [m] = await Promise.all([api('/meta').catch(() => null), refreshMe()])
      if (!cancelled) {
        setMeta(m)
        setReady(true)
      }
    })()
    const onLogout = () => setUser(null)
    window.addEventListener('cb:logout', onLogout)
    return () => {
      cancelled = true
      window.removeEventListener('cb:logout', onLogout)
    }
  }, [refreshMe])

  // Conexão em tempo real enquanto houver usuário logado.
  useEffect(() => {
    if (!user) return undefined
    refreshUnread()
    const socket = io({ auth: { token: getToken() }, transports: ['websocket', 'polling'] })
    socketRef.current = socket
    socket.on('notification', (n) => {
      setUnread((u) => u + 1)
      const onChatPage = window.location.pathname === n.link
      if (!onChatPage) showToast(n.title + (n.body ? `: ${n.body}` : ''))
      // Notificação do sistema quando a aba está em segundo plano (RF17).
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(n.title, { body: n.body, icon: '/icon-192.png', tag: n.link || String(n.id) })
        } catch {
          /* alguns navegadores só permitem via service worker */
        }
      }
    })
    for (const ev of ['message', 'contract']) {
      socket.on(ev, (payload) => listeners.current.forEach((fn) => fn(ev, payload)))
    }
    socket.on('connect', refreshUnread)
    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [user?.id, refreshUnread, showToast])

  const subscribe = useCallback((fn) => {
    listeners.current.add(fn)
    return () => listeners.current.delete(fn)
  }, [])

  const login = useCallback(
    async (token) => {
      setToken(token)
      await refreshMe()
    },
    [refreshMe],
  )

  const logout = useCallback(() => {
    setToken(null)
    setUser(null)
    setUnread(0)
  }, [])

  const value = useMemo(
    () => ({ user, setUser, location, setLocation, meta, ready, unread, setUnread, refreshUnread, refreshMe, login, logout, subscribe, toast, showToast, setToast }),
    [user, location, meta, ready, unread, refreshUnread, refreshMe, login, logout, subscribe, toast, showToast],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = () => useContext(SessionContext)

export function useRealtime(handler) {
  const { subscribe } = useSession()
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const unsubscribe = subscribe((ev, payload) => ref.current(ev, payload))
    return () => {
      unsubscribe()
    }
  }, [subscribe])
}
