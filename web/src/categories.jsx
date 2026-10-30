// Ícone de cada categoria, usado nos cartões, nos chips e quando o anúncio não tem foto.
import { BookOpen, Brush, CakeSlice, HeartHandshake, House, Palette, Scissors, Smartphone, Store, Truck, Wrench } from 'lucide-react'

export const CATEGORY_ICONS = {
  alimentacao: CakeSlice,
  costura: Scissors,
  beleza: Brush,
  aulas: BookOpen,
  manutencao: Wrench,
  domesticos: House,
  cuidados: HeartHandshake,
  tecnologia: Smartphone,
  artesanato: Palette,
  fretes: Truck,
  outros: Store,
}

export const categoryIcon = (slug) => CATEGORY_ICONS[slug] || Store

// Cor de cada categoria. Vai para a variável CSS --cat, e o styles.css tira dela o fundo
// clarinho e o tom do texto (mais claro no modo escuro).
export const CATEGORY_COLORS = {
  alimentacao: '#c2410c',
  costura: '#9d3a7a',
  beleza: '#be185d',
  aulas: '#4338ca',
  manutencao: '#a16207',
  domesticos: '#0f766e',
  cuidados: '#2f7d4f',
  tecnologia: '#1d4ed8',
  artesanato: '#7c3aed',
  fretes: '#7a5230',
  outros: '#475569',
}

export const catStyle = (slug) => ({ '--cat': CATEGORY_COLORS[slug] || CATEGORY_COLORS.outros })

// Cor do avatar a partir do nome: a mesma pessoa tem sempre a mesma cor.
const AVATAR_COLORS = [
  ['#dfe8f4', '#1c4b86'],
  ['#fbefc9', '#7a5700'],
  ['#dff1e5', '#2c7a4b'],
  ['#f6e0da', '#9a3b22'],
  ['#e8e0f3', '#5b3d8a'],
  ['#dcefee', '#1f6b68'],
]

export function avatarColors(name = '') {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}
