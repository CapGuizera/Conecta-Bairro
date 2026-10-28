import { Link } from 'react-router-dom'
import { MapPinOff } from 'lucide-react'
import { Empty } from '../components/ui.jsx'

export default function NotFound() {
  return (
    <Empty icon={MapPinOff} title="Página não encontrada">
      <Link to="/" className="btn mt">
        Voltar ao início
      </Link>
    </Empty>
  )
}
