import { useAuth } from '../../auth/AuthContext'
import { useOfflineSync } from '../../hooks/useOfflineSync'

interface Props {
  onOpenUserMenu:   () => void
  onOpenSettings:   () => void
}

export default function StatusBar({ onOpenUserMenu, onOpenSettings }: Props) {
  const { user }              = useAuth()
  const { online, pendingCount } = useOfflineSync()

  const initials = user?.nombre?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="sticky top-0 z-50 flex justify-between items-center px-4 py-3 bg-bg border-b border-white/[0.04]">
      {/* Left: connection dot + logo */}
      <div className="flex items-center gap-3">
        <div
          title={online ? 'Conectado' : 'Sin conexión'}
          className={`w-2 h-2 rounded-full transition-colors ${online ? 'bg-green' : 'bg-red'}`}
        />
        <img
          src="/logo.png"
          alt="Mozzafiato"
          className="h-8 w-auto rounded-lg object-contain"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
        {!online && (
          <span className="text-[10px] text-yellow font-semibold bg-yellow/10 px-2 py-0.5 rounded-full">
            Offline
          </span>
        )}
        {pendingCount > 0 && (
          <span className="text-[10px] text-orange font-semibold bg-orange/10 px-2 py-0.5 rounded-full">
            {pendingCount} pendiente{pendingCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Right: user badge + settings */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenUserMenu}
          className="flex items-center gap-2 bg-surface2 rounded-xl px-3 py-1.5 border-none"
        >
          <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[11px] font-bold text-white">
            {initials}
          </div>
          <span className="text-xs text-text1 font-medium max-w-[80px] truncate">{user?.nombre}</span>
        </button>
        <button
          onClick={onOpenSettings}
          className="text-lg text-text2 p-1 leading-none"
          aria-label="Configuración"
        >
          ⚙️
        </button>
      </div>
    </div>
  )
}
