import { useState, useMemo } from 'react'
import { useStockBajo } from '../hooks/useSheets'
import SearchBar from '../components/shared/SearchBar'
import FilterPills from '../components/shared/FilterPills'
import EmptyState from '../components/shared/EmptyState'
import { today } from '../utils/dates'
import { useToast } from '../hooks/useToast'

export default function ComprasPage() {
  const stockBajo   = useStockBajo()
  const toast       = useToast()
  const [query,  setQuery]  = useState('')
  const [provF,  setProvF]  = useState('todos')

  const proveedores = useMemo(
    () => [...new Set(stockBajo.map(p => p.proveedor))].sort(),
    [stockBajo]
  )

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return stockBajo.filter(p =>
      (provF === 'todos' || p.proveedor === provF) &&
      (!q || p.producto.toLowerCase().includes(q) || p.proveedor.toLowerCase().includes(q))
    )
  }, [stockBajo, query, provF])

  const byProv = useMemo(() => {
    const g: Record<string, typeof filtered> = {}
    for (const p of filtered) {
      if (!g[p.proveedor]) g[p.proveedor] = []
      g[p.proveedor].push(p)
    }
    return g
  }, [filtered])

  const provKeys = Object.keys(byProv).sort()

  async function copyList() {
    let txt = `🛒 LISTA DE COMPRAS - ${today()}\nAlmacén Mozzafiato\n━━━━━━━━━━━━━━━━━━━\n\n`
    for (const prov of provKeys) {
      txt += `🏪 ${prov.toUpperCase()}\n`
      for (const p of byProv[prov]) {
        txt += `  ▫ ${p.producto} - Comprar: ${p.faltante} ${p.unidad} (Stock: ${p.stockActual}/${p.stockMinimo})\n`
      }
      txt += '\n'
    }
    txt += `Total: ${filtered.length} productos`

    if (navigator.share) {
      navigator.share({ title: 'Lista de Compras', text: txt }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(txt)
      toast('Lista copiada al portapapeles')
    }
  }

  return (
    <div className="px-4 py-4 pb-24">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-bold">🛒 Lista de Compras</h1>
        {filtered.length > 0 && (
          <button onClick={copyList} className="text-xs font-semibold bg-accent text-white px-3 py-1.5 rounded-lg">
            📋 Copiar Lista
          </button>
        )}
      </div>

      {/* Summary banner */}
      {stockBajo.length > 0 ? (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-3.5 py-2.5 mb-4 text-sm text-accent">
          🛒 <strong>{stockBajo.length} productos</strong> necesitan reabastecimiento
        </div>
      ) : (
        <div className="bg-green/10 border border-green/30 rounded-xl px-3.5 py-2.5 mb-4 text-sm text-green">
          ✅ Todo el inventario está completo
        </div>
      )}

      <FilterPills options={proveedores} active={provF} onSelect={setProvF} allLabel="Todos" />
      <SearchBar value={query} onChange={setQuery} placeholder="Buscar producto o proveedor…" />

      {provKeys.length === 0
        ? <EmptyState icon="✅" message="No hay productos por comprar" />
        : provKeys.map(prov => (
            <div key={prov} className="bg-surface rounded-card border border-white/[0.04] mb-3 overflow-hidden">
              <div className="flex justify-between items-center px-4 py-3 border-b border-surface3">
                <span className="text-sm font-bold">🏪 {prov}</span>
                <span className="text-xs bg-accent/20 text-accent px-2 py-0.5 rounded-full font-semibold">
                  {byProv[prov].length} productos
                </span>
              </div>
              {byProv[prov].map(p => (
                <div key={p.producto} className="flex items-center px-4 py-3 border-b border-surface3/50 last:border-0 gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text1">{p.producto}</span>
                      <span className="text-[10px] bg-red/20 text-red px-1.5 py-0.5 rounded-md font-semibold">
                        Faltan {p.faltante}
                      </span>
                    </div>
                    <div className="text-xs text-text2">{p.categoria} · {p.unidad} · Stock: {p.stockActual}/{p.stockMinimo}</div>
                  </div>
                </div>
              ))}
            </div>
          ))
      }
    </div>
  )
}
