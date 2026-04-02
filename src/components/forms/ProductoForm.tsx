import { useState, type FormEvent } from 'react'
import type { Producto, Area } from '../../api/types'
import { AREAS } from '../../api/types'
import { useAuth } from '../../auth/AuthContext'
import { useToast } from '../../hooks/useToast'
import { useInvalidate } from '../../hooks/useSheets'
import { appendProducto, appendBitacora, deleteRow } from '../../api/appscript'
import { nextId } from '../../utils/ids'
import { nowDateTime } from '../../utils/dates'
import { SHEET_NAMES } from '../../api/config'
import BarcodeScanner from '../shared/BarcodeScanner'

const UNIDADES = ['pza', 'kg', 'lt', 'paq', 'caja', 'bolsa', 'bote', 'rollo', 'juego']
const BASE_PROVEEDORES = ['Sams', 'Costco', 'Pacsa Deli', 'Sin asignar']

const AREA_ICONS: Record<Area, string> = {
  General: '📦',
  Barra:   '🍸',
  Cocina:  '🍳',
  Ambas:   '↔️',
}

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

  const [cat,           setCat]          = useState(editProd?.categoria ?? '')
  const [newCat,        setNewCat]       = useState('')
  const [nombre,        setNombre]       = useState(editProd?.producto ?? '')
  const [unidad,        setUnidad]       = useState(editProd?.unidad ?? 'pza')
  const [minimo,        setMinimo]       = useState(String(editProd?.stockMinimo ?? 0))
  const [stock,         setStock]        = useState(String(editProd?.stockActual ?? 0))
  const [prov,          setProv]         = useState(editProd?.proveedor ?? 'Sin asignar')
  const [newProv,       setNewProv]      = useState('')
  const [pzaPaq,        setPzaPaq]       = useState(String(editProd?.pzaPaq ?? 1))
  const [codigoBarras,  setCodigoBarras] = useState(editProd?.codigoBarras ?? '')
  const [area,          setArea]         = useState<Area>(editProd?.area ?? 'General')
  const [scanning,      setScanning]     = useState(false)

  function handleBarcodeDetected(code: string) {
    setScanning(false)
    // Check if already assigned to another product
    const existing = catalogo.find(
      p => p.codigoBarras === code && p.producto !== editProd?.producto
    )
    if (existing) {
      toast(`Código ya asignado a: ${existing.producto}`, 'error')
    } else {
      setCodigoBarras(code)
      toast(`✅ Código ${code} escaneado`)
    }
  }

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

    const n      = nowDateTime()
    const values = [
      editProd?.id ?? nextId('ALM', catalogo),
      finalCat, nombre.trim(), unidad,
      parseInt(minimo) || 0,
      parseInt(stock)  || 0,
      'SI', finalProv,
      parseInt(pzaPaq) || 1,
      codigoBarras.trim(),
      editProd?.precioRef ?? 0,
      area,
    ]

    // ── Optimistic close: dismiss modal immediately so the user doesn't
    //    wait staring at a spinner. The API call completes in the background.
    const label = nombre.trim()
    toast(isEdit ? `Actualizando ${label}…` : `Guardando ${label}…`)
    onClose()

    // Run in background (React 18 ignores setState on unmounted components)
    ;(async () => {
      try {
        if (isEdit && editProd) {
          await deleteRow(SHEET_NAMES.catalogo, editProd._row)
          await appendProducto(values)
          await appendBitacora([n.date, n.time, user?.nombre ?? '', 'Producto editado', `${editProd.producto} → ${label}`, 'edit']).catch(() => {})
          toast(`✅ ${label} actualizado`)
        } else {
          await appendProducto(values)
          await appendBitacora([n.date, n.time, user?.nombre ?? '', 'Producto agregado', `${label} en ${finalCat}`, 'add']).catch(() => {})
          toast(`✅ ${label} agregado`)
        }
        invalidate.catalogo()
      } catch (err) {
        toast('Error al guardar: ' + (err as Error).message, 'error')
        // Re-open form so user can retry — just re-invalidate so data is fresh
        invalidate.catalogo()
      }
    })()
  }

  return (
    <>
      {scanning && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setScanning(false)}
        />
      )}

      <form onSubmit={submit}>
        <h2 className="text-lg font-bold mb-4">{isEdit ? '✏️ Editar' : '➕ Nuevo'} Producto</h2>

        <Field label="Categoría">
          <select value={cat} onChange={e => setCat(e.target.value)} className={inp}>
            <option value="">Seleccionar…</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__new__">＋ Nueva categoría…</option>
          </select>
          {cat === '__new__' && (
            <input value={newCat} onChange={e => setNewCat(e.target.value)}
              placeholder="Nombre de la categoría" className={`${inp} mt-1.5`} />
          )}
        </Field>

        <Field label="Nombre del producto">
          <input value={nombre} onChange={e => setNombre(e.target.value)}
            placeholder="Ej. Café en grano" className={inp} required />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Unidad">
            <select value={unidad} onChange={e => setUnidad(e.target.value)} className={inp}>
              {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Piezas/paquete">
            <input type="number" inputMode="numeric" min="1" value={pzaPaq}
              onChange={e => setPzaPaq(e.target.value)} className={inp} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Stock mínimo">
            <input type="number" inputMode="numeric" min="0" value={minimo}
              onChange={e => setMinimo(e.target.value)} className={inp} />
          </Field>
          <Field label="Stock actual">
            <input type="number" inputMode="numeric" min="0" value={stock}
              onChange={e => setStock(e.target.value)} className={inp} />
          </Field>
        </div>

        <Field label="Proveedor">
          <select value={prov} onChange={e => setProv(e.target.value)} className={inp}>
            {provs.map(p => <option key={p} value={p}>{p}</option>)}
            <option value="__new__">＋ Otro proveedor…</option>
          </select>
          {prov === '__new__' && (
            <input value={newProv} onChange={e => setNewProv(e.target.value)}
              placeholder="Nombre del proveedor" className={`${inp} mt-1.5`} />
          )}
        </Field>

        {/* Área */}
        <Field label="Área de uso">
          <div className="grid grid-cols-4 gap-1.5">
            {AREAS.map(a => (
              <button
                key={a}
                type="button"
                onClick={() => setArea(a)}
                className={`flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs font-semibold transition-all border ${
                  area === a
                    ? 'bg-accent text-white border-accent shadow-sm'
                    : 'bg-surface2 text-text2 border-surface3'
                }`}
              >
                <span className="text-base">{AREA_ICONS[a]}</span>
                <span>{a}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-text2 mt-1.5">
            ↔️ "Ambas" para productos que usan Barra y Cocina
          </p>
        </Field>

        {/* Código de barras */}
        <Field label="Código de barras (EAN-13 / EAN-8)">
          <div className="flex gap-2">
            <input
              value={codigoBarras}
              onChange={e => setCodigoBarras(e.target.value)}
              placeholder="Escanea o escribe el código"
              inputMode="numeric"
              className={`${inp} flex-1`}
            />
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="w-11 h-11 rounded-card bg-surface2 border border-surface3 flex items-center justify-center text-lg flex-none"
              title="Escanear"
            >
              📷
            </button>
          </div>
          {codigoBarras && (
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[11px] font-mono text-accent">{codigoBarras}</span>
              <button
                type="button"
                onClick={() => setCodigoBarras('')}
                className="text-[11px] text-red"
              >
                Quitar
              </button>
            </div>
          )}
        </Field>

        <p className="text-[11px] text-text2 mb-4">
          Si el producto se compra en paquetes (ej. 6 jabones/caja), pon 6 en Piezas/paquete para que la conversión sea automática al registrar entradas.
        </p>

        <button
          type="submit"
          className="w-full bg-accent text-white font-semibold py-3 rounded-card mb-2"
        >
          {isEdit ? '💾 Guardar cambios' : '✅ Agregar producto'}
        </button>
        <button type="button" onClick={onClose}
          className="w-full bg-surface2 text-text1 font-semibold py-3 rounded-card">
          Cancelar
        </button>
      </form>
    </>
  )
}

const inp = 'w-full bg-surface2 border border-surface3 rounded-card px-3.5 py-3 text-sm text-text1 outline-none focus:border-accent font-sans'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-text2 mb-1.5">{label}</label>
      {children}
    </div>
  )
}
