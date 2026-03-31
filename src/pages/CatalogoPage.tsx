import { useState, useMemo } from 'react'
import { useCatalogo, useInvalidate, getCategoriasFromCatalogo } from '../hooks/useSheets'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../hooks/useToast'
import { deleteRow, appendBitacora } from '../api/appscript'
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
  const [deleting, setDeleting] = useState<string | null>(null)

  const cats = useMemo(() => getCategoriasFromCatalogo(catalogo), [catalogo])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return catalogo.filter(p =>
      (!q || p.producto.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)) &&
      (catF === 'todos' || p.categoria === catF)
    )
  }, [catalogo, query, catF])

  async function handleDelete(e: React.MouseEvent, p: Producto) {
    e.stopPropagation()
    if (!confirm(`🗑️ ¿Eliminar "${p.producto}"?\nEsta acción no se puede deshacer.`)) return
    setDeleting(p.id)
    try {
      await deleteRow(SHEET_NAMES.catalogo, p._row)
      const n = nowDateTime()
      await appendBitacora([n.date, n.time, user?.nombre ?? '', 'Producto eliminado', p.producto, 'delete']).catch(() => {})
      toast(`${p.producto} eliminado`)
      invalidate.catalogo()
    } catch {
      toast('Error al eliminar', 'error')
    } finally {
      setDeleting(null)
    }
  }

  function openEdit(p: Producto) {
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
            <div key={p.id} className="flex items-center py-3 border-b border-surface3/50 gap-2">
              {/* Main info — tappable for edit */}
              <div
                onClick={() => isAdmin && openEdit(p)}
                className={`flex-1 min-w-0 ${isAdmin ? 'cursor-pointer' : ''}`}
              >
                <div className="text-sm font-semibold text-text1">{p.producto}</div>
                <div className="text-xs text-text2 truncate">
                  {p.categoria} · {p.unidad} · 🏪 {p.proveedor}
                </div>
                <div className="text-xs text-text2">
                  Stock: <span className={p.stockActual < p.stockMinimo ? 'text-red font-semibold' : 'text-green'}>{p.stockActual}</span>
                  {' '}· Mín: {p.stockMinimo}
                  {p.pzaPaq > 1 && ` · 📦 ${p.pzaPaq}/paq`}
                  {p.precioRef > 0 && ` · $${p.precioRef.toFixed(2)}`}
                  {p.codigoBarras && ` · 🔖 ${p.codigoBarras}`}
                </div>
              </div>

              {/* Action buttons — clearly separated */}
              {isAdmin && (
                <div className="flex items-center gap-1 flex-none">
                  {/* Edit button */}
                  <button
                    onClick={() => openEdit(p)}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface2 text-text2 active:bg-surface3 transition-colors"
                    aria-label={`Editar ${p.producto}`}
                  >
                    ✏️
                  </button>
                  {/* Delete button — distinct red tint */}
                  <button
                    onClick={e => handleDelete(e, p)}
                    disabled={deleting === p.id}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-red/10 text-red active:bg-red/20 transition-colors disabled:opacity-40"
                    aria-label={`Eliminar ${p.producto}`}
                  >
                    {deleting === p.id ? '⏳' : '🗑️'}
                  </button>
                </div>
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
