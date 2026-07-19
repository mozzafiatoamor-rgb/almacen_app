import { useState, useMemo } from 'react'
import { useCatalogo, useInvalidate, getCategoriasFromCatalogo } from '../hooks/useSheets'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../hooks/useToast'
import { deleteRow, appendBitacora, toggleActivo } from '../api/appscript'
import { nowDateTime } from '../utils/dates'
import { SHEET_NAMES } from '../api/config'
import SearchBar from '../components/shared/SearchBar'
import FilterPills from '../components/shared/FilterPills'
import EmptyState from '../components/shared/EmptyState'
import Modal from '../components/layout/Modal'
import ProductoForm from '../components/forms/ProductoForm'
import AreaFilter, { AreaBadge } from '../components/shared/AreaFilter'
import type { Producto, Area } from '../api/types'

const PRIORIDAD_COLOR: Record<number, string> = {
  5: 'text-red bg-red/10 border-red/20',
  4: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  3: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  2: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  1: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
}

export default function CatalogoPage() {
  const { data: catalogoAll = [], isLoading } = useCatalogo()
  const { isAdmin, canManage, user, userArea, isAreaRestricted } = useAuth()
  const toast                                 = useToast()
  const invalidate                            = useInvalidate()

  const [query,         setQuery]        = useState('')
  const [catF,          setCatF]         = useState('todos')
  const [areaF,         setAreaF]        = useState<Area | 'todos'>('todos')
  const [showArchived,  setShowArchived] = useState(false)
  const [modal,         setModal]        = useState<'add' | 'edit' | null>(null)
  const [editProd,      setEditProd]     = useState<Producto | null>(null)
  const [deleting,      setDeleting]     = useState<string | null>(null)
  const [toggling,      setToggling]     = useState<string | null>(null)

  // Split active vs archived
  const catalogo         = useMemo(() => catalogoAll.filter(p => p.activo !== 'NO'), [catalogoAll])
  const catalogoArchived = useMemo(() => catalogoAll.filter(p => p.activo === 'NO'),  [catalogoAll])
  const displayList      = showArchived ? catalogoArchived : catalogo

  const cats = useMemo(() => getCategoriasFromCatalogo(catalogo), [catalogo])

  const filtered = useMemo(() => {
    const q            = query.toLowerCase()
    const effectiveArea = isAreaRestricted ? userArea : areaF
    return displayList.filter(p => {
      const matchQ    = !q || p.producto.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q)
      const matchCat  = catF === 'todos' || p.categoria === catF
      const matchArea = effectiveArea === 'todos' || effectiveArea === 'Todas'
        ? true
        : p.area === effectiveArea || p.area === 'Ambas'
      return matchQ && matchCat && matchArea
    })
  }, [displayList, query, catF, areaF, isAreaRestricted, userArea])

  async function handleDelete(e: React.MouseEvent, p: Producto) {
    e.stopPropagation()
    if (!confirm(`🗑️ ¿Eliminar "${p.producto}" permanentemente?\nEsta acción no se puede deshacer.\n\nTip: usa "Archivar" si solo quieres ocultarlo.`)) return
    setDeleting(p.id)
    try {
      await deleteRow(SHEET_NAMES.catalogo, p._row)
      const n = nowDateTime()
      await appendBitacora([n.date, n.time, user?.nombre ?? '', 'Producto eliminado', p.producto, 'delete']).catch(() => {})
      toast(`${p.producto} eliminado permanentemente`)
      invalidate.catalogo()
    } catch {
      toast('Error al eliminar', 'error')
    } finally {
      setDeleting(null)
    }
  }

  async function handleToggleActivo(e: React.MouseEvent, p: Producto, nuevoActivo: 'SI' | 'NO') {
    e.stopPropagation()
    const accion = nuevoActivo === 'NO' ? 'archivar' : 'restaurar'
    if (!confirm(`¿${nuevoActivo === 'NO' ? '📦 Archivar' : '♻️ Restaurar'} "${p.producto}"?`)) return
    setToggling(p.id)
    try {
      // Build full row values to pass to toggleActivo (preserves all columns)
      const fullRow: (string | number)[] = [
        p.id, p.categoria, p.producto, p.unidad,
        p.stockMinimo, p.stockActual,
        nuevoActivo,          // col G — activo
        p.proveedor, p.pzaPaq, p.codigoBarras, p.precioRef, p.area, p.prioridad,
      ]
      await toggleActivo(SHEET_NAMES.catalogo, p._row, nuevoActivo, fullRow)
      const n = nowDateTime()
      const accionLabel = nuevoActivo === 'NO' ? 'Producto archivado' : 'Producto restaurado'
      await appendBitacora([n.date, n.time, user?.nombre ?? '', accionLabel, p.producto, accion]).catch(() => {})
      toast(`${p.producto} ${nuevoActivo === 'NO' ? 'archivado' : 'restaurado'}`)
      invalidate.catalogo()
    } catch {
      toast(`Error al ${accion}`, 'error')
    } finally {
      setToggling(null)
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
        <div>
          <h1 className="text-base font-bold">
            📋 Catálogo
            {showArchived
              ? <span className="ml-1 text-text2">· {catalogoArchived.length} archivados</span>
              : <span className="ml-1 text-text2">({catalogo.length})</span>
            }
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && catalogoArchived.length > 0 && (
            <button
              onClick={() => setShowArchived(v => !v)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                showArchived
                  ? 'bg-surface2 text-accent border-accent/30'
                  : 'bg-surface2 text-text2 border-surface3'
              }`}
            >
              {showArchived ? '👁 Activos' : '📦 Archivados'}
            </button>
          )}
          {canManage && !showArchived && (
            <button
              onClick={() => { setEditProd(null); setModal('add') }}
              className="text-xs font-semibold bg-accent text-white px-3 py-1.5 rounded-lg"
            >
              + Producto
            </button>
          )}
        </div>
      </div>

      <SearchBar value={query} onChange={setQuery} placeholder="Buscar producto o categoría…" />
      {!isAreaRestricted && <AreaFilter active={areaF} onChange={setAreaF} />}
      <FilterPills options={cats} active={catF} onSelect={setCatF} />

      {filtered.length === 0
        ? <EmptyState icon={showArchived ? '📦' : '📋'} message={showArchived ? 'Sin productos archivados' : 'Sin productos'} />
        : filtered.map(p => (
            <div key={p.id} className={`flex items-center py-3 border-b border-surface3/50 gap-2 ${showArchived ? 'opacity-60' : ''}`}>
              {/* Main info — tappable for edit */}
              <div
                onClick={() => isAdmin && !showArchived && openEdit(p)}
                className={`flex-1 min-w-0 ${isAdmin && !showArchived ? 'cursor-pointer' : ''}`}
              >
                <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span className="text-sm font-semibold text-text1">{p.producto}</span>
                  <AreaBadge area={p.area} />
                  {p.prioridad >= 4 && (
                    <span className={`text-[10px] border px-1.5 py-0.5 rounded-full font-bold ${PRIORIDAD_COLOR[p.prioridad]}`}>
                      P{p.prioridad}{p.prioridad === 5 ? ' 🔴' : ''}
                    </span>
                  )}
                </div>
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

              {/* Action buttons */}
              {canManage && (
                <div className="flex items-center gap-1 flex-none">
                  {showArchived ? (
                    /* Restore button */
                    <button
                      onClick={e => handleToggleActivo(e, p, 'SI')}
                      disabled={toggling === p.id}
                      className="h-10 px-3 flex items-center justify-center rounded-xl bg-green/10 text-green active:bg-green/20 transition-colors disabled:opacity-40 text-xs font-semibold"
                    >
                      {toggling === p.id ? '⏳' : '♻️ Restaurar'}
                    </button>
                  ) : (
                    <>
                      {/* Edit — admins only */}
                      {isAdmin && (
                        <button
                          onClick={() => openEdit(p)}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface2 text-text2 active:bg-surface3 transition-colors"
                          aria-label={`Editar ${p.producto}`}
                        >✏️</button>
                      )}
                      {/* Archive button — admins + encargados */}
                      <button
                        onClick={e => handleToggleActivo(e, p, 'NO')}
                        disabled={toggling === p.id}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface2 text-text2 active:bg-surface3 transition-colors disabled:opacity-40"
                        aria-label={`Archivar ${p.producto}`}
                        title="Archivar (ocultar sin eliminar)"
                      >
                        {toggling === p.id ? '⏳' : '📦'}
                      </button>
                      {/* Delete — admins only */}
                      {isAdmin && (
                        <button
                          onClick={e => handleDelete(e, p)}
                          disabled={deleting === p.id}
                          className="w-10 h-10 flex items-center justify-center rounded-xl bg-red/10 text-red active:bg-red/20 transition-colors disabled:opacity-40"
                          aria-label={`Eliminar ${p.producto}`}
                        >
                          {deleting === p.id ? '⏳' : '🗑️'}
                        </button>
                      )}
                    </>
                  )}
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
