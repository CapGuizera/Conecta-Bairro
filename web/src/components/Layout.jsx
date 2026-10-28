import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { BarChart3, Bell, ClipboardList, Home, LayoutDashboard, LogIn, MessageCircle, ShieldCheck, User, WifiOff } from 'lucide-react'
import { useSession } from '../session.jsx'

function navItems(user) {
  if (!user) {
    return [
      { to: '/', label: 'Início', icon: Home, end: true },
      { to: '/entrar', label: 'Entrar', icon: LogIn },
    ]
  }
  const items = [
    { to: '/', label: 'Início', icon: Home, end: true },
    { to: '/conversas', label: 'Conversas', icon: MessageCircle },
    { to: '/contratacoes', label: 'Contratações', icon: ClipboardList },
  ]
  if (user.role === 'agente') items.push({ to: '/campo', label: 'Campo', icon: ClipboardList })
  else if (user.role === 'moderador') items.push({ to: '/moderacao', label: 'Moderação', icon: ShieldCheck })
  else if (user.role === 'instituicao') items.push({ to: '/indicadores', label: 'Indicadores', icon: BarChart3 })
  else if (user.isProvider) items.push({ to: '/painel', label: 'Painel', icon: LayoutDashboard })
  items.push({ to: '/perfil', label: 'Perfil', icon: User })
  return items
}

export function Layout() {
  const { user, unread, toast, setToast } = useSession()
  const [online, setOnline] = useState(navigator.onLine)
  const { pathname } = useLocation()

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(t)
  }, [toast, setToast])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const items = navItems(user)
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img src="/icon.svg" alt="" />
          ConectaBairro
        </NavLink>
        <nav className="topnav" aria-label="Principal">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end}>
              {i.label}
            </NavLink>
          ))}
        </nav>
        <span className="spacer" />
        {user && (
          <NavLink to="/notificacoes" className="icon-btn" aria-label="Notificações">
            <Bell size={22} />
            {unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
          </NavLink>
        )}
      </header>
      {!online && (
        <div className="offline-bar">
          <WifiOff size={14} style={{ verticalAlign: -2 }} /> Sem conexão. {user?.role === 'agente' ? 'Os cadastros de campo serão guardados e enviados depois.' : 'Algumas funções ficam indisponíveis.'}
        </div>
      )}
      <main className="main">
        <Outlet />
      </main>
      <nav className="bottomnav" aria-label="Navegação">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end}>
            <i.icon size={22} />
            {i.label}
          </NavLink>
        ))}
      </nav>
      {toast && (
        <div className={`toast ${toast.kind}`} onClick={() => setToast(null)} role="status">
          {toast.message}
        </div>
      )}
    </div>
  )
}
