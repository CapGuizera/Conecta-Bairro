// RF02: cadastro e edição de oferta.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import { api } from '../api.js'
import { ImagePicker } from '../components/ImagePicker.jsx'
import { ErrorBox, Loading, Modal } from '../components/ui.jsx'
import { useSession } from '../session.jsx'

const UNITS = ['a combinar', 'por serviço', 'por hora', 'por dia', 'por unidade', 'por peça', 'por encomenda', 'por kg', 'por m²', 'por atendimento']
const cents = (c) => (c === null || c === undefined ? '' : (c / 100).toFixed(2).replace('.', ','))

export default function OfferForm() {
  const { id } = useParams()
  const editing = id && id !== 'nova'
  const navigate = useNavigate()
  const { meta, showToast } = useSession()
  const [form, setForm] = useState({ kind: 'servico', title: '', description: '', category: '', priceMin: '', priceMax: '', priceUnit: 'a combinar', images: [] })
  const [loading, setLoading] = useState(editing)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!editing) return
    api(`/offers/${id}`)
      .then(({ offer: o }) =>
        setForm({
          kind: o.kind,
          title: o.title,
          description: o.description,
          category: o.category,
          priceMin: cents(o.priceMinCents),
          priceMax: cents(o.priceMaxCents),
          priceUnit: o.priceUnit,
          images: o.images,
        }),
      )
      .catch(setError)
      .finally(() => setLoading(false))
  }, [id, editing])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const r = await api(editing ? `/offers/${id}` : '/offers', { method: editing ? 'PUT' : 'POST', body: form })
      showToast(editing ? 'Oferta atualizada' : 'Oferta publicada para o bairro', 'ok')
      navigate(`/oferta/${r.offer.id}`, { replace: true })
    } catch (err) {
      setError(err)
      setBusy(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div style={{ maxWidth: 640 }}>
      <button className="btn ghost sm mb" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Voltar
      </button>
      <h1>{editing ? 'Editar oferta' : 'Nova oferta'}</h1>
      <form onSubmit={submit} className="card">
        <div className="segmented mb">
          <button type="button" className={form.kind === 'servico' ? 'on' : ''} onClick={() => set('kind')('servico')}>
            Serviço
          </button>
          <button type="button" className={form.kind === 'produto' ? 'on' : ''} onClick={() => set('kind')('produto')}>
            Produto
          </button>
        </div>
        <label className="field">
          <span>Título</span>
          <input className="input" value={form.title} onChange={set('title')} maxLength={80} placeholder="Ex.: Bolos caseiros por encomenda" required />
        </label>
        <label className="field">
          <span>Categoria</span>
          <select className="input" value={form.category} onChange={set('category')} required>
            <option value="">Escolha...</option>
            {meta.categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Descrição</span>
          <textarea className="input" value={form.description} onChange={set('description')} maxLength={1500} placeholder="O que você faz, como funciona, prazos..." />
          <span className="hint">Não coloque telefone nem endereço: o contato acontece pelo chat.</span>
        </label>
        <div className="grid two">
          <label className="field">
            <span>Preço a partir de (R$)</span>
            <input className="input" inputMode="decimal" value={form.priceMin} onChange={(e) => set('priceMin')(e.target.value.replace(/[^\d,.]/g, ''))} placeholder="opcional" />
          </label>
          <label className="field">
            <span>Até (R$)</span>
            <input className="input" inputMode="decimal" value={form.priceMax} onChange={(e) => set('priceMax')(e.target.value.replace(/[^\d,.]/g, ''))} placeholder="opcional" />
          </label>
        </div>
        <label className="field">
          <span>Unidade</span>
          <select className="input" value={form.priceUnit} onChange={set('priceUnit')}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <div className="field">
          <span>Fotos (opcional, até 4)</span>
          <ImagePicker images={form.images} onChange={set('images')} />
        </div>
        <ErrorBox error={error} />
        <button className="btn block" disabled={busy}>
          {busy && <Loader2 size={18} className="spin" />} {editing ? 'Salvar alterações' : 'Publicar oferta'}
        </button>
        {editing && (
          <button type="button" className="btn danger block mt" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} /> Excluir oferta
          </button>
        )}
      </form>
      {confirmDelete && (
        <Modal title="Excluir oferta?" onClose={() => setConfirmDelete(false)}>
          <p>A oferta deixa de aparecer na busca. As conversas e contratações já registradas continuam no histórico.</p>
          <div className="row">
            <button className="btn ghost grow" onClick={() => setConfirmDelete(false)}>
              Voltar
            </button>
            <button
              className="btn danger grow"
              onClick={async () => {
                await api(`/offers/${id}/status`, { method: 'PATCH', body: { status: 'removida' } })
                showToast('Oferta excluída')
                navigate('/painel', { replace: true })
              }}
            >
              Excluir
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
