import { useState, useMemo } from 'react'
import { useCatalogo, useInvalidate, getCategoriasFromCatalogo } from '../hooks/useSheets'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../hooks/useToast'
import { deleteRow } from '../api/appscript'
import { appendBitacora } from '../api/appscript'
import { nowDateTime } from '../utils/dates'
import { SHEET_NAMES } from '../api/config'
import SearchBar from '../components/shared/SearchBar'
import FilterPills from '../components/shared/FilterPills'
import EmptyState from '../components/shared/EmptyState'
import Modal from '../components/layout/Modal'
import ProductoForm from '../components/forms/ProductoForm'
import type { Producto } from '../api/types'

export default function CatalogoPage() {
  const { data: catalogo = [], isLoading } = useCatalogo()
  const { isAdmin, canManage, user }       = useAuth()
  const toast                              = useToast()
  const invalidate                         = useInvalidate()

  const [query,    setQuery]    = useState('')
  const [catF,     setCatF]     = useState('todos')
  const [modal,    setModal]    = useState<'add' | 'edit' | null>(null)
  const [editProd, setEditProd] = useState<Producto | null>(null)

  const cats = useMemo(() => getCategoriasFromCatalogo(catalogo), [catalogo])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return catalogo.filter(p =>
      (!q || p.producto.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)) &&
      (catF === 'todos' || p.categoria === catF)
    )
  }, [catalogo, query, catF])

  async function handleDelete(p: Producto) {
    if (!confirm(`🗑️ ¿Eliminar "${p.producto}"?`)) return
    try {
      await deleteRow(SHEET_NAMES.catalogo, p._row)
      const n = nowDateTime()
      await appendBitacora([n.date, n.time, user?.nombre ?? '', 'Producto eliminado', p.producto, 'delete']).catch(() => {})
      toast(`${p.producto} eliminado`)
      invalidate.catalogo()
    } catch {
      toast('Error al eliminar', 'error')
    }
  }

  function openEdit(p: Producto) {
    if (!isAdmin) return
    setEditProd(p)
    setModal('edit')
  }

  if (isLoading) return <div className="flex items-center justify-center py-16 text-text2 text-sm">⏳ Cargando…</div>

  return (
    <div className="px-4 py-4 pb-24">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-bold">📋 Catálogo ({catalogo.length})</h1>
        {canManage && (
          <button
            onClick={() => { setEditProd(null); setModal('add') }}
            className="text-xs font-semibold bg-accent text-white px-3 py-1.5 rounded-lg"
          >
            + Producto
          </button>
        )}
      </div>

      <SearchBar value={query} onChange={setQuery} placeholder="Buscar producto o categoría…" />
      <FilterPills options={cats} active={catF} onSelect={setCatF} />

      {filtered.length === 0
        ? <EmptyState icon="📋" message="Sin productos" />
        : filtered.map(p => (
            <div
              key={p.id}
              onClick={() => openEdit(p)}
              className={`flex items-center py-3 border-b border-surface3/50 gap-3 relative ${isAdmin ? 'cursor-pointer' : ''}`}
            >
              <div className="flex-1" style={{ paddingRight: isAdmin ? '60px' : '0' }}>
                <div className="text-sm font-semibold text-text1">{p.producto}</div>
                <div className="text-xs text-text2">
                  {p.categoria} · {p.unidad} · 🏪 {p.proveedor} · Stock: {p.stockActual} · Mín: {p.stockMinimo}
                  {p.pzaPaq > 1 && ` · 📦 ${p.pzaPaq} pzas/paq`}
                </div>
              </div>
              {isAdmin && (
                <>
                  <span className="text-text2 text-base mr-7">✏️</span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(p) }}
                    className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-red opacity-50 hover:opacity-100 transition-opacity"
                    aria-label="Eliminar"
                  >
                    🗑️
                  </button>
                </>
              )}
            </div>
          ))
      }

      <Modal open={modal !== null} onClose={() => setModal(null)}>
        <ProductoForm
          catalogo={catalogo}
          editProd={modal === 'edit' ? editProd : null}
          onClose={() => setModal(null)}
        />
      </Modal>
    </div>
  )
}
