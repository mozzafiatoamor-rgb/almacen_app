import { useState } from 'react'
import { useUsuarios, useInvalidate } from '../hooks/useSheets'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../hooks/useToast'
import { appendUsuario, deleteRow } from '../api/appscript'
import { appendBitacora } from '../api/appscript'
import { nowDateTime } from '../utils/dates'
import { nextId } from '../utils/ids'
import { SHEET_NAMES } from '../api/config'
import Modal from '../components/layout/Modal'
import EmptyState from '../components/shared/EmptyState'
import type { Usuario, Rol } from '../api/types'

const ROLES: Rol[] = ['barista', 'cocinero', 'almacenista', 'encargado', 'admin']

const ROL_LABEL: Record<Rol, string> = {
  barista:     '🍸 Barista',
  cocinero:    '🍳 Cocinero',
  almacenista: '📦 Almacenista',
  encargado:   '👨‍🍳 Encargado',
  admin:       '🔑 Admin',
}

export default function UsuariosPage() {
  const { data: usuarios = [], isLoading } = useUsuarios()
  const { user: me }                       = useAuth()
  const toast                              = useToast()
  const invalidate                         = useInvalidate()

  const [modal,    setModal]    = useState<'add' | 'edit' | null>(null)
  const [editUser, setEditUser] = useState<Usuario | null>(null)

  function openEdit(u: Usuario) { setEditUser(u); setModal('edit') }
  function openAdd()            { setEditUser(null); setModal('add') }

  async function handleToggleActive(u: Usuario) {
    if (u.usuario === me?.usuario) { toast('No puedes desactivarte a ti mismo', 'error'); return }
    const newVal = u.activo === 'SI' ? 'NO' : 'SI'
    // delete + re-append with toggled active flag
    try {
      await deleteRow(SHEET_NAMES.usuarios, u._row)
      await appendUsuario([u.id, u.usuario, u.pin, u.nombre, u.rol, newVal])
      toast(`Usuario ${newVal === 'SI' ? 'activado' : 'desactivado'}`)
      invalidate.usuarios()
    } catch {
      toast('Error al actualizar', 'error')
    }
  }

  const rolLabel = (rol: string) => ROL_LABEL[rol as Rol] ?? rol

  if (isLoading) return <div className="flex items-center justify-center py-16 text-text2 text-sm">⏳ Cargando…</div>

  return (
    <div className="px-4 py-4 pb-24">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-base font-bold">👥 Usuarios</h1>
        <button onClick={openAdd} className="text-xs font-semibold bg-accent text-white px-3 py-1.5 rounded-lg">
          + Agregar
        </button>
      </div>

      {usuarios.length === 0
        ? <EmptyState icon="👥" message="Sin usuarios" />
        : usuarios.map(u => (
            <div key={u.id} className="flex items-center py-3 border-b border-surface3/50 gap-3">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold text-white flex-shrink-0">
                {u.nombre.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-text1">{u.nombre}</span>
                  {u.activo === 'NO' && (
                    <span className="text-[10px] bg-red/20 text-red px-1.5 py-0.5 rounded font-semibold">Inactivo</span>
                  )}
                </div>
                <div className="text-xs text-text2">@{u.usuario} · {rolLabel(u.rol)}</div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(u)}
                  className="text-text2 text-xs px-2 py-1 bg-surface2 rounded-lg hover:text-accent"
                >
                  ✏️
                </button>
                <button
                  onClick={() => handleToggleActive(u)}
                  className={`text-xs px-2 py-1 rounded-lg ${
                    u.activo === 'SI' ? 'bg-red/20 text-red' : 'bg-green/20 text-green'
                  }`}
                >
                  {u.activo === 'SI' ? '🔒' : '✅'}
                </button>
              </div>
            </div>
          ))
      }

      <Modal open={modal !== null} onClose={() => setModal(null)}>
        <UserForm
          usuarios={usuarios}
          editUser={modal === 'edit' ? editUser : null}
          currentUser={me}
          onClose={() => setModal(null)}
          onSaved={() => { invalidate.usuarios(); setModal(null) }}
        />
      </Modal>
    </div>
  )
}

// ─── User Form ─────────────────────────────────────────────────────────────────

interface UserFormProps {
  usuarios:    Usuario[]
  editUser:    Usuario | null
  currentUser: { usuario: string } | null
  onClose:     () => void
  onSaved:     () => void
}

function UserForm({ usuarios, editUser, currentUser, onClose, onSaved }: UserFormProps) {
  const toast  = useToast()
  const isEdit = !!editUser

  const [usuario, setUsuario] = useState(editUser?.usuario ?? '')
  const [nombre,  setNombre]  = useState(editUser?.nombre  ?? '')
  const [pin,     setPin]     = useState(editUser?.pin     ?? '')
  const [rol,     setRol]     = useState<Rol>(editUser?.rol ?? 'almacenista')
  const [saving,  setSaving]  = useState(false)

  async function submit() {
    if (!usuario.trim() || !nombre.trim() || !pin.trim()) { toast('Completa todos los campos', 'error'); return }
    if (pin.length < 4 || !/^\d+$/.test(pin)) { toast('El PIN debe ser 4-6 dígitos', 'error'); return }
    if (!isEdit) {
      const dup = usuarios.find(u => u.usuario.toLowerCase() === usuario.toLowerCase())
      if (dup) { toast('Ese usuario ya existe', 'error'); return }
    }

    setSaving(true)
    const n = nowDateTime()
    try {
      if (isEdit && editUser) {
        await deleteRow(SHEET_NAMES.usuarios, editUser._row)
        await appendUsuario([editUser.id, usuario, pin, nombre, rol, editUser.activo])
        await appendBitacora([n.date, n.time, currentUser?.usuario ?? '', 'Usuario editado', nombre, 'edit']).catch(() => {})
        toast(`${nombre} actualizado`)
      } else {
        const id = nextId('USR', usuarios)
        await appendUsuario([id, usuario, pin, nombre, rol, 'SI'])
        await appendBitacora([n.date, n.time, currentUser?.usuario ?? '', 'Usuario creado', nombre, 'add']).catch(() => {})
        toast(`${nombre} creado`)
      }
      onSaved()
    } catch {
      toast('Error al guardar', 'error')
    } finally {
      setSaving(false)
    }
  }

  const input = 'w-full bg-surface2 border border-surface3 rounded-card px-3.5 py-3 text-sm text-text1 outline-none focus:border-accent'

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">{isEdit ? '✏️ Editar' : '➕ Nuevo'} Usuario</h2>

      <div className="mb-3">
        <label className="block text-xs font-semibold text-text2 mb-1.5">Nombre completo</label>
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Juan García" className={input} />
      </div>
      <div className="mb-3">
        <label className="block text-xs font-semibold text-text2 mb-1.5">Usuario (login)</label>
        <input value={usuario} onChange={e => setUsuario(e.target.value.toLowerCase())} placeholder="juan.garcia" className={input} autoCapitalize="off" />
      </div>
      <div className="mb-3">
        <label className="block text-xs font-semibold text-text2 mb-1.5">PIN (4-6 dígitos)</label>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••"
          maxLength={6}
          className={input}
        />
        <p className="text-[11px] text-text2 mt-1">Solo dígitos numéricos. El usuario lo usará para ingresar.</p>
      </div>
      <div className="mb-5">
        <label className="block text-xs font-semibold text-text2 mb-1.5">Rol</label>
        <select value={rol} onChange={e => setRol(e.target.value as Rol)} className={input}>
          {ROLES.map(r => <option key={r} value={r}>{ROL_LABEL[r]}</option>)}
        </select>
      </div>

      <button disabled={saving} onClick={submit}
        className="w-full bg-accent text-white font-semibold py-3 rounded-card disabled:opacity-40 mb-2">
        {saving ? 'Guardando…' : isEdit ? '💾 Guardar' : '✅ Crear usuario'}
      </button>
      <button onClick={onClose} className="w-full bg-surface2 text-text1 font-semibold py-3 rounded-card">
        Cancelar
      </button>
    </div>
  )
}
