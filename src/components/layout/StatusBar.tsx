import { useAuth, type AreaFiltro } from '../../auth/AuthContext'
import { useOfflineSync } from '../../hooks/useOfflineSync'

interface Props {
  onOpenUserMenu:   () => void
  onOpenSettings:   () => void
}

const AREA_OPTS: { key: AreaFiltro; icon: string; label: string }[] = [
  { key: 'Todas',   icon: '🏠', label: 'Todas'   },
  { key: 'General', icon: '📦', label: 'General'  },
  { key: 'Barra',   icon: '🍸', label: 'Barra'    },
  { key: 'Cocina',  icon: '🍳', label: 'Cocina'   },
]

const CHIP_ACTIVE: Record<AreaFiltro, string> = {
  Todas:   'bg-accent text-white',
  General: 'bg-blue-500/80 text-white',
  Barra:   'bg-purple-500/80 text-white',
  Cocina:  'bg-orange-500/80 text-white',
  Ambas:   'bg-teal-500/80 text-white',
}

export default function StatusBar({ onOpenUserMenu, onOpenSettings }: Props) {
  const { user, areaFiltro, setAreaFiltro, isAreaRestricted } = useAuth()
  const { online, pendingCount } = useOfflineSync()

  const initials = user?.nombre?.charAt(0).toUpperCase() ?? '?'

  return (
    <div className="sticky top-0 z-50 bg-bg border-b border-white/[0.04]">
      {/* Top row: logo + user */}
      <div className="flex justify-between items-center px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div
            title={online ? 'Conectado' : 'Sin conexión'}
            className={`w-2 h-2 rounded-full transition-colors flex-none ${online ? 'bg-green' : 'bg-red'}`}
          />
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="Mozzafiato"
            className="h-7 w-auto object-contain"
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

      {/* Area filter chips row */}
      <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-none">
        {AREA_OPTS.map(opt => {
          const isActive = areaFiltro === opt.key
          // Restricted users (barista/cocinero) can still switch, but we mark their default
          const disabled = isAreaRestricted && opt.key !== areaFiltro && opt.key !== 'Todas'
          return (
            <button
              key={opt.key}
              onClick={() => setAreaFiltro(opt.key)}
              disabled={disabled}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap flex-none transition-all
                ${isActive
                  ? `${CHIP_ACTIVE[opt.key]} shadow-sm`
                  : disabled
                    ? 'bg-surface2/40 text-text2/40 border border-white/[0.04] cursor-not-allowed'
                    : 'bg-surface2 text-text2 border border-white/[0.06] active:scale-95'
                }`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
