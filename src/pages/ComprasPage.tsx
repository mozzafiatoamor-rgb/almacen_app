/**
 * ComprasPage — Shopping list + Cart + Pedido por proveedor.
 *
 * Flow:
 *  1. Shows all low-stock products with a quantity stepper per item.
 *  2. User adjusts quantities and taps "Agregar al pedido" for each product.
 *  3. A sticky bottom bar counts cart items and shows the estimated total.
 *  4. Tapping "Ver pedido" opens a cart summary sheet grouped by proveedor.
 *  5. From the summary the user can:
 *     - Copy/share the order formatted per proveedor (useful to send to supplier).
 *     - Confirm → saves all items as Entradas in one batch.
 */
import { useState, useMemo } from 'react'
import { useStockBajo, useMovimientos, useInvalidate } from '../hooks/useSheets'
import { motion, AnimatePresence } from 'framer-motion'
import SearchBar   from '../components/shared/SearchBar'
import FilterPills from '../components/shared/FilterPills'
import EmptyState  from '../components/shared/EmptyState'
import AreaFilter, { AreaBadge } from '../components/shared/AreaFilter'
import { today, nowDateTime } from '../utils/dates'
import { useToast }   from '../hooks/useToast'
import { useAuth }    from '../auth/AuthContext'
import { appendMovimiento, appendBitacora, appendGasto } from '../api/appscript'
import { nextId }     from '../utils/ids'
import type { StockBajo, Movimiento, Area } from '../api/types'

// ─── Cart item type (local) ───────────────────────────────────────────────────

interface CartItem extends StockBajo {
  qtyOrdered: number  // how many the user will buy
}

// ─── Qty input (numeric keyboard) ────────────────────────────────────────────
// Typing is the primary way to enter a quantity. The ± buttons allow fast
// single-unit adjustments without pulling up the keyboard every time.

function QtyInput({ value, onChange, min = 1 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-lg bg-surface2 text-text1 font-bold text-lg flex items-center justify-center active:bg-surface3 select-none"
      >−</button>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        value={value === 0 ? '' : value}
        onChange={e => {
          const n = parseInt(e.target.value)
          onChange(isNaN(n) ? min : Math.max(min, n))
        }}
        onFocus={e => e.target.select()}
        className="w-14 h-8 text-center text-sm font-bold text-text1 bg-surface2 border border-surface3 rounded-lg outline-none focus:border-accent tabular-nums"
      />
      <button
        onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-lg bg-surface2 text-text1 font-bold text-lg flex items-center justify-center active:bg-surface3 select-none"
      >+</button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ComprasPage() {
  const stockBajo                  = useStockBajo()
  const { data: movimientos = [] } = useMovimientos()
  const toast                      = useToast()
  const { user }                   = useAuth()
  const invalidate                 = useInvalidate()

  const [query,        setQuery]       = useState('')
  const [provF,        setProvF]       = useState('todos')
  const [areaF,        setAreaF]       = useState<Area | 'todos'>('todos')
  // Per-product stepper qty (before adding to cart)
  const [pendingQty,   setPendingQty]  = useState<Record<string, number>>({})
  // Cart: products confirmed for this order
  const [cart,         setCart]        = useState<Record<string, CartItem>>({})
  const [showSummary,  setShowSummary] = useState(false)
  const [saving,       setSaving]      = useState(false)

  const proveedores = useMemo(
    () => [...new Set(stockBajo.map(p => p.proveedor))].sort(),
    [stockBajo]
  )

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return stockBajo.filter(p => {
      const matchProv = provF === 'todos' || p.proveedor === provF
      const matchQ    = !q || p.producto.toLowerCase().includes(q) || p.proveedor.toLowerCase().includes(q)
      const matchArea = areaF === 'todos' ? true : p.area === areaF || p.area === 'Ambas'
      return matchProv && matchQ && matchArea
    })
  }, [stockBajo, query, provF, areaF])

  const byProv = useMemo(() => {
    const g: Record<string, typeof filtered> = {}
    for (const p of filtered) {
      if (!g[p.proveedor]) g[p.proveedor] = []
      g[p.proveedor].push(p)
    }
    return g
  }, [filtered])

  const provKeys = Object.keys(byProv).sort()

  // Helper: get pending qty for a product (default = faltante)
  function getQty(p: StockBajo) {
    return pendingQty[p.producto] ?? p.faltante
  }

  // Add/update item in cart
  function addToCart(p: StockBajo) {
    const qty = getQty(p)
    if (qty < 1) { toast('La cantidad debe ser al menos 1', 'error'); return }
    setCart(prev => ({
      ...prev,
      [p.producto]: { ...p, qtyOrdered: qty },
    }))
    toast(`${p.producto} ×${qty} al pedido`)
  }

  function removeFromCart(producto: string) {
    setCart(prev => {
      const next = { ...prev }
      delete next[producto]
      return next
    })
  }

  const cartItems    = Object.values(cart)
  const cartCount    = cartItems.length
  const cartTotal    = cartItems.reduce((s, c) => s + (c.precioRef > 0 ? c.qtyOrdered * c.precioRef : 0), 0)

  // Budget of visible list (not cart)
  const presupuesto = useMemo(
    () => filtered.reduce((s, p) => s + (p.precioRef > 0 ? p.faltante * p.precioRef : 0), 0),
    [filtered]
  )

  // Cart grouped by proveedor (for summary)
  const cartByProv = useMemo(() => {
    const g: Record<string, CartItem[]> = {}
    for (const item of cartItems) {
      if (!g[item.proveedor]) g[item.proveedor] = []
      g[item.proveedor].push(item)
    }
    return g
  }, [cartItems])

  // Generate order text grouped by proveedor → area → products, with budget
  function buildOrderText() {
    const AREA_ORDER: Array<Area> = ['Barra', 'Cocina', 'General', 'Ambas']
    const AREA_HEADER: Record<string, string> = {
      Barra:   '🍸 BARRA',
      Cocina:  '🍳 COCINA',
      General: '📦 GENERAL',
      Ambas:   '↔️ COMPARTIDO',
    }
    const provs = Object.keys(cartByProv).sort()
    let txt = `📦 PEDIDO MOZZAFIATO — ${today()}\n━━━━━━━━━━━━━━━━━━━\n\n`
    let totalArticulos = 0
    let totalPresupuesto = 0

    for (const prov of provs) {
      const items = cartByProv[prov]
      const provTotal = items.reduce((s, i) => s + i.qtyOrdered, 0)
      const provBudget = items.reduce((s, i) => s + (i.precioRef > 0 ? i.qtyOrdered * i.precioRef : 0), 0)

      txt += `🏪 ${prov.toUpperCase()}\n`

      // Group items by area
      const byArea: Record<string, CartItem[]> = {}
      for (const item of items) {
        const key = item.area ?? 'General'
        if (!byArea[key]) byArea[key] = []
        byArea[key].push(item)
      }

      for (const areaKey of AREA_ORDER) {
        const areaItems = byArea[areaKey]
        if (!areaItems?.length) continue
        txt += `  ${AREA_HEADER[areaKey]}:\n`
        for (const item of areaItems) {
          const est = item.precioRef > 0
            ? ` (≈ $${(item.qtyOrdered * item.precioRef).toFixed(2)})`
            : ''
          txt += `    ▫ ${item.producto} — ${item.qtyOrdered} ${item.unidad}${est}\n`
        }
      }

      const budgetStr = provBudget > 0 ? ` · Presupuesto: ~$${provBudget.toFixed(2)}` : ''
      txt += `  📊 Subtotal: ${provTotal} artículo${provTotal !== 1 ? 's' : ''}${budgetStr}\n\n`
      totalArticulos += provTotal
      totalPresupuesto += provBudget
    }

    txt += `━━━━━━━━━━━━━━━━━━━\n`
    txt += `📊 TOTAL: ${totalArticulos} artículos en ${cartCount} producto${cartCount !== 1 ? 's' : ''}`
    if (totalPresupuesto > 0) txt += `\n💰 Presupuesto estimado: ~$${totalPresupuesto.toFixed(2)}`
    return txt
  }

  // Generate full list text (visible items, no cart needed)
  async function copyList() {
    let txt = `🛒 LISTA DE COMPRAS — ${today()}\nAlmacén Mozzafiato\n━━━━━━━━━━━━━━━━━━━\n\n`
    for (const prov of provKeys) {
      const provItems = byProv[prov]
      txt += `🏪 ${prov.toUpperCase()}\n`
      for (const p of provItems) {
        const est = p.precioRef > 0 ? ` ≈ $${(p.faltante * p.precioRef).toFixed(2)}` : ''
        txt += `  ▫ ${p.producto} — ${p.faltante} ${p.unidad}${est}\n`
      }
      txt += '\n'
    }
    if (presupuesto > 0) txt += `💰 Presupuesto estimado: $${presupuesto.toFixed(2)}\n`
    txt += `Total: ${filtered.length} productos`

    if (navigator.share) {
      navigator.share({ title: 'Lista de Compras', text: txt }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(txt)
      toast('Lista copiada al portapapeles')
    }
  }

  async function shareOrder() {
    const txt = buildOrderText()
    if (navigator.share) {
      navigator.share({ title: 'Pedido Mozzafiato', text: txt }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(txt)
      toast('Pedido copiado al portapapeles')
    }
  }

  // Save all cart items as Entradas
  async function confirmOrder() {
    if (!user || cartCount === 0) return
    setSaving(true)
    const n   = nowDateTime()
    let ok    = 0
    const ids = [...movimientos]

    for (const item of cartItems) {
      const id = nextId('MV', ids)
      try {
        await appendMovimiento([
          id, n.date, n.time, 'Entrada',
          item.categoria, item.producto, item.qtyOrdered,
          'Compra', user.nombre,
          'Pedido desde Lista de Compras',
          item.precioRef > 0 ? item.precioRef : '',
        ])
        ids.push({ id } as Movimiento)
        ok++

        // Register gasto if price ref exists
        if (item.precioRef > 0) {
          const gastoId = nextId('GS', [])
          await appendGasto([
            gastoId, n.date, n.time,
            item.producto, item.categoria,
            item.qtyOrdered, item.precioRef,
            item.qtyOrdered * item.precioRef,
            item.proveedor, user.nombre,
          ]).catch(() => {})
        }
      } catch {
        toast(`Error guardando ${item.producto}`, 'error')
      }
    }

    const detalle = cartItems.map(c => `${c.qtyOrdered} ${c.producto}`).join(', ')
    await appendBitacora([n.date, n.time, user.nombre, 'Entrada almacén', `Pedido: ${detalle}`, 'entrada']).catch(() => {})

    toast(`✅ ${ok} de ${cartCount} entradas guardadas`)
    setSaving(false)
    setCart({})
    setShowSummary(false)
    setPendingQty({})
    invalidate.catalogo()
    invalidate.movimientos()
    invalidate.bitacora()
    if (cartItems.some(c => c.precioRef > 0)) invalidate.gastos?.()
  }

  return (
    <div className="px-4 py-4 pb-32">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-bold">🛒 Lista de Compras</h1>
        {filtered.length > 0 && (
          <button onClick={copyList} className="text-xs font-semibold bg-surface2 text-text1 px-3 py-1.5 rounded-lg">
            📋 Copiar lista
          </button>
        )}
      </div>

      {/* Stock summary banner */}
      {stockBajo.length > 0 ? (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-3.5 py-2.5 mb-2 text-sm text-accent">
          🛒 <strong>{stockBajo.length} productos</strong> con stock bajo
        </div>
      ) : (
        <div className="bg-green/10 border border-green/30 rounded-xl px-3.5 py-2.5 mb-2 text-sm text-green">
          ✅ Todo el inventario está completo
        </div>
      )}

      {/* Budget estimate */}
      {presupuesto > 0 && (
        <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-3.5 py-2.5 mb-4 flex justify-between items-center">
          <span className="text-xs text-yellow-400 font-semibold">💰 Presupuesto estimado lista</span>
          <span className="text-sm font-bold text-yellow-400">
            ${presupuesto.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      <AreaFilter active={areaF} onChange={setAreaF} />
      <FilterPills options={proveedores} active={provF} onSelect={setProvF} allLabel="Todos" />
      <SearchBar value={query} onChange={setQuery} placeholder="Buscar producto o proveedor…" />

      {provKeys.length === 0
        ? <EmptyState icon="✅" message="No hay productos por comprar" />
        : provKeys.map(prov => (
            <div key={prov} className="bg-surface rounded-card border border-white/[0.04] mb-3 overflow-hidden">
              {/* Proveedor header */}
              <div className="flex justify-between items-center px-4 py-3 border-b border-surface3">
                <span className="text-sm font-bold">🏪 {prov}</span>
                <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-semibold">
                  {byProv[prov].length} items
                </span>
              </div>

              {/* Products */}
              {byProv[prov].map(p => {
                const inCart   = !!cart[p.producto]
                const qty      = getQty(p)
                const estPrice = p.precioRef > 0 ? qty * p.precioRef : 0

                return (
                  <div
                    key={p.producto}
                    className={`px-4 py-3 border-b border-surface3/50 last:border-0 transition-colors ${inCart ? 'bg-green/5' : ''}`}
                  >
                    {/* Product info row */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-text1">{p.producto}</span>
                          <AreaBadge area={p.area} />
                          {inCart ? (
                            <span className="text-[10px] bg-green/20 text-green px-1.5 py-0.5 rounded-md font-semibold">
                              ✓ En pedido ×{cart[p.producto].qtyOrdered}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-red/20 text-red px-1.5 py-0.5 rounded-md font-semibold">
                              Faltan {p.faltante} {p.unidad}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-text2 mt-0.5">
                          {p.categoria} · Stock: {p.stockActual}/{p.stockMinimo}
                          {p.precioRef > 0 && (
                            <span className="ml-1 text-yellow-400">
                              · ${p.precioRef.toFixed(2)}/u
                              {estPrice > 0 && ` · est $${estPrice.toFixed(2)}`}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stepper + action row */}
                    <div className="flex items-center gap-2">
                      <QtyInput
                        value={qty}
                        min={1}
                        onChange={n => setPendingQty(prev => ({ ...prev, [p.producto]: n }))}
                      />
                      <span className="text-xs text-text2 flex-1">{p.unidad}</span>
                      {inCart ? (
                        <button
                          onClick={() => removeFromCart(p.producto)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red/10 text-red border border-red/20"
                        >
                          Quitar
                        </button>
                      ) : (
                        <button
                          onClick={() => addToCart(p)}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-accent/20 text-accent border border-accent/30"
                        >
                          + Al pedido
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
      }

      {/* ── Sticky cart bar ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {cartCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="fixed bottom-[90px] left-4 right-4 z-[80]"
            style={{ bottom: 'calc(env(safe-area-inset-bottom) + 90px)' }}
          >
            <button
              onClick={() => setShowSummary(true)}
              className="w-full bg-accent shadow-lg shadow-accent/30 text-white font-bold py-3.5 rounded-2xl flex items-center justify-between px-5"
            >
              <span>🛒 {cartCount} producto{cartCount !== 1 ? 's' : ''} en pedido</span>
              <span className="flex items-center gap-2 text-sm">
                {cartTotal > 0 && <span className="text-white/80">${cartTotal.toFixed(2)}</span>}
                <span>Ver pedido →</span>
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cart summary sheet ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSummary && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] bg-black/60"
              onClick={() => !saving && setShowSummary(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-[160] bg-surface rounded-t-3xl max-h-[85vh] flex flex-col"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Sheet handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-white/20 rounded-full" />
              </div>

              {/* Sheet header */}
              <div className="flex justify-between items-center px-5 py-3 border-b border-surface3">
                <h2 className="text-base font-bold">📦 Resumen del pedido</h2>
                <button onClick={() => setShowSummary(false)} className="text-text2 text-lg">✕</button>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {Object.keys(cartByProv).sort().map(prov => {
                  const provItems = cartByProv[prov]
                  const provBudget = provItems.reduce((s, i) => s + (i.precioRef > 0 ? i.qtyOrdered * i.precioRef : 0), 0)
                  const provTotal  = provItems.reduce((s, i) => s + i.qtyOrdered, 0)
                  // Group by area
                  const AREA_ORDER_DISP: Array<Area> = ['Barra', 'Cocina', 'General', 'Ambas']
                  const AREA_ICON_MAP: Record<string, string> = { Barra: '🍸', Cocina: '🍳', General: '📦', Ambas: '↔️' }
                  const byAreaDisp: Record<string, CartItem[]> = {}
                  for (const item of provItems) {
                    const key = item.area ?? 'General'
                    if (!byAreaDisp[key]) byAreaDisp[key] = []
                    byAreaDisp[key].push(item)
                  }
                  return (
                    <div key={prov} className="mb-5">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-bold text-text2 uppercase tracking-wide">🏪 {prov}</div>
                        <div className="text-[10px] text-text2">{provTotal} arts{provBudget > 0 ? ` · ~$${provBudget.toFixed(2)}` : ''}</div>
                      </div>
                      {AREA_ORDER_DISP.map(areaKey => {
                        const areaItems = byAreaDisp[areaKey]
                        if (!areaItems?.length) return null
                        return (
                          <div key={areaKey} className="mb-2">
                            <div className="text-[10px] font-semibold text-text2/60 uppercase mb-1 pl-1">
                              {AREA_ICON_MAP[areaKey]} {areaKey}
                            </div>
                            {areaItems.map(item => (
                              <div key={item.producto} className="flex items-center gap-2 py-2 border-b border-surface3/50 last:border-0">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-semibold text-text1 truncate">{item.producto}</div>
                                  <div className="text-xs text-text2">{item.unidad}</div>
                                </div>
                                <div className="text-right flex-none">
                                  <div className="text-sm font-bold text-accent">{item.qtyOrdered} {item.unidad}</div>
                                  {item.precioRef > 0 && (
                                    <div className="text-xs text-yellow-400">
                                      ${(item.qtyOrdered * item.precioRef).toFixed(2)}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => removeFromCart(item.producto)}
                                  className="text-red/60 text-sm ml-1"
                                >✕</button>
                              </div>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}

                {/* Total */}
                {cartTotal > 0 && (
                  <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-3 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-yellow-400">💰 Total estimado</span>
                      <span className="text-base font-bold text-yellow-400">${cartTotal.toFixed(2)}</span>
                    </div>
                    <div className="text-xs text-yellow-400/70 mt-0.5">{cartCount} producto{cartCount !== 1 ? 's' : ''} · {cartItems.reduce((s, i) => s + i.qtyOrdered, 0)} artículos en total</div>
                  </div>
                )}
              </div>

              {/* Sheet actions */}
              <div className="px-5 pt-3 pb-4 border-t border-surface3 flex flex-col gap-2">
                <button
                  onClick={shareOrder}
                  className="w-full bg-surface2 text-text1 font-semibold py-3 rounded-card text-sm"
                >
                  📋 Copiar pedido por proveedor
                </button>
                <button
                  disabled={saving}
                  onClick={confirmOrder}
                  className="w-full bg-green text-bg font-bold py-3.5 rounded-card disabled:opacity-40"
                >
                  {saving ? 'Guardando entradas…' : `✅ Confirmar ${cartCount} entrada${cartCount !== 1 ? 's' : ''}`}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
