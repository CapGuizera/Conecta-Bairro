// Utilitários de texto: normalização para busca, telefone e filtro de contatos no chat.

export function normalize(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const STOPWORDS = new Set(
  'a o as os de da do das dos e em no na nos nas um uma uns umas para pra pro por com sem que meu minha meus minhas preciso precisa quero queria alguem algum alguma fazer faz tem ter perto aqui bairro servico servicos'.split(' '),
)

export function searchTokens(query) {
  return normalize(query)
    .split(' ')
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    .slice(0, 8)
}

// Aceita "(15) 99876-5432", "15998765432", "+55 15 99876 5432". Retorna "+5515998765432".
export function normalizePhone(input) {
  let digits = String(input || '').replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('55')) digits = digits.slice(2)
  if (digits.length !== 10 && digits.length !== 11) return null
  if (digits.startsWith('0')) return null
  return `+55${digits}`
}

// RF07/RF15: remove telefones, e-mails, links e convites para outros aplicativos.
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/gi
const URL_RE = /\b(?:https?:\/\/|www\.)\S+|\b[\w-]+\.(?:com|net|org|br|me|ly|app)(?:\.br)?(?:\/\S*)?/gi
const HANDLE_RE = /(^|\s)@[\w.]{3,}/g
const APP_RE = /\b(whats\s?app|whats|wpp|zap|zapzap|telegram|insta(?:gram)?|face(?:book)?|me\s+liga|liga\s+(?:pra|para)\s+mim|meu\s+(?:numero|número|telefone|celular|cel|contato))\b/gi
const DIGIT_RUN_RE = /\+?\d[\d\s().-]{6,}\d/g

export function maskContacts(text) {
  let masked = false
  const mark = () => {
    masked = true
    return '[contato removido]'
  }
  let out = String(text)
  out = out.replace(EMAIL_RE, mark)
  out = out.replace(URL_RE, mark)
  out = out.replace(HANDLE_RE, (m, pre) => `${pre}${mark()}`)
  out = out.replace(DIGIT_RUN_RE, (m) => (m.replace(/\D/g, '').length >= 8 ? mark() : m))
  out = out.replace(APP_RE, mark)
  return { text: out, masked }
}
