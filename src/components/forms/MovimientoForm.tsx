import { useState } from 'react'
import type { Producto, CartItemMov } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../hooks/useToast'
import { useInvalidate } from '../../hooks/useSheets'
import { appendMovimiento, appendBitacora, appendGasto } from '../../api/appscript'
import { nextId } from '../../utils/ids'
import { nowDateTime } from '../../utils/dates'
import ProductAutocomplete from '../shared/ProductAutocomplete'
import BarcodeScanner from '../shared/BarcodeScanner'
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

  const [product,     setProduct]     = useState<Producto | null>(null)
  const [qty,         setQty]         = useState('')
  const [motivo,      setMotivo]      = useState(tipo === 'Entrada' ? MOTIVOS_ENTRADA[0] : MOTIVOS_SALIDA[0])
  const [notas,       setNotas]       = useState('')
  const [modoPaq,     setModoPaq]     = useState(true)   // only for Entrada
  const [precioUnit,  setPrecioUnit]  = useState('')     // optional unit price for Entradas
  const [cart,        setCart]        = useState<CartItemMov[]>([])
  const [saving,      setSaving]      = useState(false)
  const [scanning,    setScanning]    = useState(false)

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

  // Price-related helpers
  const precio = parseFloat(precioUnit) || 0
  const totalItem = precio > 0 ? realQty * precio : 0

  // Called when barcode is detected — try to match with catalog
  function handleBarcodeDetected(code: string) {
    setScanning(false)
    const match = catalogo.find(p => p.codigoBarras === code)
    if (match) {
      setProduct(match)
      toast(`✅ ${match.producto} encontrado`)
    } else {
      toast(`Código ${code} no asignado a ningún producto`, 'error')
    }
  }

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
      cat:        product.categoria,
      prod:       product.producto,
      qty:        realQty,
      tipo,
      motivo,
      notas,
      notaConv,
      precioUnit: precio,
      proveedor:  product.proveedor,
    }])

    const precioStr = precio > 0 ? ` · $${precio.toFixed(2)}/u` : ''
    toast(`${product.producto} ×${realQty} agregado${precioStr}`)
    setProduct(null); setQty(''); setNotas(''); setPrecioUnit('')
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
          item.precioUnit > 0 ? item.precioUnit : '',
        ])
        ids.push({ id } as Movimiento)
        ok++

        // Register gasto if price was provided (Entradas only)
        if (isEnt && item.precioUnit > 0) {
          const gastoId = nextId('GS', [])
          await appendGasto([
            gastoId, n.date, n.time,
            item.prod, item.cat,
            item.qty, item.precioUnit,
            item.qty * item.precioUnit,
            item.proveedor, user.nombre,
          ]).catch(() => {}) // non-fatal
        }
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
    if (cart.some(c => c.precioUnit > 0)) invalidate.gastos?.()
    onClose()
  }

  // Cart total
  const cartTotal = cart.reduce((s, c) => s + c.qty * (c.precioUnit || 0), 0)

  return (
    <>
      {/* Barcode scanner fullscreen overlay */}
      {scanning && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setScanning(false)}
        />
      )}

      <div>
        <h2 className={`text-lg font-bold mb-4 ${color}`}>
          {isEnt ? '📥' : '📤'} {tipo} de Almacén
        </h2>
        <div className="bg-surface2 rounded-xl px-3.5 py-2.5 mb-4 text-sm">
          👤 <strong>{user?.nombre}</strong>
        </div>

        {/* Product selector + scan button */}
        <div className="mb-3">
          <label className="block text-xs font-semibold text-text2 mb-1.5">Producto</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <ProductAutocomplete catalogo={catalogo} value={product} onChange={setProduct} />
            </div>
            <button
              onClick={() => setScanning(true)}
              className="w-11 h-11 rounded-card bg-surface2 border border-surface3 flex items-center justify-center text-lg flex-none"
              title="Escanear código de barras"
            >
              📷
            </button>
          </div>
        </div>

        {/* Stock info */}
        {product && (
          <div className="bg-surface2 rounded-xl px-3.5 py-2.5 mb-3 text-sm">
            📦 Stock actual: <strong className="text-accent">{product.stockActual}</strong> {product.unidad}
            {product.pzaPaq > 1 && <span className="text-text2 ml-2">· 1 paq = {product.pzaPaq} {product.unidad}</span>}
            {product.precioRef > 0 && (
              <span className="text-text2 ml-2">· Ref: ${product.precioRef.toFixed(2)}</span>
            )}
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

        {/* Precio unitario — only for Entradas */}
        {isEnt && (
          <div className="mb-3">
            <label className="block text-xs font-semibold text-text2 mb-1.5">
              Precio unitario <span className="text-text2 font-normal">(opcional — registra gasto)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text2 text-sm">$</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={precioUnit}
                onChange={e => setPrecioUnit(e.target.value)}
                className="w-full bg-surface2 border border-surface3 rounded-card pl-7 pr-3.5 py-3 text-sm text-text1 outline-none focus:border-accent"
                placeholder="0.00"
              />
            </div>
            {precio > 0 && realQty > 0 && (
              <div className="mt-1.5 bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-3.5 py-2 text-xs text-yellow-400">
                💰 Total: ${(realQty * precio).toFixed(2)} · se actualizará el precio de referencia
              </div>
            )}
          </div>
        )}

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
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-text1 truncate">{c.prod}</div>
                  <div className="text-xs text-text2">
                    {c.motivo}
                    {c.notaConv ? ` · 📦 ${c.notaConv}` : ''}
                    {c.precioUnit > 0 ? ` · $${c.precioUnit.toFixed(2)}/u` : ''}
                  </div>
                </div>
                <div className="text-right flex-none">
                  <span className={`font-mono font-bold text-sm ${color}`}>{isEnt ? '+' : '-'}{c.qty}</span>
                  {c.precioUnit > 0 && (
                    <div className="text-xs text-yellow-400">${(c.qty * c.precioUnit).toFixed(2)}</div>
                  )}
                </div>
                <button onClick={() => removeFromCart(i)} className="text-red text-xs ml-1">✕</button>
              </div>
            ))}
            {/* Cart total (only when prices present) */}
            {cartTotal > 0 && (
              <div className="px-3.5 py-2.5 flex justify-between items-center bg-surface2">
                <span className="text-xs font-semibold text-text2">Total estimado</span>
                <span className="text-sm font-bold text-yellow-400">${cartTotal.toFixed(2)}</span>
              </div>
            )}
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
    </>
  )
}
