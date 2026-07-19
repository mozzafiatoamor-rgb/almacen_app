/**
 * ReportePanel — bottom sheet for composing and sending WhatsApp reports.
 * Employee chooses which sections to include, selects specific items for
 * stock-bajo / pedido, adds an optional note, then opens WhatsApp.
 */
import { useState, useMemo } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useMovimientos, useMermas, useStockBajo } from '../../hooks/useSheets'
import { today } from '../../utils/dates'
import type { StockBajo } from '../../api/types'

const JEFE_WA = '529832079693'

const PRIORIDAD_COLOR: Record<number, string> = {
  5: 'text-red bg-red/10 border-red/20',
  4: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  3: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  2: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  1: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
}

interface Props {
  open:    boolean
  onClose: () => void
}

export default function ReportePanel({ open, onClose }: Props) {
  const { user }                   = useAuth()
  const { data: movimientos = [] } = useMovimientos()
  const { data: mermas      = [] } = useMermas()
  const stockBajo                  = useStockBajo()
  const todayStr                   = today()
  const nombre                     = user?.nombre ?? 'Empleado'

  // ── Section toggles — all off by default so user chooses intentionally ───
  const [inclEntradas, setInclEntradas] = useState(false)
  const [inclSalidas,  setInclSalidas]  = useState(false)
  const [inclMermas,   setInclMermas]   = useState(false)
  const [inclStock,    setInclStock]    = useState(false)
  const [inclPedido,   setInclPedido]   = useState(false)

  // ── Item selection for Stock Bajo / Pedido (shared list) ──────────────────
  const [selectedStock, setSelectedStock] = useState<Set<string>>(new Set())
  const [nota,          setNota]          = useState('')

  // ── Today's data filtered by this employee ────────────────────────────────
  const entHoy = useMemo(() =>
    movimientos.filter(m => m.fecha === todayStr && m.tipo === 'Entrada' && m.responsable === nombre),
    [movimientos, todayStr, nombre])

  const salHoy = useMemo(() =>
    movimientos.filter(m => m.fecha === todayStr && m.tipo === 'Salida' && m.responsable === nombre),
    [movimientos, todayStr, nombre])

  const merHoy = useMemo(() =>
    mermas.filter(m => m.fecha === todayStr && m.responsable === nombre),
    [mermas, todayStr, nombre])

  const showStockList = inclStock || inclPedido

  function toggleItem(prod: string) {
    setSelectedStock(prev => {
      const next = new Set(prev)
      next.has(prod) ? next.delete(prod) : next.add(prod)
      return next
    })
  }

  function selectAll()   { setSelectedStock(new Set(stockBajo.map(i => i.producto))) }
  function deselectAll() { setSelectedStock(new Set()) }

  // ── Message builder ───────────────────────────────────────────────────────
  function buildMessage(): string {
    const fecha = new Date().toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
    const lines: string[] = [
      `📊 Reporte — Mozzafiato`,
      `👤 ${nombre}`,
      `📅 ${fecha}`,
    ]

    if (inclEntradas) {
      lines.push(`\n📥 Entradas (${entHoy.length}):`)
      entHoy.length
        ? entHoy.forEach(m => lines.push(`  • ${m.producto} ×${m.cantidad}${m.motivo ? ` (${m.motivo})` : ''}`))
        : lines.push(`  Sin entradas hoy`)
    }

    if (inclSalidas) {
      lines.push(`\n📤 Salidas (${salHoy.length}):`)
      salHoy.length
        ? salHoy.forEach(m => lines.push(`  • ${m.producto} ×${m.cantidad}${m.areaDestino ? ` → ${m.areaDestino}` : ''}`))
        : lines.push(`  Sin salidas hoy`)
    }

    if (inclMermas) {
      lines.push(`\n⚠️ Mermas (${merHoy.length}):`)
      merHoy.length
        ? merHoy.forEach(m => lines.push(`  • ${m.producto} ×${m.cantidad}${m.motivo ? ` (${m.motivo})` : ''}`))
        : lines.push(`  Sin mermas hoy`)
    }

    const selected = stockBajo.filter(i => selectedStock.has(i.producto))

    if (inclStock && selected.length > 0) {
      lines.push(`\n🚨 Stock Bajo:`)
      selected.forEach(i =>
        lines.push(`  • ${i.producto} (P${i.prioridad}) — Stock: ${i.stockActual}/${i.stockMinimo}, Faltan: ${i.faltante} ${i.unidad}`)
      )
    }

    if (inclPedido && selected.length > 0) {
      // Group by proveedor
      const byProv: Record<string, StockBajo[]> = {}
      selected.forEach(i => {
        if (!byProv[i.proveedor]) byProv[i.proveedor] = []
        byProv[i.proveedor].push(i)
      })
      lines.push(`\n🛒 Pedido:`)
      Object.entries(byProv).forEach(([prov, items]) => {
        lines.push(`  🏪 ${prov}:`)
        items.forEach(i => {
          const est = i.precioRef > 0 ? ` (~$${(i.faltante * i.precioRef).toFixed(0)})` : ''
          lines.push(`    • ${i.producto} ×${i.faltante} ${i.unidad}${est}`)
        })
      })
    }

    if (nota.trim()) lines.push(`\n📝 Nota: ${nota.trim()}`)

    return lines.join('\n')
  }

  function handleEnviar() {
    window.open(`https://wa.me/${JEFE_WA}?text=${encodeURIComponent(buildMessage())}`, '_blank')
    onClose()
  }

  const anySectionOn = inclEntradas || inclSalidas || inclMermas
  const stockSectionOn = (inclStock || inclPedido) && selectedStock.size > 0
  const canSend = anySectionOn || stockSectionOn

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#162030] rounded-t-2xl max-h-[88vh] flex flex-col">

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        <div className="px-4 pb-3 flex justify-between items-center">
          <h2 className="font-bold text-sm">📊 Armar Reporte</h2>
          <button onClick={onClose} className="text-text2 text-lg leading-none">✕</button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-4 space-y-2 pb-3">

          {/* Section toggles */}
          <Toggle icon="📥" label={`Entradas del día (${entHoy.length})`}
            active={inclEntradas} onToggle={() => setInclEntradas(v => !v)} />
          <Toggle icon="📤" label={`Salidas del día (${salHoy.length})`}
            active={inclSalidas}  onToggle={() => setInclSalidas(v => !v)} />
          <Toggle icon="⚠️" label={`Mermas del día (${merHoy.length})`}
            active={inclMermas}   onToggle={() => setInclMermas(v => !v)} />
          <Toggle icon="🚨" label={`Stock bajo (${stockBajo.length} productos)`}
            active={inclStock}    onToggle={() => setInclStock(v => !v)} />
          <Toggle icon="🛒" label="Hacer pedido"
            active={inclPedido}   onToggle={() => setInclPedido(v => !v)} />

          {/* Stock item checklist — shown when Stock o Pedido activo */}
          {showStockList && (
            <div className="mt-1">
              {stockBajo.length === 0 ? (
                <div className="bg-green/10 border border-green/20 rounded-xl px-3 py-2.5 text-xs text-green font-semibold">
                  ✅ No hay productos en stock bajo
                </div>
              ) : (
                <>
                  {/* Select all / none */}
                  <div className="flex gap-2 mb-2">
                    <button onClick={selectAll}
                      className="text-xs text-accent font-semibold">
                      Seleccionar todo
                    </button>
                    <span className="text-text2">·</span>
                    <button onClick={deselectAll}
                      className="text-xs text-text2 font-semibold">
                      Ninguno
                    </button>
                    <span className="ml-auto text-xs text-text2">
                      {selectedStock.size}/{stockBajo.length} seleccionados
                    </span>
                  </div>

                  <div className="border border-surface3 rounded-xl overflow-hidden">
                    {stockBajo.map(item => {
                      const checked = selectedStock.has(item.producto)
                      return (
                        <button
                          key={item.producto}
                          onClick={() => toggleItem(item.producto)}
                          className={`w-full flex items-center gap-3 px-3 py-3 border-b border-surface3/50 last:border-0 text-left transition-opacity ${checked ? 'opacity-100' : 'opacity-45'}`}
                        >
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-accent border-accent' : 'border-white/20'}`}>
                            {checked && <span className="text-white text-xs font-bold">✓</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-semibold text-text1">{item.producto}</span>
                              <span className={`text-[10px] border px-1 py-0.5 rounded-full font-bold ${PRIORIDAD_COLOR[item.prioridad]}`}>
                                P{item.prioridad}
                              </span>
                            </div>
                            <div className="text-xs text-text2 truncate">
                              {item.proveedor} · Faltan: {item.faltante} {item.unidad}
                              {item.precioRef > 0 && ` · ~$${(item.faltante * item.precioRef).toFixed(0)}`}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="font-mono text-red font-bold text-sm">{item.stockActual}</div>
                            <div className="text-[10px] text-text2">/{item.stockMinimo}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Note */}
          <textarea
            value={nota}
            onChange={e => setNota(e.target.value)}
            placeholder="Nota adicional (opcional)…"
            rows={2}
            className="w-full bg-surface2 border border-surface3 rounded-xl px-3 py-2 text-sm text-text1 placeholder-text2 resize-none focus:outline-none focus:border-accent"
          />
        </div>

        {/* Send button */}
        <div className="px-4 pt-3 pb-6 border-t border-surface3">
          <button
            onClick={handleEnviar}
            disabled={!canSend}
            className="w-full py-3 bg-accent text-white rounded-xl font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity"
          >
            📱 Abrir WhatsApp
          </button>
        </div>
      </div>
    </>
  )
}

// ── Toggle row ────────────────────────────────────────────────────────────────

function Toggle({ icon, label, active, onToggle }: {
  icon: string; label: string; active: boolean; onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
        active ? 'border-accent/40 bg-accent/10' : 'border-surface3 bg-surface2'
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className={`flex-1 text-sm font-medium text-left ${active ? 'text-text1' : 'text-text2'}`}>
        {label}
      </span>
      {/* iOS-style toggle */}
      <div className={`w-9 h-5 rounded-full transition-colors flex-shrink-0 relative ${active ? 'bg-accent' : 'bg-surface3'}`}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}
