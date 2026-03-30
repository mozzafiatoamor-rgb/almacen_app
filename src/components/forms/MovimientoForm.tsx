import { useState } from 'react'
import type { Producto, CartItemMov } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../hooks/useToast'
import { useInvalidate } from '../../hooks/useSheets'
import { appendMovimiento, appendBitacora } from '../../api/appscript'
import { nextId } from '../../utils/ids'
import { nowDateTime } from '../../utils/dates'
import ProductAutocomplete from '../shared/ProductAutocomplete'
import type { Movimiento } from '../../api/types'

const MOTIVOS_ENTRADA = ['Compra', 'Reposición', 'Transferencia', 'Ajuste inventario', 'Otro']
const MOTIVOS_SALIDA  = ['Uso cocina', 'Uso barra', 'Uso limpieza', 'Transferencia', 'Ajuste inventario', 'Otro']

interface Props {
  tipo:        'Entrada' | 'Salida'
  catalogo:    Producto[]
  movimientos: Movimiento[]
  onClose:     () => void
}

export default function MovimientoForm({ tipo, catalogo, movimientos, onClose }: Props) {
  const { user }    = useAuth()
  const toast       = useToast()
  const invalidate  = useInvalidate()

  const [product,  setProduct]  = useState<Producto | null>(null)
  const [qty,      setQty]      = useState('')
  const [motivo,   setMotivo]   = useState(tipo === 'Entrada' ? MOTIVOS_ENTRADA[0] : MOTIVOS_SALIDA[0])
  const [notas,    setNotas]    = useState('')
  const [modoPaq,  setModoPaq]  = useState(true)   // only for Entrada
  const [cart,     setCart]     = useState<CartItemMov[]>([])
  const [saving,   setSaving]   = useState(false)

  const isEnt   = tipo === 'Entrada'
  const color   = isEnt ? 'text-green' : 'text-orange'
  const btnBg   = isEnt ? 'bg-green text-bg' : 'bg-orange text-white'

  // Conversion info
  const realQty = (() => {
    const n = parseInt(qty) || 0
    if (!isEnt || !product || !modoPaq || product.pzaPaq <= 1) return n
    return n * product.pzaPaq
  })()

  const convInfo = (() => {
    if (!isEnt || !product || !modoPaq || product.pzaPaq <= 1 || !qty) return null
    const n = parseInt(qty) || 0
    return `${n} paq × ${product.pzaPaq} = ${realQty} ${product.unidad}`
  })()

  function addToCart() {
    if (!product || !qty || parseInt(qty) < 1) { toast('Completa todos los campos', 'error'); return }

    // Stock check for salidas
    if (tipo === 'Salida') {
      const inCart = cart.filter(c => c.prod === product.producto).reduce((s, c) => s + c.qty, 0)
      if (realQty + inCart > product.stockActual) {
        toast(`Solo hay ${product.stockActual} ${product.unidad} de ${product.producto}`, 'error')
        return
      }
    }

    const notaConv = isEnt && modoPaq && product.pzaPaq > 1 ? `${qty} paq×${product.pzaPaq}` : ''
    setCart(prev => [...prev, {
      cat: product.categoria, prod: product.producto,
      qty: realQty, tipo, motivo, notas, notaConv,
    }])
    toast(`${product.producto} ×${realQty} agregado`)
    setProduct(null); setQty(''); setNotas('')
  }

  function removeFromCart(i: number) {
    setCart(prev => prev.filter((_, idx) => idx !== i))
  }

  async function submit() {
    if (!cart.length || !user) return
    setSaving(true)
    const n   = nowDateTime()
    let ok    = 0
    const ids = [...movimientos]

    for (const item of cart) {
      const id = nextId('MV', ids)
      try {
        await appendMovimiento([
          id, n.date, n.time, item.tipo,
          item.cat, item.prod, item.qty,
          item.motivo, user.nombre,
          item.notaConv ? `${item.notas} [${item.notaConv}]`.trim() : item.notas,
        ])
        ids.push({ id } as Movimiento)
        ok++
      } catch {
        toast(`Error guardando ${item.prod}`, 'error')
      }
    }

    // Log to bitácora
    const detalle = cart.map(c => `${c.qty} ${c.prod} (${c.motivo})`).join(', ')
    await appendBitacora([n.date, n.time, user.nombre, `${tipo} almacén`, detalle, tipo.toLowerCase()])
      .catch(() => {})

    toast(`${ok}/${cart.length} ${tipo.toLowerCase()}(s) guardadas`)
    setSaving(false)
    invalidate.catalogo()
    invalidate.movimientos()
    invalidate.bitacora()
    onClose()
  }

  return (
    <div>
      <h2 className={`text-lg font-bold mb-4 ${color}`}>
        {isEnt ? '📥' : '📤'} {tipo} de Almacén
      </h2>
      <div className="bg-surface2 rounded-xl px-3.5 py-2.5 mb-4 text-sm">
        👤 <strong>{user?.nombre}</strong>
      </div>

      {/* Product selector */}
      <div className="mb-3">
        <label className="block text-xs font-semibold text-text2 mb-1.5">Producto</label>
        <ProductAutocomplete catalogo={catalogo} value={product} onChange={setProduct} />
      </div>

      {/* Stock info */}
      {product && (
        <div className="bg-surface2 rounded-xl px-3.5 py-2.5 mb-3 text-sm">
          📦 Stock actual: <strong className="text-accent">{product.stockActual}</strong> {product.unidad}
          {product.pzaPaq > 1 && <span className="text-text2 ml-2">· 1 paq = {product.pzaPaq} {product.unidad}</span>}
        </div>
      )}

      {/* Entrada mode toggle */}
      {isEnt && (
        <div className="mb-3">
          <label className="block text-xs font-semibold text-text2 mb-1.5">Modo de entrada</label>
          <div className="flex gap-2">
            <button
              onClick={() => setModoPaq(true)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${modoPaq ? 'bg-accent text-white' : 'bg-surface2 text-text2'}`}
            >
              Paquetes
            </button>
            <button
              onClick={() => setModoPaq(false)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${!modoPaq ? 'bg-accent text-white' : 'bg-surface2 text-text2'}`}
            >
              Piezas directas
            </button>
          </div>
        </div>
      )}

      {/* Quantity */}
      <div className="mb-3">
        <label className="block text-xs font-semibold text-text2 mb-1.5">
          {isEnt && modoPaq ? 'Cantidad de paquetes' : 'Cantidad'}
        </label>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={qty}
          onChange={e => setQty(e.target.value)}
          className="w-full bg-surface2 border border-surface3 rounded-card px-3.5 py-3 text-sm text-text1 outline-none focus:border-accent"
          placeholder="0"
        />
        {convInfo && (
          <div className="mt-1.5 bg-green/10 border border-green/30 rounded-xl px-3.5 py-2 text-xs text-green">
            📦 {convInfo} entrarán al inventario
          </div>
        )}
      </div>

      {/* Motivo */}
      <div className="mb-3">
        <label className="block text-xs font-semibold text-text2 mb-1.5">Motivo</label>
        <select
          value={motivo}
          onChange={e => setMotivo(e.target.value)}
          className="w-full bg-surface2 border border-surface3 rounded-card px-3.5 py-3 text-sm text-text1 outline-none focus:border-accent"
        >
          {(isEnt ? MOTIVOS_ENTRADA : MOTIVOS_SALIDA).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Notas */}
      <div className="mb-4">
        <label className="block text-xs font-semibold text-text2 mb-1.5">Notas (opcional)</label>
        <textarea
          value={notas}
          onChange={e => setNotas(e.target.value)}
          rows={2}
          placeholder="Observaciones…"
          className="w-full bg-surface2 border border-surface3 rounded-card px-3.5 py-3 text-sm text-text1 outline-none focus:border-accent resize-none"
        />
      </div>

      <button
        onClick={addToCart}
        className="w-full bg-surface2 text-text1 font-semibold py-3 rounded-card mb-4"
      >
        ➕ Agregar a lista
      </button>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="mb-4 border border-surface3 rounded-card overflow-hidden">
          <div className="flex justify-between items-center px-3.5 py-2.5 border-b border-surface3">
            <span className={`text-sm font-semibold ${color}`}>{isEnt ? '📥' : '📤'} Lista</span>
            <span className="text-xs text-text2">{cart.length} items</span>
          </div>
          {cart.map((c, i) => (
            <div key={i} className="flex items-center gap-2 px-3.5 py-2.5 border-b border-surface3/50 last:border-0">
              <div className="flex-1">
                <div className="text-sm font-semibold text-text1">{c.prod}</div>
                <div className="text-xs text-text2">{c.motivo}{c.notaConv ? ` · 📦 ${c.notaConv}` : ''}</div>
              </div>
              <span className={`font-mono font-bold text-sm ${color}`}>{isEnt ? '+' : '-'}{c.qty}</span>
              <button onClick={() => removeFromCart(i)} className="text-red text-xs ml-1">✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="h-px bg-surface3 mb-4" />

      <button
        disabled={cart.length === 0 || saving}
        onClick={submit}
        className={`w-full ${btnBg} font-semibold py-3 rounded-card disabled:opacity-40 transition-opacity mb-2`}
      >
        {saving ? 'Guardando…' : `${isEnt ? '📥' : '📤'} Guardar ${tipo} (${cart.length})`}
      </button>
      <button onClick={() => { setCart([]); onClose() }} className="w-full bg-surface2 text-text1 font-semibold py-3 rounded-card">
        ✕ Cerrar
      </button>
    </div>
  )
}
