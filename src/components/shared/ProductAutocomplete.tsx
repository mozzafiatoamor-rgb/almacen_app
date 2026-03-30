import { useState, useRef, useEffect } from 'react'
import type { Producto } from '../../api/types'

interface Props {
  catalogo:    Producto[]
  value:       Producto | null
  onChange:    (p: Producto | null) => void
  placeholder?: string
}

export default function ProductAutocomplete({ catalogo, value, onChange, placeholder = '🔍 Buscar producto…' }: Props) {
  const [query,  setQuery]  = useState('')
  const [open,   setOpen]   = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (value) {
    return (
      <div className="flex items-center gap-2 bg-surface2 rounded-card px-3.5 py-2.5">
        <div className="flex-1">
          <span className="text-sm font-semibold text-text1">{value.producto}</span>
          <span className="text-xs text-text2 ml-2">{value.categoria}</span>
        </div>
        <button
          onClick={() => { onChange(null); setQuery('') }}
          className="text-red text-sm leading-none"
          aria-label="Limpiar"
        >
          ✕
        </button>
      </div>
    )
  }

  const q = query.toLowerCase()
  const filtered = q
    ? catalogo.filter(p =>
        p.producto.toLowerCase().includes(q) ||
        p.categoria.toLowerCase().includes(q)
      ).slice(0, 15)
    : []

  function pick(p: Producto) {
    onChange(p)
    setQuery('')
    setOpen(false)
  }

  function highlight(text: string, q: string) {
    const i = text.toLowerCase().indexOf(q)
    if (i === -1) return text
    return (
      text.substring(0, i) +
      `<mark class="bg-accent/30 text-accent rounded px-0.5">` +
      text.substring(i, i + q.length) +
      '</mark>' +
      text.substring(i + q.length)
    )
  }

  return (
    <div ref={ref} className="relative">
      <input
        className="w-full bg-surface2 border border-surface3 rounded-card px-3.5 py-3 text-sm text-text1 outline-none focus:border-accent transition-colors font-sans"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        autoCapitalize="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 bg-surface border border-surface3 border-t-0 rounded-b-card max-h-52 overflow-y-auto z-10 shadow-xl">
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => pick(p)}
              className="w-full flex justify-between items-center px-3.5 py-2.5 hover:bg-surface2 text-left transition-colors"
            >
              <span
                className="text-sm text-text1"
                dangerouslySetInnerHTML={{ __html: highlight(p.producto, q) }}
              />
              <span className="text-[10px] text-text2 bg-surface3 px-1.5 py-0.5 rounded ml-2 flex-shrink-0">{p.categoria}</span>
            </button>
          ))}
        </div>
      )}
      {open && q && filtered.length === 0 && (
        <div className="absolute top-full left-0 right-0 bg-surface border border-surface3 border-t-0 rounded-b-card px-3.5 py-2.5 text-sm text-text2 z-10">
          Sin resultados para "{q}"
        </div>
      )}
    </div>
  )
}
