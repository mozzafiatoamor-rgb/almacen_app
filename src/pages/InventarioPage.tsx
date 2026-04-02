import { useState, useMemo } from 'react'
import { useCatalogo } from '../hooks/useSheets'
import { getCategoriasFromCatalogo } from '../hooks/useSheets'
import SearchBar from '../components/shared/SearchBar'
import FilterPills from '../components/shared/FilterPills'
import EmptyState from '../components/shared/EmptyState'
import AreaFilter, { AreaBadge } from '../components/shared/AreaFilter'
import type { Area } from '../api/types'

export default function InventarioPage() {
  const { data: catalogo = [], isLoading } = useCatalogo()
  const [query,  setQuery]  = useState('')
  const [catF,   setCatF]   = useState('todos')
  const [areaF,  setAreaF]  = useState<Area | 'todos'>('todos')

  const cats = useMemo(() => getCategoriasFromCatalogo(catalogo), [catalogo])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return catalogo.filter(p => {
      const matchQ    = !q || p.producto.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)
      const matchCat  = catF === 'todos' || p.categoria === catF
      const matchArea = areaF === 'todos' ? true : p.area === areaF || p.area === 'Ambas'
      return matchQ && matchCat && matchArea
    })
  }, [catalogo, query, catF, areaF])

  if (isLoading) return <div className="flex items-center justify-center py-16 text-text2 text-sm">⏳ Cargando…</div>

  return (
    <div className="px-4 py-4 pb-24">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-bold">📦 Inventario ({catalogo.length})</h1>
      </div>

      <SearchBar value={query} onChange={setQuery} placeholder="Buscar producto o categoría…" />
      <AreaFilter active={areaF} onChange={setAreaF} />
      <FilterPills options={cats} active={catF} onSelect={setCatF} />

      {filtered.length === 0
        ? <EmptyState icon="📦" message="Sin productos" />
        : filtered.map(p => {
            const ratio  = p.stockMinimo > 0 ? p.stockActual / p.stockMinimo : 999
            const status = ratio < 1 ? 'low' : ratio < 1.5 ? 'warn' : 'ok'
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
