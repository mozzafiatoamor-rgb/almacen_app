import { useState, useMemo } from 'react'
import { useMermas } from '../hooks/useSheets'
import SearchBar from '../components/shared/SearchBar'
import EmptyState from '../components/shared/EmptyState'
import { today, dateToISO, isoToDate } from '../utils/dates'

interface Props {
  onOpenMerma: () => void
}

export default function MermasPage({ onOpenMerma }: Props) {
  const { data: mermas = [], isLoading } = useMermas()
  const [query,      setQuery]      = useState('')
  const [filterDate, setFilterDate] = useState('')

  const mermasHoy = useMemo(
    () => mermas.filter(m => m.fecha === today()).reduce((s, m) => s + m.cantidad, 0),
    [mermas]
  )

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return mermas.filter(m =>
      (!filterDate || m.fecha === filterDate) &&
      (!q || m.producto.toLowerCase().includes(q) || m.motivo.toLowerCase().includes(q) || m.responsable.toLowerCase().includes(q))
    )
  }, [mermas, query, filterDate])

  if (isLoading) return <div className="flex items-center justify-center py-16 text-text2 text-sm">⏳ Cargando…</div>

  return (
    <div className="px-4 py-4 pb-24">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-bold">⚠️ Mermas</h1>
        <button onClick={onOpenMerma} className="text-xs font-semibold bg-accent text-white px-3 py-1.5 rounded-lg">+ Registrar</button>
      </div>

      {mermasHoy > 0 && (
        <div className="bg-red/10 border border-red/30 rounded-xl px-3.5 py-2.5 mb-4 text-sm text-red">
          ⚠️ Mermas hoy: <strong>{mermasHoy} unidades</strong>
        </div>
      )}

      <div className="flex gap-2 mb-3">
        <div className="flex gap-1.5 flex-1 overflow-x-auto">
          {['', today()].map((d, i) => (
            <button key={i} onClick={() => setFilterDate(d)}
              className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                filterDate === d ? 'bg-accent text-white border-accent' : 'bg-surface text-text2 border-surface3'
              }`}
            >
              {d === '' ? 'Todas' : 'Hoy'}
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

      <SearchBar value={query} onChange={setQuery} placeholder="Buscar producto, motivo, responsable…" />

      {filtered.length === 0
        ? <EmptyState icon="⚠️" message="Sin mermas" />
        : filtered.map((m, i) => (
            <div key={i} className="py-3 border-b border-surface3/50 border-l-2 border-l-red pl-3">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-semibold text-text1">{m.producto}</span>
                <span className="font-mono font-bold text-sm text-red">-{m.cantidad}</span>
              </div>
              <div className="text-xs text-yellow mb-1">📝 {m.motivo}</div>
              <div className="flex flex-wrap gap-2 text-xs text-text2">
                <span>📅 {m.fecha}</span>
                <span>🕒 {m.hora}</span>
                <span>📁 {m.categoria}</span>
                <span>👤 {m.responsable}</span>
              </div>
            </div>
          ))
      }
    </div>
  )
}
