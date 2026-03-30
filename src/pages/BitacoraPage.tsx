import { useState, useMemo } from 'react'
import { useBitacora } from '../hooks/useSheets'
import SearchBar from '../components/shared/SearchBar'
import EmptyState from '../components/shared/EmptyState'
import { today, dateToISO, isoToDate } from '../utils/dates'

export default function BitacoraPage() {
  const { data: bitacora = [], isLoading } = useBitacora()
  const [query,      setQuery]      = useState('')
  const [filterDate, setFilterDate] = useState('')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return bitacora.filter(b =>
      (!filterDate || b.fecha === filterDate) &&
      (!q || b.accion.toLowerCase().includes(q) || b.detalle.toLowerCase().includes(q) || b.usuario.toLowerCase().includes(q))
    )
  }, [bitacora, query, filterDate])

  const tipoIcon = (tipo: string) => {
    if (tipo === 'entrada')  return '🟢'
    if (tipo === 'salida')   return '🔴'
    if (tipo === 'merma')    return '⚠️'
    if (tipo === 'add')      return '➕'
    if (tipo === 'edit')     return '✏️'
    if (tipo === 'delete')   return '🗑️'
    return '📝'
  }

  if (isLoading) return <div className="flex items-center justify-center py-16 text-text2 text-sm">⏳ Cargando…</div>

  return (
    <div className="px-4 py-4 pb-24">
      <h1 className="text-base font-bold mb-4">📜 Bitácora</h1>

      <div className="flex gap-2 mb-3">
        <div className="flex gap-1.5 flex-1 overflow-x-auto">
          {[['', 'Todas'], [today(), 'Hoy']].map(([d, label]) => (
            <button key={d} onClick={() => setFilterDate(d)}
              className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filterDate === d ? 'bg-accent text-white border-accent' : 'bg-surface text-text2 border-surface3'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={filterDate ? dateToISO(filterDate) : ''}
          onChange={e => setFilterDate(e.target.value ? isoToDate(e.target.value) : '')}
          className="bg-surface2 border border-surface3 rounded-xl px-2 py-1.5 text-xs text-text1 outline-none focus:border-accent w-36"
        />
      </div>

      <SearchBar value={query} onChange={setQuery} placeholder="Buscar usuario, acción…" />

      {filtered.length === 0
        ? <EmptyState icon="📜" message="Sin registros" />
        : filtered.map((b, i) => (
            <div key={i} className="py-3 border-b border-surface3/50">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{tipoIcon(b.tipo)}</span>
                <span className="text-sm font-semibold text-text1">{b.accion}</span>
                <span className="ml-auto text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded-md font-semibold">
                  {b.tipo}
                </span>
              </div>
              <div className="text-xs text-text2 mb-1">{b.detalle}</div>
              <div className="flex flex-wrap gap-2 text-xs text-text2">
                <span>📅 {b.fecha}</span>
                <span>🕒 {b.hora}</span>
                <span>👤 {b.usuario}</span>
              </div>
            </div>
          ))
      }
    </div>
  )
}
