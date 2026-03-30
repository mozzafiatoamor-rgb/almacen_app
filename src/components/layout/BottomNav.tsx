import { useAuth } from '../../auth/AuthContext'
import type { Tab } from '../../api/types'

interface NavItem {
  tab:   Tab
  icon:  string
  label: string
  admin?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { tab: 'home',        icon: '🏠', label: 'Inicio'     },
  { tab: 'movimientos', icon: '📥', label: 'Mov.'       },
  { tab: 'inventario',  icon: '📦', label: 'Inventario' },
  { tab: 'mermas',      icon: '⚠️', label: 'Mermas'     },
  { tab: 'catalogo',    icon: '📋', label: 'Catálogo'   },
  { tab: 'reportes',    icon: '📊', label: 'Reportes'   },
  { tab: 'bitacora',    icon: '📜', label: 'Bitácora'   },
  { tab: 'usuarios',    icon: '👥', label: 'Usuarios', admin: true },
]

interface Props {
  activeTab: Tab
  onSwitch:  (t: Tab) => void
}

export default function BottomNav({ activeTab, onSwitch }: Props) {
  const { isAdmin } = useAuth()

  const visible = NAV_ITEMS.filter(n => !n.admin || isAdmin)

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-surface border-t border-white/[0.06] flex z-[100] overflow-x-auto"
      style={{ height: '70px', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {visible.map(n => (
        <button
          key={n.tab}
          onClick={() => onSwitch(n.tab)}
          className={`
            flex-none min-w-[58px] flex flex-col items-center justify-center gap-0.5
            relative px-1 border-none text-[9px] font-medium cursor-pointer font-sans
            transition-colors
            ${activeTab === n.tab ? 'text-accent' : 'text-text2'}
          `}
        >
          {activeTab === n.tab && (
            <span className="absolute top-0 w-8 h-0.5 bg-accent rounded-b" />
          )}
          <span className="text-xl leading-none">{n.icon}</span>
          {n.label}
        </button>
      ))}
    </nav>
  )
}
