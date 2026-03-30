import { useState, useMemo } from 'react'
import { useMovimientos } from '../hooks/useSheets'
import SearchBar from '../components/shared/SearchBar'
import EmptyState from '../components/shared/EmptyState'
import { today, dateToISO, isoToDate } from '../utils/dates'

type ViewMode = 'resumen' | 'detalle'

interface Props {
  onOpenEntrada: () => void
  onOpenSalida:  () => void
}

export default function MovimientosPage({ onOpenEntrada, onOpenSalida }: Props) {
  const { data: movimientos = [], isLoading } = useMovimientos()
  const [query,       setQuery]      = useState('')
  const [filterDate,  setFilterDate] = useState('')
  const [viewMode,    setViewMode]   = useState<ViewMode>('resumen')

  const filtered = useMemo(() => {
    let d = movimientos
    if (filterDate) d = d.filter(m => m.fecha === filterDate)
    if (query) {
      const q = query.toLowerCase()
      d = d.filter(m =>
        m.producto.toLowerCase().includes(q) ||
        m.tipo.toLowerCase().includes(q) ||
        m.responsable.toLowerCase().includes(q)
      )
    }
    return d
  }, [movimientos, query, filterDate])

  const totalEnt = filtered.filter(m => m.tipo === 'Entrada').reduce((s, m) => s + m.cantidad, 0)
  const totalSal = filtered.filter(m => m.tipo === 'Salida').reduce((s, m) => s + m.cantidad, 0)

  if (isLoading) return <LoadingState />

  return (
    <div className="px-4 py-4 pb-24">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-bold">📥 Movimientos</h1>
        <div className="flex gap-2">
          <button onClick={onOpenEntrada} className="text-xs font-semibold bg-green text-bg px-3 py-1.5 rounded-lg">+ Entrada</button>
          <button onClick={onOpenSalida}  className="text-xs font-semibold bg-orange text-white px-3 py-1.5 rounded-lg">+ Salida</button>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex gap-2 mb-3">
        <div className="flex gap-1.5 flex-1 overflow-x-auto">
          <PillBtn active={filterDate === ''} onClick={() => setFilterDate('')}>Todos</PillBtn>
          <PillBtn active={filterDate === today()} onClick={() => setFilterDate(today())}>Hoy</PillBtn>
        </div>
        <input
          type="date"
          value={filterDate ? dateToISO(filterDate) : ''}
          onChange={e => setFilterDate(e.target.value ? isoToDate(e.target.value) : '')}
          className="bg-surface2 border border-surface3 rounded-xl px-2 py-1.5 text-xs text-text1 outline-none focus:border-accent w-36"
        />
      </div>

      {/* View mode */}
      <div className="flex gap-1.5 mb-3">
        <PillBtn active={viewMode === 'resumen'} onClick={() => setViewMode('resumen')}>📊 Resumen</PillBtn>
        <PillBtn active={viewMode === 'detalle'} onClick={() => setViewMode('detalle')}>📝 Detalle</PillBtn>
      </div>

      <SearchBar value={query} onChange={setQuery} placeholder="Buscar producto, tipo, responsable…" />

      {/* Totals */}
      {filtered.length > 0 && (
        <div className="flex gap-2 mb-4">
          <div className="flex-1 bg-green/10 rounded-xl p-3 text-center">
            <div className="font-mono font-bold text-xl text-green">+{totalEnt}</div>
            <div className="text-xs text-text2">Entradas</div>
          </div>
          <div className="flex-1 bg-orange/10 rounded-xl p-3 text-center">
            <div className="font-mono font-bold text-xl text-orange">-{totalSal}</div>
            <div className="text-xs text-text2">Salidas</div>
          </div>
        </div>
      )}

      {filtered.length === 0
        ? <EmptyState icon="📥" message="Sin movimientos" />
        : viewMode === 'resumen'
          ? <ResumenView movimientos={filtered} />
          : <DetalleView movimientos={filtered} />
      }
    </div>
  )
}

function ResumenView({ movimientos }: { movimientos: ReturnType<typeof useMovimientos>['data'] }) {
  if (!movimientos) return null
  const grouped: Record<string, { ent: number; sal: number; items: typeof movimientos; byUser: Record<string, { ent: number; sal: number }> }> = {}
  for (const m of movimientos) {
    if (!grouped[m.producto]) grouped[m.producto] = { ent: 0, sal: 0, items: [], byUser: {} }
    if (m.tipo === 'Entrada') grouped[m.producto].ent += m.cantidad
    else grouped[m.producto].sal += m.cantidad
    grouped[m.producto].items.push(m)
    if (!grouped[m.producto].byUser[m.responsable]) grouped[m.producto].byUser[m.responsable] = { ent: 0, sal: 0 }
    if (m.tipo === 'Entrada') grouped[m.producto].byUser[m.responsable].ent += m.cantidad
    else grouped[m.producto].byUser[m.responsable].sal += m.cantidad
  }
  const keys = Object.keys(grouped).sort((a, b) =>
    (grouped[b].ent + grouped[b].sal) - (grouped[a].ent + grouped[a].sal)
  )

  return (
    <div>
      {keys.map(k => {
        const g = grouped[k]
        return (
          <div key={k} className="py-3 border-b border-surface3/50">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-sm font-semibold text-text1">{k}</span>
              <div className="flex gap-2">
                {g.ent > 0 && <span className="font-mono font-bold text-sm text-green">+{g.ent}</span>}
                {g.sal > 0 && <span className="font-mono font-bold text-sm text-orange">-{g.sal}</span>}
              </div>
            </div>
            <div className="text-xs text-text2 mb-1">{g.items[0]?.categoria} · {g.items.length} mov.</div>
            {Object.entries(g.byUser).map(([u, v]) => (
              <div key={u} className="flex justify-between items-center px-2 py-1 mt-1 bg-surface2 rounded-lg text-xs">
                <span className="text-text2">👤 {u}</span>
                <div className="flex gap-2">
                  {v.ent > 0 && <span className="text-green">+{v.ent}</span>}
                  {v.sal > 0 && <span className="text-orange">-{v.sal}</span>}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function DetalleView({ movimientos }: { movimientos: ReturnType<typeof useMovimientos>['data'] }) {
  if (!movimientos) return null
  return (
    <div>
      {movimientos.map((m, i) => {
        const isEnt = m.tipo === 'Entrada'
        return (
          <div key={i} className="py-3 border-b border-surface3/50">
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-semibold text-text1">
                {isEnt ? '🟢' : '🔴'} {m.producto}
              </span>
              <span className={`font-mono font-bold text-sm ${isEnt ? 'text-green' : 'text-orange'}`}>
                {isEnt ? '+' : '-'}{m.cantidad}
              </span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-text2">
              <span>📅 {m.fecha}</span>
              <span>🕒 {m.hora}</span>
              <span>📁 {m.categoria}</span>
              <span>👤 {m.responsable}</span>
            </div>
            {m.motivo && <div className="text-xs text-text2 mt-1">📝 {m.motivo}{m.notas ? ` - ${m.notas}` : ''}</div>}
          </div>
        )
      })}
    </div>
  )
}

function PillBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        active ? 'bg-accent text-white border-accent' : 'bg-surface text-text2 border-surface3'
      }`}
    >
      {children}
    </button>
  )
}

function LoadingState() {
  return <div className="flex items-center justify-center py-16 text-text2 text-sm">⏳ Cargando…</div>
}
