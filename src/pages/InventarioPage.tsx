import { useState, useMemo } from 'react'
import { useCatalogo, useStockBajo, getCategoriasFromCatalogo } from '../hooks/useSheets'
import { useAuth } from '../auth/AuthContext'
import SearchBar from '../components/shared/SearchBar'
import FilterPills from '../components/shared/FilterPills'
import EmptyState from '../components/shared/EmptyState'
import AreaFilter, { AreaBadge } from '../components/shared/AreaFilter'
import type { Area } from '../api/types'

const PRIORIDAD_COLOR: Record<number, string> = {
  5: 'text-red bg-red/10 border-red/20',
  4: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  3: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  2: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  1: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
}

export default function InventarioPage() {
  const { data: catalogo = [], isLoading } = useCatalogo()
  const stockBajo                          = useStockBajo()
  const { userArea, isAreaRestricted }     = useAuth()

  const [query, setQuery] = useState('')
  const [catF,  setCatF]  = useState('todos')
  const [areaF, setAreaF] = useState<Area | 'todos'>('todos')

  const cats = useMemo(() => getCategoriasFromCatalogo(catalogo), [catalogo])

  const filtered = useMemo(() => {
    const q            = query.toLowerCase()
    const effectiveArea = isAreaRestricted ? userArea : areaF
    return catalogo
      .filter(p => {
        const matchQ    = !q || p.producto.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)
        const matchCat  = catF === 'todos' || p.categoria === catF
        const matchArea = effectiveArea === 'todos' || effectiveArea === 'Todas'
          ? true
          : p.area === effectiveArea || p.area === 'Ambas'
        return matchQ && matchCat && matchArea
      })
      .sort((a, b) => b.prioridad - a.prioridad)
  }, [catalogo, query, catF, areaF, isAreaRestricted, userArea])

  if (isLoading) return <div className="flex items-center justify-center py-16 text-text2 text-sm">⏳ Cargando…</div>

  return (
    <div className="px-4 py-4 pb-24">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-bold">
          📦 Inventario ({catalogo.length})
          {stockBajo.length > 0 && (
            <span className="ml-2 text-xs bg-red/20 text-red px-2 py-0.5 rounded-full font-semibold">
              {stockBajo.length} bajo mín.
            </span>
          )}
        </h1>
      </div>

      <SearchBar value={query} onChange={setQuery} placeholder="Buscar producto o categoría…" />
      {!isAreaRestricted && <AreaFilter active={areaF} onChange={setAreaF} />}
      <FilterPills options={cats} active={catF} onSelect={setCatF} />

      {filtered.length === 0
        ? <EmptyState icon="📦" message="Sin productos" />
        : filtered.map(p => {
            const ratio      = p.stockMinimo > 0 ? p.stockActual / p.stockMinimo : 999
            const status     = ratio < 1 ? 'low' : ratio < 1.5 ? 'warn' : 'ok'
            const stockColor = status === 'low' ? 'text-red' : status === 'warn' ? 'text-yellow' : 'text-green'
            const stockBadge = status === 'low'
              ? <span className="text-[10px] bg-red/20 text-red px-1.5 py-0.5 rounded-md font-semibold">BAJO</span>
              : status === 'warn'
              ? <span className="text-[10px] bg-yellow/20 text-yellow px-1.5 py-0.5 rounded-md font-semibold">MEDIO</span>
              : <span className="text-[10px] bg-green/20 text-green px-1.5 py-0.5 rounded-md font-semibold">OK</span>

            return (
              <div key={p.id} className="flex items-center py-3 border-b border-surface3/50 gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold text-text1">{p.producto}</span>
                    {stockBadge}
                    <AreaBadge area={p.area} />
                    {p.prioridad >= 4 && (
                      <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-bold ${PRIORIDAD_COLOR[p.prioridad]}`}>
                        P{p.prioridad}{p.prioridad === 5 ? ' 🔴' : ''}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-text2">
                    {p.categoria} · {p.unidad} · 🏪 {p.proveedor}
                    {p.stockMinimo > 0 && ` · Mín: ${p.stockMinimo}`}
                  </div>
                </div>
                <div className={`font-mono font-bold text-xl ${stockColor}`}>{p.stockActual}</div>
              </div>
            )
          })
      }
    </div>
  )
}
