import { useState, useMemo } from 'react'
import { useCatalogo, useStockBajo, getCategoriasFromCatalogo } from '../hooks/useSheets'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../hooks/useToast'

const JEFE_WA = '529832079693'
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
  const stockBajo  = useStockBajo()
  const { user }   = useAuth()
  const toast      = useToast()

  const [query,   setQuery]   = useState('')
  const [catF,    setCatF]    = useState('todos')
  const [areaF,   setAreaF]   = useState<Area | 'todos'>('todos')

  // Urgente bottom sheet state
  const [urgentOpen,    setUrgentOpen]    = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [nota,          setNota]          = useState('')

  const cats = useMemo(() => getCategoriasFromCatalogo(catalogo), [catalogo])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return catalogo
      .filter(p => {
        const matchQ    = !q || p.producto.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)
        const matchCat  = catF === 'todos' || p.categoria === catF
        const matchArea = areaF === 'todos' ? true : p.area === areaF || p.area === 'Ambas'
        return matchQ && matchCat && matchArea
      })
      .sort((a, b) => b.prioridad - a.prioridad)
  }, [catalogo, query, catF, areaF])

  function toggleItem(nombre: string) {
    setSelectedItems(prev => {
      const next = new Set(prev)
      if (next.has(nombre)) next.delete(nombre)
      else next.add(nombre)
      return next
    })
  }

  function handleSendUrgent() {
    const selected = stockBajo.filter(i => selectedItems.has(i.producto))
    if (selected.length === 0) {
      toast('Selecciona al menos un producto', 'error')
      return
    }
    const fecha = new Date().toLocaleDateString('es-MX', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
    const lines = selected.map(i =>
      `• ${i.producto} (P${i.prioridad}) — Stock: ${i.stockActual}/${i.stockMinimo}, Faltan: ${i.faltante} ${i.unidad} [${i.proveedor}]`
    )
    const mensaje = [
      `🚨 ALERTA URGENTE — Mozzafiato`,
      `👤 ${user?.nombre ?? 'Empleado'}`,
      `📅 ${fecha}`,
      ``,
      `Productos con stock bajo:`,
      ...lines,
      nota ? `📝 Nota: ${nota}` : '',
    ].filter(Boolean).join('\n')

    window.open(`https://wa.me/${JEFE_WA}?text=${encodeURIComponent(mensaje)}`, '_blank')
    setUrgentOpen(false)
    setSelectedItems(new Set())
    setNota('')
  }

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

      {/* Floating Urgente button */}
      {stockBajo.length > 0 && (
        <button
          onClick={() => setUrgentOpen(true)}
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 bg-red text-white px-4 py-3 rounded-full shadow-lg font-semibold text-sm active:opacity-80 transition-opacity"
        >
          <span>📢</span>
          <span>Urgente</span>
          <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-xs font-bold">{stockBajo.length}</span>
        </button>
      )}

      {/* Urgente bottom sheet */}
      {urgentOpen && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60"
            onClick={() => setUrgentOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#162030] rounded-t-2xl max-h-[80vh] flex flex-col">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>
            <div className="px-4 pb-2 flex justify-between items-center">
              <h2 className="font-bold text-sm">🚨 Alerta de Abastecimiento</h2>
              <button onClick={() => setUrgentOpen(false)} className="text-text2 text-lg leading-none">✕</button>
            </div>
            <p className="px-4 text-xs text-text2 mb-3">
              Selecciona los productos críticos y envía una alerta al encargado por WhatsApp.
            </p>

            {/* Item list */}
            <div className="overflow-y-auto flex-1 px-4">
              {stockBajo.map(item => {
                const checked = selectedItems.has(item.producto)
                return (
                  <button
                    key={item.producto}
                    onClick={() => toggleItem(item.producto)}
                    className={`w-full flex items-center gap-3 py-3 border-b border-surface3/50 last:border-0 text-left transition-opacity ${checked ? 'opacity-100' : 'opacity-55'}`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'bg-accent border-accent' : 'border-white/20 bg-transparent'}`}>
                      {checked && <span className="text-white text-xs font-bold">✓</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-text1">{item.producto}</span>
                        <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-bold ${PRIORIDAD_COLOR[item.prioridad]}`}>
                          P{item.prioridad}
                        </span>
                      </div>
                      <div className="text-xs text-text2 truncate">{item.proveedor} · Faltan: {item.faltante} {item.unidad}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-mono text-red font-bold">{item.stockActual}</div>
                      <div className="text-[10px] text-text2">/{item.stockMinimo}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Nota + send */}
            <div className="px-4 pt-3 pb-6 border-t border-surface3 bg-[#162030]">
              <textarea
                value={nota}
                onChange={e => setNota(e.target.value)}
                placeholder="Nota opcional (ej: es urgente para esta noche)…"
                rows={2}
                className="w-full bg-surface2 border border-surface3 rounded-xl px-3 py-2 text-sm text-text1 placeholder-text2 resize-none mb-3 focus:outline-none focus:border-accent"
              />
              <button
                onClick={handleSendUrgent}
                disabled={selectedItems.size === 0}
                className="w-full py-3 bg-red text-white rounded-xl font-semibold text-sm disabled:opacity-40 active:opacity-80 transition-opacity"
              >
                {`📱 Abrir WhatsApp (${selectedItems.size} producto${selectedItems.size !== 1 ? 's' : ''})`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
