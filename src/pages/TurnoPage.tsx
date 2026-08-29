/**
 * TurnoPage — Shift control for Barra.
 *
 * Phases:
 *  1. IDLE       — No open shift. Show "Iniciar turno" button.
 *  2. INICIAL    — Count opening stock for each ProductoConteo.
 *  3. ACTIVO     — Record sales manually during the shift.
 *  4. CIERRE     — Count closing stock, see differences, justify losses.
 *  5. RESUMEN    — Closed shift summary.
 */
import { useState, useMemo } from 'react'
import { useProductosConteo, useTurnos, useConteoItems, useInvalidate } from '../hooks/useSheets'
import {
  appendTurno, updateTurno,
  appendConteoItem, updateConteoItem,
  appendMerma, appendBitacora,
  appendProductoConteo, updateProductoConteo,
} from '../api/appscript'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../hooks/useToast'
import { today, nowDateTime } from '../utils/dates'
import { nextId } from '../utils/ids'
import type { TipoTurno, ConteoItem, ProductoConteo } from '../api/types'

const TURNOS: TipoTurno[] = ['mañana', 'tarde', 'noche']
const TURNO_ICON: Record<TipoTurno, string> = { mañana: '🌅', tarde: '☀️', noche: '🌙' }

// Active turno persisted in localStorage so it survives navigation
const LS_KEY = 'mz_turno_activo'
function loadActiveTurno(): { id: string; turnoRow: number; turno: TipoTurno } | null {
  try { const s = localStorage.getItem(LS_KEY); return s ? JSON.parse(s) : null } catch { return null }
}
function saveActiveTurno(v: { id: string; turnoRow: number; turno: TipoTurno } | null) {
  try {
    if (v) localStorage.setItem(LS_KEY, JSON.stringify(v))
    else localStorage.removeItem(LS_KEY)
  } catch {}
}

type Phase = 'idle' | 'inicial' | 'activo' | 'cierre' | 'resumen'

export default function TurnoPage() {
  const { data: productos = [], isLoading: loadingProd } = useProductosConteo()
  const { data: turnos    = [] }                         = useTurnos()
  const { user, canManage }   = useAuth()
  const toast                 = useToast()
  const invalidate            = useInvalidate()

  const [activeTurno, setActiveTurnoState] = useState(loadActiveTurno)
  const { data: items = [] } = useConteoItems(activeTurno?.id)

  const [phase,       setPhase]       = useState<Phase>(activeTurno ? 'activo' : 'idle')
  const [selTurno,    setSelTurno]    = useState<TipoTurno>('mañana')
  const [saving,      setSaving]      = useState(false)

  // Conteo inicial: qty per producto
  const [inicialQty,  setInicialQty]  = useState<Record<string, number>>({})
  // Ventas: list of {producto, cantidad}
  const [ventas,      setVentas]      = useState<{ producto: string; unidad: string; cantidad: number }[]>([])
  const [ventaProd,   setVentaProd]   = useState('')
  const [ventaQty,    setVentaQty]    = useState(1)
  // Conteo final
  const [finalQty,    setFinalQty]    = useState<Record<string, number>>({})
  // Justificaciones por producto
  const [justif,      setJustif]      = useState<Record<string, string>>({})

  // Config panel state
  const [showConfig,  setShowConfig]  = useState(false)
  const [newProd,     setNewProd]     = useState('')
  const [newUnit,     setNewUnit]     = useState('pieza')

  function setActiveTurno(v: typeof activeTurno) {
    setActiveTurnoState(v)
    saveActiveTurno(v)
  }

  // ── Iniciar turno ──────────────────────────────────────────────────────────

  async function handleIniciar() {
    if (!user || productos.length === 0) {
      toast('Agrega productos a contar primero', 'error'); return
    }
    setSaving(true)
    const n  = nowDateTime()
    const id = nextId('TN', turnos)
    try {
      await appendTurno([id, n.date, selTurno, user.nombre, n.time, '', 'abierto', ''])
      setActiveTurno({ id, turnoRow: (turnos.length + 2), turno: selTurno })
      // Reload turnos to get correct row
      await invalidate.turnos()
      setPhase('inicial')
      toast(`${TURNO_ICON[selTurno]} Turno ${selTurno} iniciado`)
    } catch (e: unknown) {
      toast(`Error: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
    } finally { setSaving(false) }
  }

  // ── Guardar conteo inicial ─────────────────────────────────────────────────

  async function handleGuardarInicial() {
    if (!activeTurno || !user) return
    const n = nowDateTime()
    setSaving(true)
    try {
      for (const p of productos) {
        const qty = inicialQty[p.nombre] ?? 0
        const cid = nextId('CI', items)
        await appendConteoItem([cid, activeTurno.id, 'inicial', p.nombre, p.unidad, qty, n.time, ''])
      }
      await invalidate.conteoItems()
      setPhase('activo')
      toast('Conteo inicial guardado ✅')
    } catch { toast('Error guardando conteo', 'error') }
    finally { setSaving(false) }
  }

  // ── Agregar venta ──────────────────────────────────────────────────────────

  function handleAddVenta() {
    if (!ventaProd) { toast('Selecciona un producto', 'error'); return }
    const prod = productos.find(p => p.nombre === ventaProd)
    setVentas(prev => [...prev, { producto: ventaProd, unidad: prod?.unidad ?? '', cantidad: ventaQty }])
    setVentaQty(1)
  }

  function removeVenta(i: number) { setVentas(prev => prev.filter((_, idx) => idx !== i)) }

  // ── Ir a cierre ───────────────────────────────────────────────────────────

  async function handleIrCierre() {
    if (!activeTurno || !user) return
    // Save ventas to ConteoItems
    setSaving(true)
    const n = nowDateTime()
    try {
      for (const v of ventas) {
        const cid = nextId('CI', items)
        await appendConteoItem([cid, activeTurno.id, 'venta', v.producto, v.unidad, v.cantidad, n.time, ''])
      }
      await invalidate.conteoItems()
      setPhase('cierre')
    } catch { toast('Error guardando ventas', 'error') }
    finally { setSaving(false) }
  }

  // ── Calcular diferencias ───────────────────────────────────────────────────

  const diferencias = useMemo(() => {
    return productos.map(p => {
      const inicial  = items.filter(i => i.fase === 'inicial' && i.producto === p.nombre)
                            .reduce((s, i) => s + i.cantidad, 0)
      const vendido  = [
        ...items.filter(i => i.fase === 'venta' && i.producto === p.nombre),
        ...ventas.filter(v => v.producto === p.nombre),
      ].reduce((s, i) => s + i.cantidad, 0)
      const esperado = Math.max(0, inicial - vendido)
      const final    = finalQty[p.nombre] ?? 0
      const diff     = final - esperado   // positive = sobrante, negative = faltante
      return { producto: p.nombre, unidad: p.unidad, inicial, vendido, esperado, final, diff }
    })
  }, [productos, items, ventas, finalQty])

  // ── Cerrar turno ───────────────────────────────────────────────────────────

  async function handleCerrar() {
    if (!activeTurno || !user) return
    const faltantes = diferencias.filter(d => d.diff < 0)
    // Validate justifications for losses
    for (const f of faltantes) {
      if (!justif[f.producto]?.trim()) {
        toast(`Justifica la pérdida de: ${f.producto}`, 'error'); return
      }
    }
    setSaving(true)
    const n = nowDateTime()
    try {
      // 1. Save conteo final
      for (const p of productos) {
        const cid = nextId('CI', [])
        const jus = justif[p.nombre] ?? ''
        await appendConteoItem([cid, activeTurno.id, 'final', p.nombre, p.unidad, finalQty[p.nombre] ?? 0, n.time, jus])
      }
      // 2. Generate mermas for unjustified losses
      for (const d of diferencias) {
        if (d.diff < 0) {
          const mermaId = nextId('MR', [])
          const motivo = justif[d.producto] ?? 'Pérdida en turno'
          await appendMerma([mermaId, n.date, n.time, '', d.producto, Math.abs(d.diff), motivo, user.nombre, `Turno ${activeTurno.turno} ${n.date}`])
        }
      }
      // 3. Close turno row — reload turnos to get correct _row
      const turnoActivo = turnos.find(t => t.id === activeTurno.id)
      if (turnoActivo) {
        await updateTurno(turnoActivo._row, [
          turnoActivo.id, turnoActivo.fecha, turnoActivo.turno,
          turnoActivo.responsable, turnoActivo.horaInicio, n.time, 'cerrado', ''
        ])
      }
      // 4. Bitácora
      await appendBitacora([n.date, n.time, user.nombre, 'Cierre de turno',
        `Turno ${activeTurno.turno} cerrado. Faltantes: ${faltantes.length}`, 'merma']).catch(() => {})

      await Promise.all([invalidate.turnos(), invalidate.conteoItems(), invalidate.mermas()])
      setActiveTurno(null)
      setPhase('resumen')
      toast('Turno cerrado ✅')
    } catch (e: unknown) {
      toast(`Error: ${e instanceof Error ? e.message : ''}`, 'error')
    } finally { setSaving(false) }
  }

  // ── Agregar producto a contar ──────────────────────────────────────────────

  async function handleAddProducto() {
    if (!newProd.trim()) return
    setSaving(true)
    try {
      const id = nextId('PC', productos as unknown as { id: string }[])
      await appendProductoConteo([id, newProd.trim(), newUnit.trim() || 'pieza', 'SI'])
      await invalidate.productosConteo()
      setNewProd(''); setNewUnit('pieza')
      toast('Producto agregado')
    } catch { toast('Error', 'error') }
    finally { setSaving(false) }
  }

  async function handleToggleProducto(p: ProductoConteo) {
    const nuevoActivo = p.activo === 'SI' ? 'NO' : 'SI'
    await updateProductoConteo(p._row, [p.id, p.nombre, p.unidad, nuevoActivo])
    await invalidate.productosConteo()
  }

  // ── UI helpers ─────────────────────────────────────────────────────────────

  if (loadingProd) return <div className="flex items-center justify-center py-16 text-text2 text-sm">⏳ Cargando…</div>

  return (
    <div className="px-4 py-4 pb-24">

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-bold">🍸 Control de Turno</h1>
        {canManage && phase === 'activo' && (
          <button onClick={() => setShowConfig(v => !v)} className="text-xs bg-surface2 text-text2 border border-surface3 px-3 py-1.5 rounded-lg font-semibold">
            ⚙️ Productos
          </button>
        )}
      </div>

      {/* ── IDLE ─────────────────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <div className="space-y-4">
          {productos.length === 0 && (
            <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-3 text-sm text-yellow-400">
              ⚠️ No hay productos configurados para contar. Pide al encargado que los agregue.
            </div>
          )}
          <div className="bg-surface rounded-card border border-white/[0.04] p-4">
            <p className="text-sm text-text2 mb-3 font-semibold">Selecciona el turno:</p>
            <div className="flex gap-2 mb-4">
              {TURNOS.map(t => (
                <button key={t} onClick={() => setSelTurno(t)}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm border transition-colors ${selTurno === t ? 'bg-accent text-white border-accent' : 'bg-surface2 text-text2 border-surface3'}`}>
                  {TURNO_ICON[t]}<br /><span className="text-xs capitalize">{t}</span>
                </button>
              ))}
            </div>
            <button onClick={handleIniciar} disabled={saving || productos.length === 0}
              className="w-full py-3.5 bg-accent text-white rounded-xl font-bold text-sm disabled:opacity-40">
              {saving ? 'Iniciando…' : `▶️ Iniciar turno ${selTurno}`}
            </button>
          </div>

          {/* Config productos (always visible when idle + canManage) */}
          {canManage && <ConfigPanel productos={productos} newProd={newProd} newUnit={newUnit}
            setNewProd={setNewProd} setNewUnit={setNewUnit}
            onAdd={handleAddProducto} onToggle={handleToggleProducto} saving={saving} />}

          {/* Recent turnos */}
          {turnos.slice(0, 5).length > 0 && (
            <div className="bg-surface rounded-card border border-white/[0.04] overflow-hidden">
              <div className="px-4 py-3 border-b border-surface3 text-xs font-bold text-text2">ÚLTIMOS TURNOS</div>
              {turnos.slice(0, 5).map(t => (
                <div key={t.id} className="flex items-center justify-between px-4 py-2.5 border-b border-surface3/50 last:border-0">
                  <div>
                    <span className="text-sm font-semibold">{TURNO_ICON[t.turno]} {t.turno}</span>
                    <span className="text-xs text-text2 ml-2">{t.fecha} · {t.responsable}</span>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${t.estado === 'abierto' ? 'bg-green/20 text-green border-green/30' : 'bg-surface2 text-text2 border-surface3'}`}>
                    {t.estado}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CONTEO INICIAL ───────────────────────────────────────────────── */}
      {phase === 'inicial' && (
        <div>
          <div className="bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 mb-4 text-sm text-accent font-semibold">
            {TURNO_ICON[activeTurno!.turno]} Turno {activeTurno!.turno} — Conteo inicial de apertura
          </div>
          <div className="space-y-2 mb-4">
            {productos.map(p => (
              <div key={p.id} className="bg-surface rounded-card border border-white/[0.04] px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-text1">{p.nombre}</div>
                  <div className="text-xs text-text2">{p.unidad}</div>
                </div>
                <QtyInput value={inicialQty[p.nombre] ?? 0} onChange={n => setInicialQty(prev => ({ ...prev, [p.nombre]: n }))} min={0} />
              </div>
            ))}
          </div>
          <button onClick={handleGuardarInicial} disabled={saving}
            className="w-full py-3.5 bg-accent text-white rounded-xl font-bold text-sm disabled:opacity-40">
            {saving ? 'Guardando…' : '✅ Guardar conteo inicial'}
          </button>
        </div>
      )}

      {/* ── TURNO ACTIVO (ventas) ────────────────────────────────────────── */}
      {phase === 'activo' && (
        <div>
          <div className="bg-green/10 border border-green/30 rounded-xl px-4 py-3 mb-4 flex justify-between items-center">
            <span className="text-sm text-green font-semibold">{TURNO_ICON[activeTurno!.turno]} Turno {activeTurno!.turno} activo</span>
            <span className="text-xs text-text2">{ventas.length + items.filter(i => i.fase === 'venta').length} ventas</span>
          </div>

          {/* Config panel */}
          {showConfig && canManage && (
            <div className="mb-4">
              <ConfigPanel productos={productos} newProd={newProd} newUnit={newUnit}
                setNewProd={setNewProd} setNewUnit={setNewUnit}
                onAdd={handleAddProducto} onToggle={handleToggleProducto} saving={saving} />
            </div>
          )}

          {/* Add venta */}
          <div className="bg-surface rounded-card border border-white/[0.04] p-4 mb-4">
            <p className="text-xs font-bold text-text2 mb-2">➕ REGISTRAR VENTA</p>
            <select value={ventaProd} onChange={e => setVentaProd(e.target.value)}
              className="w-full bg-surface2 border border-surface3 rounded-xl px-3 py-2.5 text-sm text-text1 outline-none focus:border-accent mb-2">
              <option value="">— Selecciona producto —</option>
              {productos.map(p => <option key={p.id} value={p.nombre}>{p.nombre}</option>)}
            </select>
            <div className="flex gap-2">
              <QtyInput value={ventaQty} onChange={setVentaQty} min={1} />
              <button onClick={handleAddVenta}
                className="flex-1 py-2 bg-accent/20 text-accent border border-accent/30 rounded-xl text-sm font-semibold">
                + Agregar
              </button>
            </div>
          </div>

          {/* Lista de ventas */}
          {ventas.length > 0 && (
            <div className="bg-surface rounded-card border border-white/[0.04] mb-4 overflow-hidden">
              <div className="px-4 py-2 border-b border-surface3 text-xs font-bold text-text2">VENTAS REGISTRADAS</div>
              {ventas.map((v, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-2.5 border-b border-surface3/50 last:border-0">
                  <span className="text-sm text-text1">{v.producto}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-accent">{v.cantidad} {v.unidad}</span>
                    <button onClick={() => removeVenta(i)} className="text-red/60 text-sm">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button onClick={handleIrCierre} disabled={saving}
            className="w-full py-3.5 bg-yellow-400/20 text-yellow-400 border border-yellow-400/30 rounded-xl font-bold text-sm disabled:opacity-40">
            {saving ? 'Guardando…' : '🔒 Ir a cierre de turno'}
          </button>
        </div>
      )}

      {/* ── CIERRE ───────────────────────────────────────────────────────── */}
      {phase === 'cierre' && (
        <div>
          <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-3 mb-4 text-sm text-yellow-400 font-semibold">
            🔒 Cierre de turno — Cuenta el stock final
          </div>

          <div className="space-y-2 mb-4">
            {productos.map(p => {
              const d = diferencias.find(d => d.producto === p.nombre)
              return (
                <div key={p.id} className="bg-surface rounded-card border border-white/[0.04] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold text-text1">{p.nombre}</div>
                      <div className="text-xs text-text2">
                        Inicial: {d?.inicial ?? 0} · Vendido: {d?.vendido ?? 0} · Esperado: {d?.esperado ?? 0}
                      </div>
                    </div>
                    <QtyInput value={finalQty[p.nombre] ?? 0} onChange={n => setFinalQty(prev => ({ ...prev, [p.nombre]: n }))} min={0} />
                  </div>
                  {d && d.diff !== 0 && (
                    <div className={`text-xs font-semibold px-2 py-1 rounded-lg mb-2 ${d.diff < 0 ? 'bg-red/10 text-red' : 'bg-green/10 text-green'}`}>
                      {d.diff < 0 ? `⚠️ Faltante: ${Math.abs(d.diff)} ${p.unidad}` : `✅ Sobrante: ${d.diff} ${p.unidad}`}
                    </div>
                  )}
                  {d && d.diff < 0 && (
                    <input
                      value={justif[p.nombre] ?? ''}
                      onChange={e => setJustif(prev => ({ ...prev, [p.nombre]: e.target.value }))}
                      placeholder="Justificación obligatoria (ej: se rompió, derramó…)"
                      className="w-full bg-surface2 border border-red/30 rounded-xl px-3 py-2 text-xs text-text1 placeholder-text2 outline-none focus:border-red"
                    />
                  )}
                </div>
              )
            })}
          </div>

          <button onClick={handleCerrar} disabled={saving}
            className="w-full py-3.5 bg-red/20 text-red border border-red/30 rounded-xl font-bold text-sm disabled:opacity-40">
            {saving ? 'Cerrando…' : '🔒 Cerrar turno y registrar mermas'}
          </button>
        </div>
      )}

      {/* ── RESUMEN ───────────────────────────────────────────────────────── */}
      {phase === 'resumen' && (
        <div className="text-center py-10">
          <div className="text-5xl mb-4">✅</div>
          <div className="text-base font-bold text-text1 mb-2">Turno cerrado correctamente</div>
          <div className="text-sm text-text2 mb-6">Las mermas quedaron registradas en el sistema</div>
          <button onClick={() => { setPhase('idle'); setVentas([]); setInicialQty({}); setFinalQty({}); setJustif({}) }}
            className="px-6 py-3 bg-accent text-white rounded-xl font-semibold text-sm">
            ▶️ Iniciar nuevo turno
          </button>
        </div>
      )}
    </div>
  )
}

// ── Qty input ──────────────────────────────────────────────────────────────────

function QtyInput({ value, onChange, min = 0 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-lg bg-surface2 text-text1 font-bold flex items-center justify-center active:bg-surface3">−</button>
      <input type="number" inputMode="numeric" min={min} value={value === 0 ? '' : value}
        onChange={e => { const n = parseInt(e.target.value); onChange(isNaN(n) ? min : Math.max(min, n)) }}
        onFocus={e => e.target.select()}
        className="w-14 h-8 text-center text-sm font-bold text-text1 bg-surface2 border border-surface3 rounded-lg outline-none focus:border-accent tabular-nums" />
      <button onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-lg bg-surface2 text-text1 font-bold flex items-center justify-center active:bg-surface3">+</button>
    </div>
  )
}

// ── Config panel ───────────────────────────────────────────────────────────────

function ConfigPanel({ productos, newProd, newUnit, setNewProd, setNewUnit, onAdd, onToggle, saving }: {
  productos: ProductoConteo[]
  newProd: string; newUnit: string
  setNewProd: (s: string) => void; setNewUnit: (s: string) => void
  onAdd: () => void; onToggle: (p: ProductoConteo) => void; saving: boolean
}) {
  return (
    <div className="bg-surface rounded-card border border-white/[0.04] p-4">
      <p className="text-xs font-bold text-text2 mb-3">⚙️ PRODUCTOS A CONTAR</p>
      <div className="flex gap-2 mb-3">
        <input value={newProd} onChange={e => setNewProd(e.target.value)} placeholder="Nombre del producto"
          className="flex-1 bg-surface2 border border-surface3 rounded-xl px-3 py-2 text-sm text-text1 placeholder-text2 outline-none focus:border-accent" />
        <input value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="und."
          className="w-20 bg-surface2 border border-surface3 rounded-xl px-3 py-2 text-sm text-text1 placeholder-text2 outline-none focus:border-accent" />
        <button onClick={onAdd} disabled={saving || !newProd.trim()}
          className="px-3 py-2 bg-accent text-white rounded-xl text-sm font-semibold disabled:opacity-40">+</button>
      </div>
      <div className="space-y-1">
        {productos.map(p => (
          <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-surface3/50 last:border-0">
            <span className={`text-sm ${p.activo === 'NO' ? 'line-through text-text2' : 'text-text1'}`}>{p.nombre} <span className="text-xs text-text2">({p.unidad})</span></span>
            <button onClick={() => onToggle(p)}
              className={`text-xs px-2 py-1 rounded-lg font-semibold ${p.activo === 'SI' ? 'bg-red/10 text-red' : 'bg-green/10 text-green'}`}>
              {p.activo === 'SI' ? 'Quitar' : 'Activar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
