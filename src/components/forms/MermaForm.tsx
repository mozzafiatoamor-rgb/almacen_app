import { useState } from 'react'
import type { Producto, CartItemMerma } from '../../api/types'
import type { Merma } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../hooks/useToast'
import { useInvalidate } from '../../hooks/useSheets'
import { appendMerma, appendBitacora } from '../../api/appscript'
import { nextId } from '../../utils/ids'
import { nowDateTime } from '../../utils/dates'
import ProductAutocomplete from '../shared/ProductAutocomplete'

const MOTIVOS = ['Caducidad / Vencimiento', 'Daño / Maltrato', 'Derrame', 'Contaminación', 'Rotura (plaque)', 'Otro']

interface Props {
  catalogo: Producto[]
  mermas:   Merma[]
  onClose:  () => void
}

export default function MermaForm({ catalogo, mermas, onClose }: Props) {
  const { user }    = useAuth()
  const toast       = useToast()
  const invalidate  = useInvalidate()

  const [product, setProduct] = useState<Producto | null>(null)
  const [qty,     setQty]     = useState('')
  const [motivo,  setMotivo]  = useState(MOTIVOS[0])
  const [detalle, setDetalle] = useState('')
  const [cart,    setCart]    = useState<CartItemMerma[]>([])
  const [saving,  setSaving]  = useState(false)

  function addToCart() {
    if (!product || !qty || parseInt(qty) < 1) { toast('Completa todos los campos', 'error'); return }
    setCart(prev => [...prev, {
      cat: product.categoria, prod: product.producto,
      qty: parseInt(qty), motivo, notas: detalle,
    }])
    toast(`${product.producto} ×${qty} agregado`)
    setProduct(null); setQty(''); setDetalle('')
  }

  function removeFromCart(i: number) {
    setCart(prev => prev.filter((_, idx) => idx !== i))
  }

  async function submit() {
    if (!cart.length || !user) return
    setSaving(true)
    const n   = nowDateTime()
    let ok    = 0
    const ids = [...mermas]

    for (const item of cart) {
      const id = nextId('MR', ids)
      try {
        await appendMerma([
          id, n.date, n.time,
          item.cat, item.prod, item.qty,
          item.motivo + (item.notas ? ` - ${item.notas}` : ''),
          user.nombre, item.notas,
        ])
        ids.push({ id } as Merma)
        ok++
      } catch {
        toast(`Error guardando ${item.prod}`, 'error')
      }
    }

    const detalle = cart.map(c => `${c.qty} ${c.prod} (${c.motivo})`).join(', ')
    await appendBitacora([n.date, n.time, user.nombre, 'Merma', detalle, 'merma']).catch(() => {})

    toast(`${ok}/${cart.length} merma(s) registradas`)
    setSaving(false)
    invalidate.catalogo()
    invalidate.mermas()
    invalidate.bitacora()
    onClose()
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-2 text-red">⚠️ Registrar Merma</h2>
      <div className="bg-red/10 border border-red/30 rounded-xl px-3.5 py-2.5 mb-4 text-sm text-red">
        👤 <strong>{user?.nombre}</strong> — Baja por merma
      </div>

      <div className="mb-3">
        <label className="block text-xs font-semibold text-text2 mb-1.5">Producto</label>
        <ProductAutocomplete catalogo={catalogo} value={product} onChange={setProduct} />
      </div>

      {product && (
        <div className="bg-surface2 rounded-xl px-3.5 py-2.5 mb-3 text-sm">
          📦 Stock actual: <strong className="text-accent">{product.stockActual}</strong> {product.unidad}
        </div>
      )}

      <div className="mb-3">
        <label className="block text-xs font-semibold text-text2 mb-1.5">Cantidad</label>
        <input
          type="number" inputMode="numeric" min="1" value={qty}
          onChange={e => setQty(e.target.value)}
          className="w-full bg-surface2 border border-surface3 rounded-card px-3.5 py-3 text-sm text-text1 outline-none focus:border-red"
          placeholder="0"
        />
      </div>

      <div className="mb-3">
        <label className="block text-xs font-semibold text-text2 mb-1.5">Motivo</label>
        <select
          value={motivo} onChange={e => setMotivo(e.target.value)}
          className="w-full bg-surface2 border border-surface3 rounded-card px-3.5 py-3 text-sm text-text1 outline-none focus:border-red"
        >
          {MOTIVOS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold text-text2 mb-1.5">Detalle</label>
        <textarea
          value={detalle} onChange={e => setDetalle(e.target.value)} rows={2}
          placeholder="Describe el motivo…"
          className="w-full bg-surface2 border border-surface3 rounded-card px-3.5 py-3 text-sm text-text1 outline-none focus:border-red resize-none"
        />
      </div>

      <button onClick={addToCart} className="w-full bg-surface2 text-text1 font-semibold py-3 rounded-card mb-4">
        ➕ Agregar
      </button>

      {cart.length > 0 && (
        <div className="mb-4 border border-red/30 rounded-card overflow-hidden">
          <div className="flex justify-between items-center px-3.5 py-2.5 border-b border-red/30">
            <span className="text-sm font-semibold text-red">⚠️ Mermas</span>
            <span className="text-xs text-text2">{cart.length}</span>
          </div>
          {cart.map((c, i) => (
            <div key={i} className="flex items-center gap-2 px-3.5 py-2.5 border-l-2 border-red border-b border-surface3/50 last:border-b-0">
              <div className="flex-1">
                <div className="text-sm font-semibold text-text1">{c.prod}</div>
                <div className="text-xs text-text2">{c.motivo}</div>
              </div>
              <span className="font-mono font-bold text-sm text-red">-{c.qty}</span>
              <button onClick={() => removeFromCart(i)} className="text-red text-xs ml-1">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="h-px bg-surface3 mb-4" />

      <button
        disabled={cart.length === 0 || saving}
        onClick={submit}
        className="w-full bg-red text-white font-semibold py-3 rounded-card disabled:opacity-40 mb-2"
      >
        {saving ? 'Guardando…' : `⚠️ Registrar Merma (${cart.length})`}
      </button>
      <button onClick={() => { setCart([]); onClose() }} className="w-full bg-surface2 text-text1 font-semibold py-3 rounded-card">
        ✕ Cerrar
      </button>
    </div>
  )
}
