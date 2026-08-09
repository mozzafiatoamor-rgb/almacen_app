/**
 * PedidosPage — pending and received supplier orders.
 *
 * Flow:
 *  1. Shows pedidos pendientes grouped by proveedor.
 *  2. "✅ Recibir pedido" marks items as recibido AND creates Entradas in Movimientos.
 *  3. Tab filter: Pendientes / Recibidos / Todos.
 */
import { useState, useMemo } from 'react'
import { usePedidos, useMovimientos, useInvalidate } from '../hooks/useSheets'
import { updatePedidoEstado, appendMovimiento, appendBitacora } from '../api/appscript'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../hooks/useToast'
import { today, nowDateTime } from '../utils/dates'
import { nextId } from '../utils/ids'
import type { Pedido, EstadoPedido } from '../api/types'

type FilterTab = 'pendiente' | 'recibido' | 'todos'

const ESTADO_COLOR: Record<EstadoPedido, string> = {
  pendiente:  'bg-yellow-400/20 text-yellow-400 border-yellow-400/30',
  recibido:   'bg-green/20 text-green border-green/30',
  cancelado:  'bg-red/20 text-red border-red/30',
}

export default function PedidosPage() {
  const { data: pedidos    = [], isLoading } = usePedidos()
  const { data: movimientos = [] }           = useMovimientos()
  const { user }     = useAuth()
  const toast        = useToast()
  const invalidate   = useInvalidate()

  const [filterTab,  setFilterTab]  = useState<FilterTab>('pendiente')
  const [receiving,  setReceiving]  = useState<string | null>(null)  // proveedor being received

  // Group visible pedidos by proveedor
  const filtered = useMemo(() => {
    if (filterTab === 'todos') return pedidos
    return pedidos.filter(p => p.estado === filterTab)
  }, [pedidos, filterTab])

  const byProv = useMemo(() => {
    const g: Record<string, Pedido[]> = {}
    for (const p of filtered) {
      if (!g[p.proveedor]) g[p.proveedor] = []
      g[p.proveedor].push(p)
    }
    return g
  }, [filtered])

  const provKeys = Object.keys(byProv).sort()

  const pendienteCount = pedidos.filter(p => p.estado === 'pendiente').length

  // Receive all pedido items from a single proveedor
  async function handleReceive(prov: string) {
    if (!user) return
    const items = byProv[prov]?.filter(p => p.estado === 'pendiente') ?? []
    if (items.length === 0) return

    setReceiving(prov)
    const n   = nowDateTime()
    const ids = [...movimientos]
    let ok    = 0

    for (const item of items) {
      try {
        // 1. Create Entrada in Movimientos
        const movId = nextId('MV', ids)
        await appendMovimiento([
          movId, n.date, n.time, 'Entrada',
          '',             // categoria — not stored in pedidos, leave blank
          item.producto, item.cantidad,
          'Pedido recibido', user.nombre,
          `Pedido ${item.id} de ${item.proveedor}`,
          item.precioRef > 0 ? item.precioRef : '',
        ])
        ids.push({ id: movId } as typeof ids[0])

        // 2. Mark pedido row as recibido
        const fullRow: (string | number)[] = [
          item.id, item.fecha, item.proveedor, item.producto,
          item.cantidad, item.unidad, item.precioRef,
          item.estado, item.fechaRecibido, item.responsable,
        ]
        await updatePedidoEstado(item._row, fullRow, 'recibido', today())
        ok++
      } catch {
        toast(`Error recibiendo ${item.producto}`, 'error')
      }
    }

    // Bitácora entry
    const detalle = items.map(i => `${i.cantidad} ${i.producto}`).join(', ')
    await appendBitacora([n.date, n.time, user.nombre, 'Pedido recibido', `${prov}: ${detalle}`, 'entrada']).catch(() => {})

    toast(`✅ ${ok} de ${items.length} entradas registradas`)
    setReceiving(null)
    await Promise.all([invalidate.pedidos(), invalidate.movimientos(), invalidate.catalogo(), invalidate.bitacora()])
  }

  if (isLoading) return <div className="flex items-center justify-center py-16 text-text2 text-sm">⏳ Cargando…</div>

  return (
    <div className="px-4 py-4 pb-24">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-bold">
          📋 Pedidos
          {pendienteCount > 0 && (
            <span className="ml-2 text-xs bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full font-semibold border border-yellow-400/30">
              {pendienteCount} pendiente{pendienteCount !== 1 ? 's' : ''}
            </span>
          )}
        </h1>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(['pendiente', 'recibido', 'todos'] as FilterTab[]).map(t => (
          <button
            key={t}
            onClick={() => setFilterTab(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${
              filterTab === t
                ? 'bg-accent text-white border-accent'
                : 'bg-surface2 text-text2 border-surface3'
            }`}
          >
            {t === 'pendiente' ? '⏳ Pendientes' : t === 'recibido' ? '✅ Recibidos' : '📋 Todos'}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {provKeys.length === 0 && (
        <div className="text-center py-12 text-text2 text-sm">
          <div className="text-3xl mb-2">📋</div>
          {filterTab === 'pendiente' ? 'No hay pedidos pendientes' :
           filterTab === 'recibido'  ? 'No hay pedidos recibidos'  : 'Sin pedidos registrados'}
        </div>
      )}

      {/* Pedidos by proveedor */}
      {provKeys.map(prov => {
        const items        = byProv[prov]
        const pendientes   = items.filter(i => i.estado === 'pendiente')
        const total        = items.reduce((s, i) => s + (i.precioRef > 0 ? i.cantidad * i.precioRef : 0), 0)
        const isReceiving  = receiving === prov

        return (
          <div key={prov} className="bg-surface rounded-card border border-white/[0.04] mb-3 overflow-hidden">
            {/* Proveedor header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-surface3">
              <div>
                <span className="text-sm font-bold">🏪 {prov}</span>
                <span className="ml-2 text-xs text-text2">{items.length} producto{items.length !== 1 ? 's' : ''}</span>
              </div>
              {total > 0 && (
                <span className="text-xs text-yellow-400 font-semibold">~${total.toFixed(2)}</span>
              )}
            </div>

            {/* Items */}
            {items.map(item => (
              <div key={item._row} className="flex items-center px-4 py-3 border-b border-surface3/50 last:border-0 gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-text1">{item.producto}</div>
                  <div className="text-xs text-text2">
                    📅 {item.fecha} · 👤 {item.responsable}
                    {item.precioRef > 0 && ` · $${item.precioRef.toFixed(2)}/u`}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-accent">{item.cantidad} {item.unidad}</div>
                  <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-semibold ${ESTADO_COLOR[item.estado]}`}>
                    {item.estado}
                  </span>
                </div>
              </div>
            ))}

            {/* Receive button — only if there are pending items */}
            {pendientes.length > 0 && (
              <div className="px-4 py-3 border-t border-surface3">
                <button
                  onClick={() => handleReceive(prov)}
                  disabled={isReceiving}
                  className="w-full py-2.5 bg-green/20 text-green border border-green/30 rounded-xl font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity"
                >
                  {isReceiving
                    ? 'Registrando entradas…'
                    : `✅ Recibir pedido (${pendientes.length} producto${pendientes.length !== 1 ? 's' : ''})`
                  }
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
