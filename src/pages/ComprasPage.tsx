/**
 * ComprasPage — Shopping list + Quick Entry.
 *
 * Shows products with stock below minimum grouped by proveedor.
 * Each item shows:
 *   - How many units are missing
 *   - Budget estimate (faltante × precioRef) when price reference exists
 *   - "Registrar compra" button → inline mini-form to register an Entrada
 *     right there from the store, without navigating away.
 *
 * The traditional Entradas modal is still accessible from the navigation.
 */
import { useState, useMemo } from 'react'
import { useStockBajo, useMovimientos, useInvalidate } from '../hooks/useSheets'
import { useCatalogo } from '../hooks/useSheets'
import SearchBar  from '../components/shared/SearchBar'
import FilterPills from '../components/shared/FilterPills'
import EmptyState  from '../components/shared/EmptyState'
import { today, nowDateTime } from '../utils/dates'
import { useToast }   from '../hooks/useToast'
import { useAuth }    from '../auth/AuthContext'
import { appendMovimiento, appendBitacora, appendGasto } from '../api/appscript'
import { nextId }     from '../utils/ids'
import type { StockBajo, Movimiento } from '../api/types'

// ─── Quick entry form (inline per product) ────────────────────────────────────

interface QuickEntryProps {
  item:        StockBajo
  movimientos: Movimiento[]
  onSaved:     () => void
  onCancel:    () => void
}

function QuickEntryForm({ item, movimientos, onSaved, onCancel }: QuickEntryProps) {
  const { user }   = useAuth()
  const toast      = useToast()
  const invalidate = useInvalidate()

  const [qty,        setQty]        = useState(String(item.faltante))
  const [precioUnit, setPrecioUnit] = useState(item.precioRef > 0 ? String(item.precioRef) : '')
  const [saving,     setSaving]     = useState(false)

  const precio = parseFloat(precioUnit) || 0
  const qtyNum = parseInt(qty) || 0
  const total  = precio > 0 && qtyNum > 0 ? qtyNum * precio : 0

  async function confirmar() {
    if (!user) return
    if (qtyNum < 1) { toast('Cantidad inválida', 'error'); return }
    setSaving(true)

    const n  = nowDateTime()
    const id = nextId('MV', movimientos)

    try {
      await appendMovimiento([
        id, n.date, n.time, 'Entrada',
        item.categoria, item.producto, qtyNum,
        'Compra', user.nombre,
        'Registrado desde Lista de Compras',
        precio > 0 ? precio : '',
      ])

      // Register gasto if price provided
      if (precio > 0) {
        const gastoId = nextId('GS', [])
        await appendGasto([
          gastoId, n.date, n.time,
          item.producto, item.categoria,
          qtyNum, precio, total,
          item.proveedor, user.nombre,
        ]).catch(() => {})
      }

      await appendBitacora([
        n.date, n.time, user.nombre,
        'Entrada almacén',
        `${qtyNum} ${item.producto} (Compra desde lista)`,
        'entrada',
      ]).catch(() => {})

      toast(`✅ ${item.producto} ×${qtyNum} registrado`)
      invalidate.catalogo()
      invalidate.movimientos()
      invalidate.bitacora()
      if (precio > 0) invalidate.gastos?.()
      onSaved()
    } catch (err) {
      toast('Error: ' + (err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 bg-bg border border-accent/30 rounded-xl p-3 space-y-2">
      <div className="text-xs font-semibold text-accent mb-1">📥 Registrar compra</div>

      {/* Quantity */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-text2 w-20 flex-none">Cantidad</label>
        <input
          type="number"
          inputMode="numeric"
          min="1"
          value={qty}
          onChange={e => setQty(e.target.value)}
          className="flex-1 bg-surface2 border border-surface3 rounded-lg px-3 py-2 text-sm text-text1 outline-none focus:border-accent"
        />
      </div>

      {/* Precio unitario */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-text2 w-20 flex-none">Precio/u</label>
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text2 text-sm">$</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={precioUnit}
            onChange={e => setPrecioUnit(e.target.value)}
            className="w-full bg-surface2 border border-surface3 rounded-lg pl-7 pr-3 py-2 text-sm text-text1 outline-none focus:border-accent"
            placeholder="0.00"
          />
        </div>
      </div>

      {/* Total preview */}
      {total > 0 && (
        <div className="text-xs text-yellow-400 text-right">
          💰 Total: ${total.toFixed(2)}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 bg-surface2 text-text2 text-xs font-semibold py-2 rounded-lg"
        >
          Cancelar
        </button>
        <button
          disabled={saving || qtyNum < 1}
          onClick={confirmar}
          className="flex-1 bg-green text-bg text-xs font-semibold py-2 rounded-lg disabled:opacity-40"
        >
          {saving ? 'Guardando…' : '✅ Confirmar entrada'}
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ComprasPage() {
  const stockBajo                  = useStockBajo()
  const { data: movimientos = [] } = useMovimientos()
  const toast                      = useToast()

  const [query,     setQuery]    = useState('')
  const [provF,     setProvF]    = useState('todos')
  const [openEntry, setOpenEntry] = useState<string | null>(null)  // producto name

  const proveedores = useMemo(
    () => [...new Set(stockBajo.map(p => p.proveedor))].sort(),
    [stockBajo]
  )

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return stockBajo.filter(p =>
      (provF === 'todos' || p.proveedor === provF) &&
      (!q || p.producto.toLowerCase().includes(q) || p.proveedor.toLowerCase().includes(q))
    )
  }, [stockBajo, query, provF])

  const byProv = useMemo(() => {
    const g: Record<string, typeof filtered> = {}
    for (const p of filtered) {
      if (!g[p.proveedor]) g[p.proveedor] = []
      g[p.proveedor].push(p)
    }
    return g
  }, [filtered])

  const provKeys = Object.keys(byProv).sort()

  // Total presupuesto estimado
  const presupuesto = useMemo(
    () => filtered.reduce((s, p) => s + (p.precioRef > 0 ? p.faltante * p.precioRef : 0), 0),
    [filtered]
  )

  // Budget by proveedor
  const budgetByProv = useMemo(() => {
    const b: Record<string, number> = {}
    for (const p of filtered) {
      if (p.precioRef > 0) b[p.proveedor] = (b[p.proveedor] ?? 0) + p.faltante * p.precioRef
    }
    return b
  }, [filtered])

  async function copyList() {
    let txt = `🛒 LISTA DE COMPRAS - ${today()}\nAlmacén Mozzafiato\n━━━━━━━━━━━━━━━━━━━\n\n`
    for (const prov of provKeys) {
      const provBudget = budgetByProv[prov]
      txt += `🏪 ${prov.toUpperCase()}${provBudget ? ` (est. $${provBudget.toFixed(2)})` : ''}\n`
      for (const p of byProv[prov]) {
        const est = p.precioRef > 0 ? ` ≈ $${(p.faltante * p.precioRef).toFixed(2)}` : ''
        txt += `  ▫ ${p.producto} — Comprar: ${p.faltante} ${p.unidad}${est} (Stock: ${p.stockActual}/${p.stockMinimo})\n`
      }
      txt += '\n'
    }
    if (presupuesto > 0) txt += `💰 Presupuesto total estimado: $${presupuesto.toFixed(2)}\n`
    txt += `Total: ${filtered.length} productos`

    if (navigator.share) {
      navigator.share({ title: 'Lista de Compras', text: txt }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(txt)
      toast('Lista copiada al portapapeles')
    }
  }

  return (
    <div className="px-4 py-4 pb-24">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-bold">🛒 Lista de Compras</h1>
        {filtered.length > 0 && (
          <button onClick={copyList} className="text-xs font-semibold bg-accent text-white px-3 py-1.5 rounded-lg">
            📋 Copiar Lista
          </button>
        )}
      </div>

      {/* Summary banner */}
      {stockBajo.length > 0 ? (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-3.5 py-2.5 mb-2 text-sm text-accent">
          🛒 <strong>{stockBajo.length} productos</strong> necesitan reabastecimiento
        </div>
      ) : (
        <div className="bg-green/10 border border-green/30 rounded-xl px-3.5 py-2.5 mb-2 text-sm text-green">
          ✅ Todo el inventario está completo
        </div>
      )}

      {/* Budget estimate */}
      {presupuesto > 0 && (
        <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-3.5 py-2.5 mb-4 flex justify-between items-center">
          <span className="text-xs text-yellow-400 font-semibold">💰 Presupuesto estimado</span>
          <span className="text-sm font-bold text-yellow-400">
            ${presupuesto.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      )}

      <FilterPills options={proveedores} active={provF} onSelect={setProvF} allLabel="Todos" />
      <SearchBar value={query} onChange={setQuery} placeholder="Buscar producto o proveedor…" />

      {provKeys.length === 0
        ? <EmptyState icon="✅" message="No hay productos por comprar" />
        : provKeys.map(prov => (
            <div key={prov} className="bg-surface rounded-card border border-white/[0.04] mb-3 overflow-hidden">
              {/* Proveedor header */}
              <div className="flex justify-between items-center px-4 py-3 border-b border-surface3">
                <span className="text-sm font-bold">🏪 {prov}</span>
                <div className="flex items-center gap-2">
                  {budgetByProv[prov] && (
                    <span className="text-xs text-yellow-400 font-semibold">
                      ${budgetByProv[prov].toFixed(2)}
                    </span>
                  )}
                  <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-semibold">
                    {byProv[prov].length} items
                  </span>
                </div>
              </div>

              {/* Product rows */}
              {byProv[prov].map(p => (
                <div key={p.producto} className="border-b border-surface3/50 last:border-0">
                  <div className="flex items-center px-4 py-3 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-text1">{p.producto}</span>
                        <span className="text-[10px] bg-red/20 text-red px-1.5 py-0.5 rounded-md font-semibold">
                          Faltan {p.faltante} {p.unidad}
                        </span>
                      </div>
                      <div className="text-xs text-text2 mt-0.5">
                        {p.categoria} · Stock: {p.stockActual}/{p.stockMinimo}
                        {p.precioRef > 0 && (
                          <span className="ml-1.5 text-yellow-400">
                            · Ref: ${p.precioRef.toFixed(2)} · Est: ${(p.faltante * p.precioRef).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick entry button */}
                    <button
                      onClick={() => setOpenEntry(openEntry === p.producto ? null : p.producto)}
                      className={`flex-none text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                        openEntry === p.producto
                          ? 'bg-accent text-white'
                          : 'bg-green/20 text-green border border-green/30'
                      }`}
                    >
                      {openEntry === p.producto ? 'Cerrar' : '📥 Comprar'}
                    </button>
                  </div>

                  {/* Inline quick entry */}
                  {openEntry === p.producto && (
                    <div className="px-4 pb-3">
                      <QuickEntryForm
                        item={p}
                        movimientos={movimientos}
                        onSaved={() => setOpenEntry(null)}
                        onCancel={() => setOpenEntry(null)}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
      }
    </div>
  )
}
