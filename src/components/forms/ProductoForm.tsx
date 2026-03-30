import { useState, type FormEvent } from 'react'
import type { Producto } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../hooks/useToast'
import { useInvalidate } from '../../hooks/useSheets'
import { appendProducto, appendBitacora, deleteRow } from '../../api/appscript'
import { nextId } from '../../utils/ids'
import { nowDateTime } from '../../utils/dates'
import { SHEET_NAMES } from '../../api/config'

const UNIDADES = ['pza', 'kg', 'lt', 'paq', 'caja', 'bolsa', 'bote', 'rollo', 'juego']
const BASE_PROVEEDORES = ['Sams', 'Costco', 'Pacsa Deli', 'Sin asignar']

interface Props {
  catalogo:   Producto[]
  editProd?:  Producto | null   // null = add mode
  onClose:    () => void
}

export default function ProductoForm({ catalogo, editProd, onClose }: Props) {
  const { user }    = useAuth()
  const toast       = useToast()
  const invalidate  = useInvalidate()
  const isEdit      = !!editProd

  const cats  = [...new Set(catalogo.map(p => p.categoria))].sort()
  const provs = [...new Set([...BASE_PROVEEDORES, ...catalogo.map(p => p.proveedor)])].sort()

  const [cat,      setCat]      = useState(editProd?.categoria ?? '')
  const [newCat,   setNewCat]   = useState('')
  const [nombre,   setNombre]   = useState(editProd?.producto ?? '')
  const [unidad,   setUnidad]   = useState(editProd?.unidad ?? 'pza')
  const [minimo,   setMinimo]   = useState(String(editProd?.stockMinimo ?? 0))
  const [stock,    setStock]    = useState(String(editProd?.stockActual ?? 0))
  const [prov,     setProv]     = useState(editProd?.proveedor ?? 'Sin asignar')
  const [newProv,  setNewProv]  = useState('')
  const [pzaPaq,   setPzaPaq]   = useState(String(editProd?.pzaPaq ?? 1))
  const [saving,   setSaving]   = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const finalCat  = cat === '__new__'  ? newCat.trim()  : cat
    const finalProv = prov === '__new__' ? newProv.trim() : prov
    if (!finalCat || !nombre.trim()) { toast('Completa categoría y producto', 'error'); return }
    if (cat === '__new__' && !newCat.trim()) { toast('Escribe la nueva categoría', 'error'); return }
    if (prov === '__new__' && !newProv.trim()) { toast('Escribe el nuevo proveedor', 'error'); return }

    if (!isEdit) {
      const dup = catalogo.find(p => p.producto.toLowerCase() === nombre.trim().toLowerCase())
      if (dup) { toast('Ya existe un producto con ese nombre', 'error'); return }
    }

    setSaving(true)
    const n      = nowDateTime()
    const values = [
      editProd?.id ?? nextId('ALM', catalogo),
      finalCat, nombre.trim(), unidad,
      parseInt(minimo) || 0,
      parseInt(stock)  || 0,
      'SI', finalProv,
      parseInt(pzaPaq) || 1,
    ]

    try {
      if (isEdit && editProd) {
        // delete old row + append updated (same approach as original)
        await deleteRow(SHEET_NAMES.catalogo, editProd._row)
        await appendProducto(values)
        await appendBitacora([n.date, n.time, user?.nombre ?? '', 'Producto editado', `${editProd.producto} → ${nombre}`, 'edit']).catch(() => {})
        toast(`${nombre} actualizado`)
      } else {
        await appendProducto(values)
        await appendBitacora([n.date, n.time, user?.nombre ?? '', 'Producto agregado', `${nombre} en ${finalCat}`, 'add']).catch(() => {})
        toast(`${nombre} agregado`)
      }
      invalidate.catalogo()
      onClose()
    } catch (err) {
      toast('Error al guardar: ' + (err as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <h2 className="text-lg font-bold mb-4">{isEdit ? '✏️ Editar' : '➕ Nuevo'} Producto</h2>

      <Field label="Categoría">
        <select value={cat} onChange={e => setCat(e.target.value)} className={input}>
          <option value="">Seleccionar…</option>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
          <option value="__new__">＋ Nueva categoría…</option>
        </select>
        {cat === '__new__' && (
          <input value={newCat} onChange={e => setNewCat(e.target.value)}
            placeholder="Nombre de la categoría" className={`${input} mt-1.5`} />
        )}
      </Field>

      <Field label="Nombre del producto">
        <input value={nombre} onChange={e => setNombre(e.target.value)}
          placeholder="Ej. Café en grano" className={input} required />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Unidad">
          <select value={unidad} onChange={e => setUnidad(e.target.value)} className={input}>
            {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Piezas/paquete">
          <input type="number" inputMode="numeric" min="1" value={pzaPaq}
            onChange={e => setPzaPaq(e.target.value)} className={input} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Stock mínimo">
          <input type="number" inputMode="numeric" min="0" value={minimo}
            onChange={e => setMinimo(e.target.value)} className={input} />
        </Field>
        <Field label="Stock actual">
          <input type="number" inputMode="numeric" min="0" value={stock}
            onChange={e => setStock(e.target.value)} className={input} />
        </Field>
      </div>

      <Field label="Proveedor">
        <select value={prov} onChange={e => setProv(e.target.value)} className={input}>
          {provs.map(p => <option key={p} value={p}>{p}</option>)}
          <option value="__new__">＋ Otro proveedor…</option>
        </select>
        {prov === '__new__' && (
          <input value={newProv} onChange={e => setNewProv(e.target.value)}
            placeholder="Nombre del proveedor" className={`${input} mt-1.5`} />
        )}
      </Field>

      <p className="text-[11px] text-text2 mb-4">
        Si el producto se compra en paquetes (ej. 6 jabones/caja), pon 6 en Piezas/paquete para que la conversión sea automática al registrar entradas.
      </p>

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-accent text-white font-semibold py-3 rounded-card disabled:opacity-40 mb-2"
      >
        {saving ? 'Guardando…' : (isEdit ? '💾 Guardar cambios' : '✅ Agregar producto')}
      </button>
      <button type="button" onClick={onClose}
        className="w-full bg-surface2 text-text1 font-semibold py-3 rounded-card">
        Cancelar
      </button>
    </form>
  )
}

const input = 'w-full bg-surface2 border border-surface3 rounded-card px-3.5 py-3 text-sm text-text1 outline-none focus:border-accent font-sans'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-text2 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
