import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { Layout } from './components/Layout.jsx'
import { Loading } from './components/ui.jsx'
import Chat from './pages/Chat.jsx'
import Contracts from './pages/Contracts.jsx'
import Conversations from './pages/Conversations.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Field from './pages/Field.jsx'
import Home from './pages/Home.jsx'
import Institution from './pages/Institution.jsx'
import Login from './pages/Login.jsx'
import Moderation from './pages/Moderation.jsx'
import NotFound from './pages/NotFound.jsx'
import Notifications from './pages/Notifications.jsx'
import OfferDetail from './pages/OfferDetail.jsx'
import OfferForm from './pages/OfferForm.jsx'
import Profile from './pages/Profile.jsx'
import ProviderProfile from './pages/ProviderProfile.jsx'
import Receipt from './pages/Receipt.jsx'
import { SessionProvider, useSession } from './session.jsx'
import '@fontsource-variable/figtree'
import '@fontsource-variable/bricolage-grotesque'
import './styles.css'

// Quando sai uma versão nova, o service worker troca a antiga e a página recarrega sozinha.
// Sem isso o navegador seguia mostrando a interface guardada até alguém recarregar na mão.
registerSW({ immediate: true })

function Private({ children, provider, roles }) {
  const { user } = useSession()
  const location = useLocation()
  if (!user) return <Navigate to="/entrar" replace state={{ from: location.pathname }} />
  if (provider && !user.isProvider) return <Navigate to="/perfil" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function App() {
  const { ready, meta } = useSession()
  if (!ready) return <Loading label="Abrindo..." />
  if (!meta) {
    return (
      <div className="login">
        <div className="card center">
          <h2>Não consegui falar com o servidor</h2>
          <p className="muted">Confere se a janela do ConectaBairro está aberta no computador e tenta de novo.</p>
          <button className="btn" onClick={() => window.location.reload()}>
            Tentar de novo
          </button>
        </div>
      </div>
    )
  }
  return (
    <Routes>
      <Route path="/entrar" element={<Login />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="oferta/:id" element={<OfferDetail />} />
        <Route path="prestador/:id" element={<ProviderProfile />} />
        <Route path="conversas" element={<Private><Conversations /></Private>} />
        <Route path="conversas/:id" element={<Private><Chat /></Private>} />
        <Route path="contratacoes" element={<Private><Contracts /></Private>} />
        <Route path="comprovante/:id" element={<Private><Receipt /></Private>} />
        <Route path="notificacoes" element={<Private><Notifications /></Private>} />
        <Route path="perfil" element={<Private><Profile /></Private>} />
        <Route path="painel" element={<Private provider><Dashboard /></Private>} />
        <Route path="painel/ofertas/:id" element={<Private provider><OfferForm /></Private>} />
        <Route path="campo" element={<Private roles={['agente', 'moderador']}><Field /></Private>} />
        <Route path="moderacao" element={<Private roles={['moderador']}><Moderation /></Private>} />
        <Route path="indicadores" element={<Private roles={['instituicao', 'moderador']}><Institution /></Private>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
)
