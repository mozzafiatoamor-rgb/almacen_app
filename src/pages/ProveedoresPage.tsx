/**
 * ProveedoresPage — manage supplier directory.
 * Admin/encargado can add, edit suppliers.
 * All roles can view the list.
 */
import { useState } from 'react'
import { useProveedores, useInvalidate } from '../hooks/useSheets'
import { appendProveedor, updateProveedor } from '../api/appscript'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../hooks/useToast'
import { nextId } from '../utils/ids'
import type { Proveedor } from '../api/types'

const EMPTY_FORM = { nombre: '', telefono: '', contacto: '', notas: '' }

export default function ProveedoresPage() {
  const { data: proveedores = [], isLoading } = useProveedores()
  const { canManage }  = useAuth()
  const toast          = useToast()
  const invalidate     = useInvalidate()

  const [showForm,  setShowForm]  = useState(false)
  const [editing,   setEditing]   = useState<Proveedor | null>(null)
  const [form,      setForm]      = useState(EMPTY_FORM)
  const [saving,    setSaving]    = useState(false)
  const [query,     setQuery]     = useState('')

  const filtered = proveedores.filter(p =>
    !query || p.nombre.toLowerCase().includes(query.toLowerCase()) ||
    p.contacto.toLowerCase().includes(query.toLowerCase())
  )

  function openAdd() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setShowForm(true)
  }

  function openEdit(p: Proveedor) {
    setEditing(p)
    setForm({ nombre: p.nombre, telefono: p.telefono, contacto: p.contacto, notas: p.notas })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
    setForm(EMPTY_FORM)
  }

  function set(field: keyof typeof EMPTY_FORM) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSave() {
    if (!form.nombre.trim()) { toast('El nombre es obligatorio', 'error'); return }
    setSaving(true)
    try {
      if (editing) {
        await updateProveedor(editing._row, [
          editing.id, form.nombre.trim(), form.telefono.trim(),
          form.contacto.trim(), form.notas.trim(),
        ])
        toast('Proveedor actualizado')
      } else {
        const id = nextId('PV', proveedores)
        await appendProveedor([id, form.nombre.trim(), form.telefono.trim(), form.contacto.trim(), form.notas.trim()])
        toast('Proveedor agregado')
      }
      await invalidate.proveedores()
      closeForm()
    } catch (e: unknown) {
      toast(`Error: ${e instanceof Error ? e.message : 'desconocido'}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  function openWhatsApp(telefono: string) {
    if (!telefono) { toast('Sin número de WhatsApp', 'error'); return }
    const num = telefono.replace(/\D/g, '')
    window.open(`https://wa.me/${num}`, '_blank')
  }

  if (isLoading) return <div className="flex items-center justify-center py-16 text-text2 text-sm">⏳ Cargando…</div>

  return (
    <div className="px-4 py-4 pb-24">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-bold">🏪 Proveedores ({proveedores.length})</h1>
        {canManage && (
          <button
            onClick={openAdd}
            className="text-xs font-semibold bg-accent text-white px-3 py-1.5 rounded-lg"
          >
            + Agregar
          </button>
        )}
      </div>

      {/* Search */}
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Buscar proveedor…"
        className="w-full bg-surface2 border border-surface3 rounded-xl px-3 py-2.5 text-sm text-text1 placeholder-text2 outline-none focus:border-accent mb-4"
      />

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-text2 text-sm">
          {proveedores.length === 0
            ? <><div className="text-3xl mb-2">🏪</div>Sin proveedores aún{canManage && ' — agrega uno'}</>
            : 'Sin resultados'
          }
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.id} className="bg-surface rounded-card border border-white/[0.04] px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-text1">{p.nombre}</div>
                  {p.contacto && <div className="text-xs text-text2 mt-0.5">👤 {p.contacto}</div>}
                  {p.notas    && <div className="text-xs text-text2/70 mt-0.5 italic">{p.notas}</div>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {p.telefono && (
                    <button
                      onClick={() => openWhatsApp(p.telefono)}
                      className="w-9 h-9 rounded-full bg-green/10 border border-green/20 flex items-center justify-center text-base"
                      title={`WhatsApp: ${p.telefono}`}
                    >
                      📲
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => openEdit(p)}
                      className="w-9 h-9 rounded-full bg-surface2 border border-surface3 flex items-center justify-center text-base"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              </div>
              {p.telefono && (
                <div className="mt-1.5 text-[11px] text-text2 font-mono">📞 {p.telefono}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Form sheet */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-[120] bg-black/60" onClick={closeForm} />
          <div className="fixed bottom-0 left-0 right-0 z-[125] bg-[#162030] rounded-t-2xl">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>
            <div className="px-4 pb-2 flex justify-between items-center">
              <h2 className="font-bold text-sm">{editing ? '✏️ Editar proveedor' : '➕ Nuevo proveedor'}</h2>
              <button onClick={closeForm} className="text-text2 text-lg">✕</button>
            </div>

            <div className="px-4 pb-6 space-y-3">
              <Field label="Nombre *" value={form.nombre} onChange={set('nombre')} placeholder="Ej. Distribuidora XYZ" />
              <Field
                label="Teléfono WhatsApp"
                value={form.telefono}
                onChange={set('telefono')}
                placeholder="529831234567 (con código de país)"
                inputMode="numeric"
              />
              <Field label="Contacto" value={form.contacto} onChange={set('contacto')} placeholder="Nombre del representante" />
              <div>
                <label className="block text-xs font-semibold text-text2 mb-1.5">Notas</label>
                <textarea
                  value={form.notas}
                  onChange={set('notas')}
                  placeholder="Horario, condiciones, etc."
                  rows={2}
                  className="w-full bg-surface2 border border-surface3 rounded-xl px-3 py-2 text-sm text-text1 placeholder-text2 resize-none outline-none focus:border-accent"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 bg-accent text-white rounded-xl font-semibold text-sm disabled:opacity-40"
              >
                {saving ? 'Guardando…' : editing ? '💾 Guardar cambios' : '➕ Agregar proveedor'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, inputMode,
}: {
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text2 mb-1.5">{label}</label>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full bg-surface2 border border-surface3 rounded-xl px-3 py-2.5 text-sm text-text1 placeholder-text2 outline-none focus:border-accent"
      />
    </div>
  )
}
