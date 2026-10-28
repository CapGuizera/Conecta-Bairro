import { useRef } from 'react'
import { ImagePlus, X } from 'lucide-react'

// Reduz a foto no próprio aparelho antes do envio (economiza dados móveis).
function resize(file, maxSide = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => reject(new Error('Não foi possível ler a imagem'))
    img.src = url
  })
}

export function ImagePicker({ images, onChange, max = 4 }) {
  const input = useRef(null)
  async function onFiles(e) {
    const files = [...e.target.files].slice(0, max - images.length)
    const out = []
    for (const f of files) out.push(await resize(f))
    onChange([...images, ...out])
    e.target.value = ''
  }
  return (
    <div className="image-picker">
      {images.map((src, i) => (
        <div className="slot" key={i}>
          <img src={src} alt="" />
          <button type="button" className="remove" onClick={() => onChange(images.filter((_, j) => j !== i))} aria-label="Remover imagem">
            <X size={14} />
          </button>
        </div>
      ))}
      {images.length < max && (
        <button type="button" className="slot" onClick={() => input.current.click()} aria-label="Adicionar imagem">
          <ImagePlus size={24} />
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={onFiles} />
    </div>
  )
}
