import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchUsuarios } from '../api/sheets'
import { useAuth } from './AuthContext'
import type { Usuario } from '../api/types'

const PIN_LENGTH = 4

export default function LoginScreen() {
  const { login } = useAuth()
  const [selected, setSelected] = useState<Usuario | null>(null)
  const [pin, setPin]           = useState('')
  const [error, setError]       = useState('')

  const { data: usuarios = [], isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn:  fetchUsuarios,
    staleTime: 60_000,
  })

  function selectUser(u: Usuario) {
    setSelected(u)
    setPin('')
    setError('')
  }

  function handleDigit(d: string) {
    if (pin.length >= PIN_LENGTH) return
    const next = pin + d
    setPin(next)
    if (next.length === PIN_LENGTH) {
      setTimeout(() => verifyPin(next), 80) // tiny delay so last dot renders
    }
  }

  function verifyPin(attempt: string) {
    if (!selected) return
    if (attempt === selected.pin) {
      login({ id: selected.id, usuario: selected.usuario, nombre: selected.nombre, rol: selected.rol })
    } else {
      setError('PIN incorrecto')
      setPin('')
    }
  }

  function handleDelete() {
    setPin(p => p.slice(0, -1))
    setError('')
  }

  const rolLabel = (rol: string) =>
    rol === 'admin'      ? '🔑 Administrador' :
    rol === 'encargado'  ? '👨‍🍳 Encargado'     :
                           '📦 Almacenista'

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-10">
      <img
        src="/logo.png"
        alt="Mozzafiato"
        className="w-16 h-16 rounded-xl mb-4 object-contain"
        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
      <h1 className="text-lg font-bold text-text1 mb-1">Iniciar sesión</h1>

      {!selected ? (
        <>
          <p className="text-text2 text-sm mb-6">Selecciona tu usuario</p>
          {isLoading ? (
            <p className="text-text2 text-sm">Cargando usuarios…</p>
          ) : usuarios.length === 0 ? (
            <p className="text-red text-sm">No se encontraron usuarios en el Sheet</p>
          ) : (
            <div className="w-full max-w-xs flex flex-col gap-2">
              {usuarios.map(u => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className="flex items-center gap-3 bg-surface rounded-card px-4 py-3 border border-surface3 hover:border-accent transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold text-white text-base flex-shrink-0">
                    {u.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text1">{u.nombre}</div>
                    <div className="text-xs text-text2">{rolLabel(u.rol)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {/* User banner */}
          <div className="flex items-center gap-3 bg-surface rounded-card px-4 py-3 mb-6 w-full max-w-xs border border-surface3">
            <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center font-bold text-white text-base flex-shrink-0">
              {selected.nombre.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-text1">{selected.nombre}</div>
              <div className="text-xs text-text2">{rolLabel(selected.rol)}</div>
            </div>
            <button onClick={() => setSelected(null)} className="text-text2 text-xs hover:text-red transition-colors">
              cambiar
            </button>
          </div>

          <p className="text-text2 text-sm mb-4">Ingresa tu PIN de {PIN_LENGTH} dígitos</p>

          {/* PIN dots */}
          <div className="flex gap-4 mb-2">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full border-2 transition-all ${
                  i < pin.length ? 'bg-accent border-accent' : 'border-surface3 bg-transparent'
                }`}
              />
            ))}
          </div>

          {error && <p className="text-red text-xs mb-3 animate-fade-in">{error}</p>}

          {/* Numeric keypad */}
          <div className="grid grid-cols-3 gap-3 mt-4 w-full max-w-xs">
            {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
              k === '' ? (
                <div key={i} />
              ) : (
                <button
                  key={i}
                  onClick={() => k === '⌫' ? handleDelete() : handleDigit(k)}
                  className={`h-14 rounded-xl font-mono font-bold text-xl transition-all active:scale-95 ${
                    k === '⌫'
                      ? 'bg-surface2 text-red text-base'
                      : 'bg-surface text-text1 border border-surface3 hover:border-accent hover:bg-surface2'
                  }`}
                >
                  {k}
                </button>
              )
            ))}
          </div>
        </>
      )}
    </div>
  )
}
