/**
 * TurnoPage — Shift control for Barra.
 *
 * Products to count come directly from Catálogo (area Barra + Ambas).
 * The encargado selects which products to include — stored in localStorage.
 *
 * Phases:
 *  1. IDLE    — No open shift. Show "Iniciar turno" button.
 *  2. INICIAL — Count opening stock.
 *  3. ACTIVO  — Record sales manually during the shift.
 *  4. CIERRE  — Count closing stock, see differences, justify losses.
 *  5. RESUMEN — Closed shift summary.
 */
import { useState, useMemo } from 'react'
import { useCatalogo, useTurnos, useConteoItems, useInvalidate } from '../hooks/useSheets'
import {
  appendTurno, updateTurno,
  appendConteoItem,
  appendMerma, appendBitacora,
} from '../api/appscript'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../hooks/useToast'
import { today, nowDateTime } from '../utils/dates'
import { nextId } from '../utils/ids'
import type { Producto, TipoTurno } from '../api/types'

const TURNOS: TipoTurno[] = ['mañana', 'tarde', 'noche']
const TURNO_ICON: Record<TipoTurno, string> = { mañana: '🌅', tarde: '☀️', noche: '🌙' }

// ── LocalStorage helpers ───────────────────────────────────────────────────────

const LS_TURNO       = 'mz_turno_activo'
const LS_SELECCION   = 'mz_conteo_seleccion'   // JSON array of product names
const LS_CONFIGURADO = 'mz_conteo_configurado'  // flag: user has explicitly configured

function loadActiveTurno(): { id: string; turnoRow: number; turno: TipoTurno } | null {
  try { const s = localStorage.getItem(LS_TURNO); return s ? JSON.parse(s) : null } catch { return null }
}
function saveActiveTurno(v: { id: string; turnoRow: number; turno: TipoTurno } | null) {
  try { v ? localStorage.setItem(LS_TURNO, JSON.stringify(v)) : localStorage.removeItem(LS_TURNO) } catch {}
}
// null = not configured (show all by default)
// Set  = explicit selection (can be empty = none)
function loadSeleccion(): Set<string> | null {
  try {
    if (!localStorage.getItem(LS_CONFIGURADO)) return null
    const s = localStorage.getItem(LS_SELECCION)
    return s ? new Set(JSON.parse(s)) : new Set()
  } catch { return null }
}
function saveSeleccion(sel: Set<string>) {
  try {
    localStorage.setItem(LS_CONFIGURADO, '1')
    localStorage.setItem(LS_SELECCION, JSON.stringify([...sel]))
  } catch {}
}

type Phase = 'idle' | 'inicial' | 'activo' | 'cierre' | 'resumen'

export default function TurnoPage() {
  const { data: catalogo = [], isLoading } = useCatalogo()
  const { data: turnos   = [] }            = useTurnos()
  const { user, canManage }  = useAuth()
  const toast                = useToast()
  const invalidate           = useInvalidate()

  // Products from Barra + Ambas in Catálogo
  const barraProductos = useMemo(
    () => catalogo.filter(p => (p.area === 'Barra' || p.area === 'Ambas') && p.activo !== 'NO'),
    [catalogo]
  )

  const [activeTurno, setActiveTurnoState] = useState(loadActiveTurno)
  const { data: items = [] } = useConteoItems(activeTurno?.id)

  // null = not configured (default all), Set = explicit selection
  const [seleccion, setSeleccionState] = useState<Set<string> | null>(loadSeleccion)

  // Effective list: null = all, empty Set = none, otherwise filtered
  const productosConteo = useMemo(() => {
    if (seleccion === null) return barraProductos
    if (seleccion.size === 0) return []
    return barraProductos.filter(p => seleccion.has(p.producto))
  }, [barraProductos, seleccion])

  function toggleSeleccion(nombre: string) {
    setSeleccionState(prev => {
      // If null (all by default), expand to explicit set of all, then toggle
      const base = prev === null
        ? new Set(barraProductos.map(p => p.producto))
        : new Set(prev)
      base.has(nombre) ? base.delete(nombre) : base.add(nombre)
      saveSeleccion(base)
      return base
    })
  }

  function selectAll() {
    const all = new Set(barraProductos.map(p => p.producto))
    setSeleccionState(all); saveSeleccion(all)
  }
  function selectNone() {
    const none = new Set<string>()
    setSeleccionState(none); saveSeleccion(none)
  }

  const [phase,      setPhase]      = useState<Phase>(activeTurno ? 'activo' : 'idle')
  const [selTurno,   setSelTurno]   = useState<TipoTurno>('mañana')
  const [saving,     setSaving]     = useState(false)
  const [showConfig,  setShowConfig]  = useState(false)
  const [catFiltro,   setCatFiltro]   = useState('Todas')

  // Conteo inicial qty
  const [inicialQty, setInicialQty] = useState<Record<string, number>>({})
  // Ventas registradas en este turno (local, se guardan al ir a cierre)
  const [ventas,     setVentas]     = useState<{ producto: string; unidad: string; cantidad: number }[]>([])
  const [ventaProd,  setVentaProd]  = useState('')
  const [ventaQty,   setVentaQty]   = useState(1)
  // Conteo final
  const [finalQty,   setFinalQty]   = useState<Record<string, number>>({})
  // Justificaciones
  const [justif,     setJustif]     = useState<Record<string, string>>({})

  function setActiveTurno(v: typeof activeTurno) {
    setActiveTurnoState(v); saveActiveTurno(v)
  }

  // ── Iniciar turno ──────────────────────────────────────────────────────────

  async function handleIniciar() {
    if (!user) return
    if (productosConteo.length === 0) {
      toast('No hay productos de Barra en el catálogo', 'error'); return
    }
    setSaving(true)
    const n  = nowDateTime()
    const id = nextId('TN', turnos)
    try {
      await appendTurno([id, n.date, selTurno, user.nombre, n.time, '', 'abierto', ''])
      setActiveTurno({ id, turnoRow: turnos.length + 2, turno: selTurno })
      await invalidate.turnos()
      setPhase('inicial')
      toast(`${TURNO_ICON[selTurno]} Turno ${selTurno} iniciado`)
    } catch (e: unknown) {
      toast(`Error: ${e instanceof Error ? e.message : ''}`, 'error')
    } finally { setSaving(false) }
  }

  // ── Guardar conteo inicial ─────────────────────────────────────────────────

  async function handleGuardarInicial() {
    if (!activeTurno || !user) return
    setSaving(true)
    const n = nowDateTime()
    try {
      for (const p of productosConteo) {
        const qty = inicialQty[p.producto] ?? 0
        const cid = nextId('CI', items)
        await appendConteoItem([cid, activeTurno.id, 'inicial', p.producto, p.unidad, qty, n.time, ''])
      }
      await invalidate.conteoItems()
      setPhase('activo')
      toast('Conteo inicial guardado ✅')
    } catch { toast('Error guardando conteo', 'error') }
    finally { setSaving(false) }
  }

  // ── Ventas ─────────────────────────────────────────────────────────────────

  function handleAddVenta() {
    if (!ventaProd) { toast('Selecciona un producto', 'error'); return }
    const prod = productosConteo.find(p => p.producto === ventaProd)
    setVentas(prev => [...prev, { producto: ventaProd, unidad: prod?.unidad ?? '', cantidad: ventaQty }])
    setVentaQty(1)
  }

  function removeVenta(i: number) { setVentas(prev => prev.filter((_, idx) => idx !== i)) }

  // ── Ir a cierre ───────────────────────────────────────────────────────────

  async function handleIrCierre() {
    if (!activeTurno || !user) return
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

  // ── Diferencias ───────────────────────────────────────────────────────────

  const diferencias = useMemo(() => {
    return productosConteo.map(p => {
      const inicial  = items.filter(i => i.fase === 'inicial' && i.producto === p.producto)
                            .reduce((s, i) => s + i.cantidad, 0)
      const vendido  = [
        ...items.filter(i => i.fase === 'venta' && i.producto === p.producto),
        ...ventas.filter(v => v.producto === p.producto),
      ].reduce((s, i) => s + i.cantidad, 0)
      const esperado = Math.max(0, inicial - vendido)
      const final    = finalQty[p.producto] ?? 0
      const diff     = final - esperado
      return { producto: p.producto, unidad: p.unidad, inicial, vendido, esperado, final, diff }
    })
  }, [productosConteo, items, ventas, finalQty])

  // ── Cerrar turno ──────────────────────────────────────────────────────────

  async function handleCerrar() {
    if (!activeTurno || !user) return
    const faltantes = diferencias.filter(d => d.diff < 0)
    for (const f of faltantes) {
      if (!justif[f.producto]?.trim()) {
        toast(`Justifica la pérdida de: ${f.producto}`, 'error'); return
      }
    }
    setSaving(true)
    const n = nowDateTime()
    try {
      // 1. Conteo final
      for (const p of productosConteo) {
        const cid = nextId('CI', [])
        await appendConteoItem([cid, activeTurno.id, 'final', p.producto, p.unidad, finalQty[p.producto] ?? 0, n.time, justif[p.producto] ?? ''])
      }
      // 2. Mermas por faltantes
      for (const d of faltantes) {
        const mid = nextId('MR', [])
        await appendMerma([mid, n.date, n.time, '', d.producto, Math.abs(d.diff), justif[d.producto] ?? 'Pérdida en turno', user.nombre, `Turno ${activeTurno.turno}`])
      }
      // 3. Cerrar turno en Sheets
      const turnoActivo = turnos.find(t => t.id === activeTurno.id)
      if (turnoActivo) {
        await updateTurno(turnoActivo._row, [turnoActivo.id, turnoActivo.fecha, turnoActivo.turno, turnoActivo.responsable, turnoActivo.horaInicio, n.time, 'cerrado', ''])
      }
      // 4. Bitácora
      await appendBitacora([n.date, n.time, user.nombre, 'Cierre de turno',
        `Turno ${activeTurno.turno}. Faltantes: ${faltantes.length}`, 'merma']).catch(() => {})

      await Promise.all([invalidate.turnos(), invalidate.conteoItems(), invalidate.mermas()])
      setActiveTurno(null)
      setPhase('resumen')
      toast('Turno cerrado ✅')
    } catch (e: unknown) {
      toast(`Error: ${e instanceof Error ? e.message : ''}`, 'error')
    } finally { setSaving(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) return <div className="flex items-center justify-center py-16 text-text2 text-sm">⏳ Cargando…</div>

  return (
    <div className="px-4 py-4 pb-24">

      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-bold">🍸 Control de Turno</h1>
        {canManage && (phase === 'idle' || phase === 'activo') && (
          <button onClick={() => setShowConfig(v => !v)}
            className={`text-xs px-3 py-1.5 rounded-lg font-semibold border transition-colors ${showConfig ? 'bg-accent text-white border-accent' : 'bg-surface2 text-text2 border-surface3'}`}>
            ⚙️ Selección
          </button>
        )}
      </div>

      {/* Config: select which barra products to count */}
      {showConfig && canManage && (() => {
        const cats = ['Todas', ...[...new Set(barraProductos.map(p => p.categoria))].sort()]
        const visibles = catFiltro === 'Todas' ? barraProductos : barraProductos.filter(p => p.categoria === catFiltro)
        const allVisChecked = visibles.every(p => seleccion === null || seleccion.has(p.producto))
        return (
          <div className="bg-surface rounded-card border border-white/[0.04] p-4 mb-4">
            <div className="flex justify-between items-center mb-3">
              <p className="text-xs font-bold text-text2">PRODUCTOS A CONTAR (Barra)</p>
              <div className="flex gap-2 items-center">
                <button onClick={selectAll}  className="text-xs text-accent font-semibold">Todos</button>
                <span className="text-text2 text-xs">·</span>
                <button onClick={selectNone} className="text-xs text-red font-semibold">Ninguno</button>
              </div>
            </div>

            {/* Category filter pills */}
            {cats.length > 2 && (
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2" style={{ scrollbarWidth: 'none' }}>
                {cats.map(cat => (
                  <button key={cat} onClick={() => setCatFiltro(cat)}
                    className={`flex-shrink-0 text-xs font-semibold px-3 py-1 rounded-full border transition-colors ${catFiltro === cat ? 'bg-accent text-white border-accent' : 'bg-surface2 text-text2 border-surface3'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Select/deselect visible */}
            {catFiltro !== 'Todas' && (
              <div className="flex gap-2 mb-2">
                <button onClick={() => {
                  setSeleccionState(prev => {
                    const base = prev === null ? new Set(barraProductos.map(p => p.producto)) : new Set(prev)
                    visibles.forEach(p => base.add(p.producto))
                    saveSeleccion(base); return base
                  })
                }} className="text-xs text-accent font-semibold">+ Todos ({catFiltro})</button>
                <span className="text-text2 text-xs">·</span>
                <button onClick={() => {
                  setSeleccionState(prev => {
                    const base = prev === null ? new Set(barraProductos.map(p => p.producto)) : new Set(prev)
                    visibles.forEach(p => base.delete(p.producto))
                    saveSeleccion(base); return base
                  })
                }} className="text-xs text-red font-semibold">− Quitar ({catFiltro})</button>
              </div>
            )}

            {barraProductos.length === 0 ? (
              <p className="text-xs text-text2">No hay productos con área Barra o Ambas en el catálogo.</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {visibles.map(p => {
                  const checked = seleccion === null || seleccion.has(p.producto)
                  return (
                    <button key={p.producto} onClick={() => toggleSeleccion(p.producto)}
                      className="w-full flex items-center gap-3 py-2 border-b border-surface3/50 last:border-0 text-left">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-accent border-accent' : 'border-white/20'}`}>
                        {checked && <span className="text-white text-xs font-bold">✓</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-text1 truncate">{p.producto}</div>
                        <div className="text-[10px] text-text2">{p.categoria}</div>
                      </div>
                      <span className="text-xs text-text2 flex-shrink-0">{p.unidad}</span>
                    </button>
                  )
                })}
              </div>
            )}
            <p className="text-[10px] text-text2 mt-3">
              {productosConteo.length} de {barraProductos.length} seleccionados · Se guarda automáticamente
            </p>
          </div>
        )
      })()}

      {/* ── IDLE ─────────────────────────────────────────────────────────── */}
      {phase === 'idle' && (
        <div className="space-y-4">
          {barraProductos.length === 0 && (
            <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-xl px-4 py-3 text-sm text-yellow-400">
              ⚠️ No hay productos de Barra en el catálogo. Asigna área "Barra" o "Ambas" a los productos desde Catálogo.
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
            <div className="text-xs text-text2 mb-3 text-center">
              Se contarán {productosConteo.length} productos · {barraProductos.length} disponibles de Barra
            </div>
            <button onClick={handleIniciar} disabled={saving || productosConteo.length === 0}
              className="w-full py-3.5 bg-accent text-white rounded-xl font-bold text-sm disabled:opacity-40">
              {saving ? 'Iniciando…' : `▶️ Iniciar turno ${selTurno}`}
            </button>
          </div>

          {/* Últimos turnos */}
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
            {TURNO_ICON[activeTurno!.turno]} Turno {activeTurno!.turno} — Conteo de apertura ({productosConteo.length} productos)
          </div>
          <div className="space-y-2 mb-4">
            {productosConteo.map(p => (
              <div key={p.producto} className="bg-surface rounded-card border border-white/[0.04] px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-text1 truncate">{p.producto}</div>
                  <div className="text-xs text-text2">{p.categoria} · {p.unidad}</div>
                </div>
                <QtyInput value={inicialQty[p.producto] ?? 0}
                  onChange={n => setInicialQty(prev => ({ ...prev, [p.producto]: n }))} min={0} />
              </div>
            ))}
          </div>
          <button onClick={handleGuardarInicial} disabled={saving}
            className="w-full py-3.5 bg-accent text-white rounded-xl font-bold text-sm disabled:opacity-40">
            {saving ? 'Guardando…' : '✅ Guardar conteo inicial'}
          </button>
        </div>
      )}

      {/* ── TURNO ACTIVO ─────────────────────────────────────────────────── */}
      {phase === 'activo' && (
        <div>
          <div className="bg-green/10 border border-green/30 rounded-xl px-4 py-3 mb-4 flex justify-between items-center">
            <span className="text-sm text-green font-semibold">{TURNO_ICON[activeTurno!.turno]} Turno {activeTurno!.turno} activo</span>
            <span className="text-xs text-text2">{ventas.length} ventas</span>
          </div>

          {/* Registrar venta */}
          <div className="bg-surface rounded-card border border-white/[0.04] p-4 mb-4">
            <p className="text-xs font-bold text-text2 mb-2">➕ REGISTRAR VENTA</p>
            <select value={ventaProd} onChange={e => setVentaProd(e.target.value)}
              className="w-full bg-surface2 border border-surface3 rounded-xl px-3 py-2.5 text-sm text-text1 outline-none focus:border-accent mb-2">
              <option value="">— Selecciona producto —</option>
              {productosConteo.map(p => <option key={p.producto} value={p.producto}>{p.producto}</option>)}
            </select>
            <div className="flex gap-2">
              <QtyInput value={ventaQty} onChange={setVentaQty} min={1} />
              <button onClick={handleAddVenta}
                className="flex-1 py-2 bg-accent/20 text-accent border border-accent/30 rounded-xl text-sm font-semibold">
                + Agregar
              </button>
            </div>
          </div>

          {/* Lista ventas */}
          {ventas.length > 0 && (
            <div className="bg-surface rounded-card border border-white/[0.04] mb-4 overflow-hidden">
              <div className="px-4 py-2 border-b border-surface3 text-xs font-bold text-text2">VENTAS DEL TURNO</div>
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
            {productosConteo.map(p => {
              const d = diferencias.find(d => d.producto === p.producto)
              return (
                <div key={p.producto} className="bg-surface rounded-card border border-white/[0.04] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="text-sm font-semibold text-text1 truncate">{p.producto}</div>
                      <div className="text-xs text-text2">
                        Inicial: <b>{d?.inicial ?? 0}</b> · Vendido: <b>{d?.vendido ?? 0}</b> · Esperado: <b>{d?.esperado ?? 0}</b>
                      </div>
                    </div>
                    <QtyInput value={finalQty[p.producto] ?? 0}
                      onChange={n => setFinalQty(prev => ({ ...prev, [p.producto]: n }))} min={0} />
                  </div>
                  {d && d.diff !== 0 && (
                    <div className={`text-xs font-semibold px-2 py-1 rounded-lg mb-2 ${d.diff < 0 ? 'bg-red/10 text-red' : 'bg-green/10 text-green'}`}>
                      {d.diff < 0 ? `⚠️ Faltante: ${Math.abs(d.diff)} ${p.unidad}` : `✅ Sobrante: +${d.diff} ${p.unidad}`}
                    </div>
                  )}
                  {d && d.diff < 0 && (
                    <input value={justif[p.producto] ?? ''}
                      onChange={e => setJustif(prev => ({ ...prev, [p.producto]: e.target.value }))}
                      placeholder="Justificación obligatoria (ej: se rompió, se derramó…)"
                      className="w-full bg-surface2 border border-red/30 rounded-xl px-3 py-2 text-xs text-text1 placeholder-text2 outline-none focus:border-red" />
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
    <div className="flex items-center gap-1 flex-shrink-0">
      <button onClick={() => onChange(Math.max(min, value - 1))}
        className="w-8 h-8 rounded-lg bg-surface2 text-text1 font-bold flex items-center justify-center active:bg-surface3 select-none">−</button>
      <input type="number" inputMode="numeric" min={min} value={value === 0 ? '' : value}
        onChange={e => { const n = parseInt(e.target.value); onChange(isNaN(n) ? min : Math.max(min, n)) }}
        onFocus={e => e.target.select()}
        className="w-14 h-8 text-center text-sm font-bold text-text1 bg-surface2 border border-surface3 rounded-lg outline-none focus:border-accent tabular-nums" />
      <button onClick={() => onChange(value + 1)}
        className="w-8 h-8 rounded-lg bg-surface2 text-text1 font-bold flex items-center justify-center active:bg-surface3 select-none">+</button>
    </div>
  )
}
