/**
 * InventarioFisicoPage — Levantamiento de inventario físico
 *
 * Fases: idle → conteo → revision → guardando → reporte
 *
 * Al cerrar genera:
 *  - 1 fila en 📋 Inventarios
 *  - N filas en 📊 InvItems  (una por producto contado)
 *  - Movimientos de ajuste (Entrada / Salida) para diferencias
 *  Todo en un solo POST (batchAppend).
 *
 * Reportes: texto para WhatsApp + HTML para imprimir/PDF + PNG de resumen.
 */

import { useState, useMemo, useCallback, useRef } from 'react'
import { useAuth }       from '../auth/AuthContext'
import { useCatalogo, useInventarios, useInvalidate, matchesAreaFiltro } from '../hooks/useSheets'
import { batchAppend }   from '../api/appscript'
import { appendBitacora } from '../api/appscript'
import { SHEET_NAMES }   from '../api/config'
import { nowDateTime }   from '../utils/dates'
import { useToast }      from '../hooks/useToast'
import SearchBar         from '../components/shared/SearchBar'
import FilterPills       from '../components/shared/FilterPills'
import EmptyState        from '../components/shared/EmptyState'
import type { Producto } from '../api/types'

// ─── localStorage keys ────────────────────────────────────────────────────────

const LS_INV_ACTIVO = 'mz_inv_activo'     // header del levantamiento en curso
const LS_INV_COUNTS = 'mz_inv_counts'     // { producto: stockFisico }

// ─── Types ────────────────────────────────────────────────────────────────────

type Fase = 'idle' | 'conteo' | 'revision' | 'guardando' | 'reporte'

interface InvHeader {
  id:           string
  area:         string
  horaInicio:   string
  fecha:        string
  responsable:  string
}

interface ReporteData {
  header:  InvHeader
  items:   { producto: string; categoria: string; unidad: string; area: string; sistema: number; fisico: number; diff: number }[]
  hora:    string
}

// ─── ID helper ────────────────────────────────────────────────────────────────

function newId() {
  return 'INV-' + Date.now().toString(36).toUpperCase()
}

function itemId() {
  return 'II-' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

function movId() {
  return 'M-' + Math.random().toString(36).slice(2, 8).toUpperCase()
}

// ─── Persistencia ─────────────────────────────────────────────────────────────

function loadHeader(): InvHeader | null {
  try { const s = localStorage.getItem(LS_INV_ACTIVO); return s ? JSON.parse(s) : null } catch { return null }
}

function saveHeader(h: InvHeader | null) {
  if (h) localStorage.setItem(LS_INV_ACTIVO, JSON.stringify(h))
  else   localStorage.removeItem(LS_INV_ACTIVO)
}

function loadCounts(): Record<string, number> {
  try { const s = localStorage.getItem(LS_INV_COUNTS); return s ? JSON.parse(s) : {} } catch { return {} }
}

function saveCounts(c: Record<string, number>) {
  try { localStorage.setItem(LS_INV_COUNTS, JSON.stringify(c)) } catch {}
}

// ─── Reporte HTML (abre en nueva pestaña para imprimir / PDF) ─────────────────

function abrirReporteHTML(data: ReporteData) {
  const logo = `${window.location.origin}${import.meta.env.BASE_URL}logo.png`

  const filas = data.items.map(it => {
    const diff  = it.fisico - it.sistema
    const color = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#64748b'
    const signo = diff > 0 ? '+' : ''
    return `<tr>
      <td>${it.categoria}</td>
      <td><strong>${it.producto}</strong></td>
      <td>${it.area}</td>
      <td>${it.unidad}</td>
      <td style="text-align:center">${it.sistema}</td>
      <td style="text-align:center">${it.fisico}</td>
      <td style="text-align:center;color:${color};font-weight:bold">${signo}${diff}</td>
    </tr>`
  }).join('')

  const conDiff  = data.items.filter(i => i.fisico !== i.sistema).length
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Levantamiento ${data.header.fecha}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1e293b; padding: 32px; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; border-bottom: 2px solid #1e3a5f; padding-bottom: 16px; }
  .logo { height: 48px; object-fit: contain; }
  .title { text-align: right; }
  .title h1 { font-size: 20px; color: #1e3a5f; }
  .title p  { font-size: 12px; color: #64748b; }
  .meta { display: flex; gap: 24px; margin-bottom: 20px; background: #f8fafc; padding: 12px 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
  .meta div { display: flex; flex-direction: column; gap: 2px; }
  .meta label { font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: .5px; }
  .meta span  { font-size: 13px; font-weight: 600; color: #1e293b; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  thead tr { background: #1e3a5f; color: #fff; }
  thead th { padding: 10px 8px; text-align: left; font-size: 12px; }
  tbody tr:nth-child(even) { background: #f8fafc; }
  tbody td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
  .summary { margin-top: 20px; display: flex; gap: 16px; }
  .stat { background: #f1f5f9; border-radius: 8px; padding: 12px 20px; flex: 1; text-align: center; }
  .stat .n { font-size: 24px; font-weight: 700; color: #1e3a5f; }
  .stat .l { font-size: 11px; color: #64748b; }
  .footer { margin-top: 32px; font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  .btn { display: inline-block; margin: 16px auto; padding: 10px 28px; background: #1e3a5f; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; }
  @media print { .btn { display: none; } body { padding: 16px; } }
</style>
</head>
<body>
<div class="header">
  <img class="logo" src="${logo}" alt="Mozzafiato" onerror="this.style.display='none'">
  <div class="title">
    <h1>Levantamiento de Inventario</h1>
    <p>Almacén Mozzafiato · ${data.header.fecha} ${data.hora}</p>
  </div>
</div>

<div class="meta">
  <div><label>ID</label><span>${data.header.id}</span></div>
  <div><label>Área</label><span>${data.header.area}</span></div>
  <div><label>Responsable</label><span>${data.header.responsable}</span></div>
  <div><label>Hora inicio</label><span>${data.header.horaInicio}</span></div>
</div>

<table>
  <thead>
    <tr>
      <th>Categoría</th><th>Producto</th><th>Área</th><th>Unidad</th>
      <th style="text-align:center">Sistema</th>
      <th style="text-align:center">Físico</th>
      <th style="text-align:center">Diferencia</th>
    </tr>
  </thead>
  <tbody>${filas}</tbody>
</table>

<div class="summary">
  <div class="stat"><div class="n">${data.items.length}</div><div class="l">Productos contados</div></div>
  <div class="stat"><div class="n">${conDiff}</div><div class="l">Con diferencia</div></div>
  <div class="stat"><div class="n">${data.items.length - conDiff}</div><div class="l">Sin diferencia</div></div>
</div>

<div style="text-align:center">
  <button class="btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
</div>

<div class="footer">
  Generado por Almacén Mozzafiato · ${new Date().toLocaleString('es-MX')}
</div>
</body>
</html>`

  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close() }
}

// ─── WhatsApp text ────────────────────────────────────────────────────────────

function buildWhatsAppText(data: ReporteData): string {
  const conDiff = data.items.filter(i => i.fisico !== i.sistema)
  let msg = `📋 *LEVANTAMIENTO DE INVENTARIO*\n`
  msg += `📅 ${data.header.fecha} ${data.hora}\n`
  msg += `🏷️ Área: ${data.header.area}\n`
  msg += `👤 ${data.header.responsable}\n`
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`

  if (conDiff.length === 0) {
    msg += `✅ Sin diferencias. Todo cuadra.\n`
  } else {
    msg += `⚠️ *${conDiff.length} diferencia(s):*\n\n`
    conDiff.forEach(it => {
      const diff   = it.fisico - it.sistema
      const signo  = diff > 0 ? '▲' : '▼'
      msg += `${signo} *${it.producto}*\n`
      msg += `   Sistema: ${it.sistema} | Físico: ${it.fisico} | Dif: ${diff > 0 ? '+' : ''}${diff} ${it.unidad}\n\n`
    })
  }

  msg += `━━━━━━━━━━━━━━━━━━━━\n`
  msg += `📦 Total: ${data.items.length} productos · ${conDiff.length} con dif.\n`
  msg += `🆔 ${data.header.id}`
  return msg
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function InventarioFisicoPage() {
  const { user, areaFiltro }           = useAuth()
  const { data: catalogoAll = [], isLoading } = useCatalogo()
  const { data: historial = [] }       = useInventarios()
  const invalidate                     = useInvalidate()
  const toast                          = useToast()

  const [fase,    setFase]    = useState<Fase>(() => loadHeader() ? 'conteo' : 'idle')
  const [header,  setHeader]  = useState<InvHeader | null>(loadHeader)
  const [counts,  setCounts]  = useState<Record<string, number>>(loadCounts)
  const [query,   setQuery]   = useState('')
  const [catF,    setCatF]    = useState('todos')
  const [soloDif, setSoloDif] = useState(false)
  const [reporte, setReporte] = useState<ReporteData | null>(null)

  // Productos del área activa
  const productos = useMemo(() =>
    catalogoAll.filter(p =>
      p.activo !== 'NO' &&
      matchesAreaFiltro(p.area, areaFiltro === 'Todas' ? 'Todas' : areaFiltro)
    ),
    [catalogoAll, areaFiltro]
  )

  const categorias = useMemo(() =>
    [...new Set(productos.map(p => p.categoria))].sort(),
    [productos]
  )

  // Lista filtrada para la vista de conteo
  const listaFiltrada = useMemo(() => {
    const q = query.toLowerCase()
    return productos.filter(p => {
      const matchQ   = !q || p.producto.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)
      const matchCat = catF === 'todos' || p.categoria === catF
      const matchDif = !soloDif || (counts[p.producto] !== undefined && counts[p.producto] !== p.stockActual)
      return matchQ && matchCat && matchDif
    })
  }, [productos, query, catF, soloDif, counts])

  // Productos con diferencia (para revisión)
  const itemsConDif = useMemo(() =>
    productos
      .filter(p => counts[p.producto] !== undefined && counts[p.producto] !== p.stockActual)
      .map(p => ({
        producto:  p.producto,
        categoria: p.categoria,
        unidad:    p.unidad,
        area:      p.area,
        sistema:   p.stockActual,
        fisico:    counts[p.producto],
        diff:      counts[p.producto] - p.stockActual,
      })),
    [productos, counts]
  )

  // Todos los contados (para guardar en Sheets)
  const todosContados = useMemo(() =>
    productos
      .filter(p => counts[p.producto] !== undefined)
      .map(p => ({
        producto:  p.producto,
        categoria: p.categoria,
        unidad:    p.unidad,
        area:      p.area,
        sistema:   p.stockActual,
        fisico:    counts[p.producto],
        diff:      counts[p.producto] - p.stockActual,
      })),
    [productos, counts]
  )

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function iniciarLevantamiento() {
    const n = nowDateTime()
    const h: InvHeader = {
      id:          newId(),
      area:        areaFiltro,
      horaInicio:  n.time,
      fecha:       n.date,
      responsable: user?.nombre ?? '',
    }
    saveHeader(h)
    saveCounts({})
    setHeader(h)
    setCounts({})
    setFase('conteo')
  }

  function setCount(producto: string, val: string) {
    const n = val === '' ? undefined : parseInt(val)
    setCounts(prev => {
      const next = { ...prev }
      if (n === undefined || isNaN(n)) delete next[producto]
      else next[producto] = Math.max(0, n)
      saveCounts(next)
      return next
    })
  }

  function cancelar() {
    saveHeader(null)
    saveCounts({})
    setHeader(null)
    setCounts({})
    setFase('idle')
    setReporte(null)
  }

  async function cerrar() {
    if (!header) return
    if (todosContados.length === 0) {
      toast('No hay productos contados', 'error'); return
    }

    setFase('guardando')
    const n = nowDateTime()

    try {
      // ── Build batches ───────────────────────────────────────────────────────

      // 1. Inventarios header row
      const invRow: (string | number)[] = [
        header.id, header.fecha, n.time, header.responsable, header.area,
        todosContados.length, itemsConDif.length, 'cerrado'
      ]

      // 2. InventarioItems rows
      const itemRows: (string | number)[][] = todosContados.map(it => [
        itemId(), header.id, it.producto, it.categoria,
        it.unidad, it.sistema, it.fisico, it.diff, it.area
      ])

      // 3. Movimiento de ajuste rows (solo items con diferencia)
      const movRows: (string | number)[][] = itemsConDif.map(it => {
        const tipo   = it.diff > 0 ? 'Entrada' : 'Salida'
        const motivo = `Ajuste levantamiento ${header.id}`
        return [
          movId(), header.fecha, n.time, tipo,
          it.categoria, it.producto, Math.abs(it.diff),
          motivo, header.responsable, '', 0, it.area
        ]
      })

      // 4. Bitácora row
      const bitRow: (string | number)[] = [
        header.fecha, n.time, header.responsable,
        'Levantamiento cerrado', header.id,
        `${todosContados.length} productos, ${itemsConDif.length} diferencias`
      ]

      // ── Single POST ─────────────────────────────────────────────────────────
      const batches = [
        { sheet: SHEET_NAMES.inventarios,     rows: [invRow]  },
        { sheet: SHEET_NAMES.inventarioItems, rows: itemRows  },
        ...(movRows.length > 0 ? [{ sheet: SHEET_NAMES.movimientos, rows: movRows }] : []),
        { sheet: SHEET_NAMES.bitacora,        rows: [bitRow]  },
      ]

      await batchAppend(batches)

      invalidate.inventarios()
      invalidate.catalogo()
      invalidate.movimientos()

      // ── Reporte ─────────────────────────────────────────────────────────────
      const rd: ReporteData = {
        header,
        items: todosContados,
        hora:  n.time,
      }
      setReporte(rd)

      saveHeader(null)
      saveCounts({})
      setHeader(null)
      setCounts({})
      setFase('reporte')

    } catch (e) {
      toast('Error al guardar: ' + (e instanceof Error ? e.message : String(e)), 'error')
      setFase('revision')
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-text2 text-sm">⏳ Cargando catálogo…</div>
  )

  // ── REPORTE ──────────────────────────────────────────────────────────────────
  if (fase === 'reporte' && reporte) {
    const conDif = reporte.items.filter(i => i.fisico !== i.sistema)
    const sinDif = reporte.items.length - conDif.length
    const texto  = buildWhatsAppText(reporte)

    return (
      <div className="px-4 py-4 pb-28">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-full bg-green/20 flex items-center justify-center text-lg">✅</div>
          <div>
            <div className="font-bold text-text1">Levantamiento guardado</div>
            <div className="text-xs text-text2">{reporte.header.id} · {reporte.header.fecha}</div>
          </div>
        </div>

        {/* Resumen cards */}
        <div className="grid grid-cols-3 gap-2 mb-5">
          {[
            { label: 'Contados', value: reporte.items.length, color: 'text-accent' },
            { label: 'Con dif.', value: conDif.length, color: conDif.length > 0 ? 'text-red' : 'text-green' },
            { label: 'OK',       value: sinDif,        color: 'text-green' },
          ].map(s => (
            <div key={s.label} className="bg-surface rounded-card p-3 text-center border border-white/[0.04]">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-text2 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Lista de diferencias */}
        {conDif.length > 0 && (
          <div className="bg-surface rounded-card border border-white/[0.04] mb-4">
            <div className="px-4 py-2.5 border-b border-white/[0.04] text-xs font-semibold text-text2 uppercase tracking-wide">
              Diferencias aplicadas
            </div>
            {conDif.map(it => (
              <div key={it.producto} className="flex items-center justify-between px-4 py-3 border-b border-white/[0.03] last:border-0">
                <div>
                  <div className="text-sm font-medium text-text1">{it.producto}</div>
                  <div className="text-xs text-text2">{it.categoria}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-text2">{it.sistema} → {it.fisico} {it.unidad}</div>
                  <div className={`text-sm font-bold ${it.fisico > it.sistema ? 'text-green' : 'text-red'}`}>
                    {it.fisico > it.sistema ? '+' : ''}{it.fisico - it.sistema}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Botones reporte */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => abrirReporteHTML(reporte)}
            className="w-full py-3 rounded-card bg-accent text-white font-semibold text-sm active:scale-95 transition-transform"
          >
            📄 Ver PDF / Imprimir
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(texto).then(() => toast('Texto copiado'))
              const num = '529832079693'
              window.open(`https://wa.me/${num}?text=${encodeURIComponent(texto)}`, '_blank')
            }}
            className="w-full py-3 rounded-card bg-green/20 text-green font-semibold text-sm border border-green/30 active:scale-95 transition-transform"
          >
            📲 Enviar por WhatsApp
          </button>
          <button
            onClick={() => setFase('idle')}
            className="w-full py-2.5 rounded-card bg-surface2 text-text2 text-sm active:scale-95 transition-transform"
          >
            Nuevo levantamiento
          </button>
        </div>
      </div>
    )
  }

  // ── GUARDANDO ─────────────────────────────────────────────────────────────────
  if (fase === 'guardando') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin" />
        <div className="text-text2 text-sm">Guardando levantamiento…</div>
        <div className="text-text2/50 text-xs">Un solo envío, espera un momento</div>
      </div>
    )
  }

  // ── REVISION ──────────────────────────────────────────────────────────────────
  if (fase === 'revision') {
    return (
      <div className="px-4 py-4 pb-28">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-base font-bold">🔍 Revisión de diferencias</h1>
          <button onClick={() => setFase('conteo')} className="text-xs text-accent px-3 py-1.5 rounded-full bg-accent/10">
            ← Volver
          </button>
        </div>

        {itemsConDif.length === 0 ? (
          <div className="bg-green/10 border border-green/20 rounded-card p-4 text-center mb-4">
            <div className="text-2xl mb-2">✅</div>
            <div className="text-green font-semibold text-sm">¡Todo cuadra!</div>
            <div className="text-text2 text-xs mt-1">No hay diferencias entre físico y sistema</div>
          </div>
        ) : (
          <>
            <div className="text-xs text-text2 mb-3">
              {itemsConDif.length} producto(s) con diferencia · se generarán ajustes automáticos
            </div>
            <div className="bg-surface rounded-card border border-white/[0.04] mb-4">
              {itemsConDif.map(it => (
                <div key={it.producto} className="flex items-center justify-between px-4 py-3 border-b border-white/[0.03] last:border-0">
                  <div>
                    <div className="text-sm font-medium text-text1">{it.producto}</div>
                    <div className="text-xs text-text2">{it.categoria}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-text2">Sistema</div>
                      <div className="text-sm font-semibold text-text1">{it.sistema}</div>
                    </div>
                    <div className="text-text2/40">→</div>
                    <div className="text-right">
                      <div className="text-[10px] text-text2">Físico</div>
                      <div className="text-sm font-semibold text-text1">{it.fisico}</div>
                    </div>
                    <div className={`text-sm font-bold w-10 text-right ${it.diff > 0 ? 'text-green' : 'text-red'}`}>
                      {it.diff > 0 ? '+' : ''}{it.diff}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="text-xs text-text2 mb-4 bg-surface2 rounded-xl p-3 border border-white/[0.04]">
          📦 <strong>{todosContados.length}</strong> productos contados ·{' '}
          {itemsConDif.length > 0 && (
            <span>Se crearán <strong>{itemsConDif.length}</strong> movimiento(s) de ajuste</span>
          )}
        </div>

        <button
          onClick={cerrar}
          className="w-full py-3.5 rounded-card bg-accent text-white font-bold text-sm active:scale-95 transition-transform"
        >
          ✅ Confirmar y guardar
        </button>
      </div>
    )
  }

  // ── CONTEO ────────────────────────────────────────────────────────────────────
  if (fase === 'conteo' && header) {
    const contados = Object.keys(counts).length
    return (
      <div className="px-4 py-4 pb-28">
        {/* Header de la sesión */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-bold text-text1">📋 Contando…</div>
            <div className="text-xs text-text2">{header.area} · {header.horaInicio} · {contados} contados</div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFase('revision')}
              className="text-xs bg-accent text-white px-3 py-1.5 rounded-full font-semibold"
            >
              Revisar →
            </button>
            <button
              onClick={cancelar}
              className="text-xs bg-red/20 text-red px-3 py-1.5 rounded-full"
            >
              Cancelar
            </button>
          </div>
        </div>

        <SearchBar value={query} onChange={setQuery} placeholder="Buscar producto…" />

        <FilterPills
          options={categorias}
          active={catF}
          onSelect={setCatF}
        />

        {/* Toggle solo diferencias */}
        <button
          onClick={() => setSoloDif(v => !v)}
          className={`mb-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
            soloDif
              ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
              : 'bg-surface2 text-text2 border-white/[0.06]'
          }`}
        >
          <span>{soloDif ? '🔴' : '⚪'}</span>
          Solo con diferencia
        </button>

        {listaFiltrada.length === 0 && (
          <EmptyState message="Sin productos para este filtro" />
        )}

        <div className="space-y-2">
          {listaFiltrada.map(p => {
            const fisico = counts[p.producto]
            const diff   = fisico !== undefined ? fisico - p.stockActual : null
            return (
              <div
                key={p.producto}
                className={`bg-surface rounded-card border px-4 py-3 flex items-center gap-3 transition-colors ${
                  diff !== null && diff !== 0
                    ? 'border-orange-500/30'
                    : diff === 0
                      ? 'border-green/20'
                      : 'border-white/[0.04]'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text1 truncate">{p.producto}</div>
                  <div className="text-[10px] text-text2">{p.categoria} · {p.unidad}</div>
                  <div className="text-xs text-text2 mt-0.5">
                    Sistema: <span className="text-text1 font-semibold">{p.stockActual}</span>
                    {diff !== null && diff !== 0 && (
                      <span className={`ml-2 font-bold ${diff > 0 ? 'text-green' : 'text-red'}`}>
                        {diff > 0 ? '+' : ''}{diff}
                      </span>
                    )}
                    {diff === 0 && (
                      <span className="ml-2 text-green font-bold">✓</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="text-[10px] text-text2">Físico</div>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={fisico !== undefined ? fisico : ''}
                    onChange={e => setCount(p.producto, e.target.value)}
                    placeholder={String(p.stockActual)}
                    className="w-20 text-center bg-surface2 border border-white/[0.10] rounded-lg px-2 py-1.5 text-sm font-bold text-text1 outline-none focus:border-accent"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── IDLE ──────────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-4 pb-28">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-base font-bold">📋 Levantamiento</h1>
        <span className="text-xs text-text2 bg-surface2 px-2 py-1 rounded-full">{areaFiltro}</span>
      </div>

      <button
        onClick={iniciarLevantamiento}
        className="w-full py-4 rounded-card bg-accent text-white font-bold text-sm mb-6 active:scale-95 transition-transform shadow-lg shadow-accent/20"
      >
        ➕ Nuevo levantamiento
      </button>

      {/* Historial */}
      {historial.length > 0 && (
        <>
          <div className="text-xs text-text2 uppercase tracking-wide font-semibold mb-2">Historial</div>
          <div className="space-y-2">
            {historial.slice(0, 10).map(inv => (
              <div key={inv.id} className="bg-surface rounded-card border border-white/[0.04] px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-text1">{inv.fecha} · {inv.hora}</div>
                    <div className="text-xs text-text2">{inv.responsable} · {inv.area}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-text2">{inv.totalProductos} productos</div>
                    <div className={`text-xs font-bold ${inv.totalConDiferencia > 0 ? 'text-orange-400' : 'text-green'}`}>
                      {inv.totalConDiferencia > 0 ? `${inv.totalConDiferencia} dif.` : '✓ OK'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
