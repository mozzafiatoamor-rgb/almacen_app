/**
 * AreaFilter — Horizontal scrollable pills for filtering by product area.
 * Options: Todos | General | Barra | Cocina | Ambas
 */
import type { Area } from '../../api/types'

const AREA_ICONS: Record<Area | 'todos', string> = {
  todos:   '🏠',
  General: '📦',
  Barra:   '🍸',
  Cocina:  '🍳',
  Ambas:   '↔️',
}

const AREA_COLORS: Record<Area | 'todos', string> = {
  todos:   'bg-accent text-white',
  General: 'bg-blue-500/80 text-white',
  Barra:   'bg-purple-500/80 text-white',
  Cocina:  'bg-orange-500/80 text-white',
  Ambas:   'bg-teal-500/80 text-white',
}

const AREA_INACTIVE: Record<Area | 'todos', string> = {
  todos:   'bg-surface2 text-text2',
  General: 'bg-blue-500/10 text-blue-400',
  Barra:   'bg-purple-500/10 text-purple-400',
  Cocina:  'bg-orange-500/10 text-orange-400',
  Ambas:   'bg-teal-500/10 text-teal-400',
}

type FilterArea = Area | 'todos'

interface Props {
  active:   FilterArea
  onChange: (area: FilterArea) => void
}

const OPTIONS: FilterArea[] = ['todos', 'General', 'Barra', 'Cocina', 'Ambas']

export default function AreaFilter({ active, onChange }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-none">
      {OPTIONS.map(opt => {
        const isActive = active === opt
        const color = isActive ? AREA_COLORS[opt] : AREA_INACTIVE[opt]
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap flex-none transition-all ${color} ${isActive ? 'shadow-sm' : 'border border-white/[0.06]'}`}
          >
            <span>{AREA_ICONS[opt]}</span>
            <span>{opt === 'todos' ? 'Todas' : opt}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Badge shown on products with area = 'Ambas' */
export function BadgeCompartido() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] bg-teal-500/15 text-teal-400 border border-teal-500/20 px-1.5 py-0.5 rounded-full font-semibold flex-none">
      ↔ Compartido
    </span>
  )
}

/** Small area pill (non-interactive) — used in product rows */
export function AreaBadge({ area }: { area: Area }) {
  if (area === 'General') return null  // General is the default, no badge needed
  const icons: Record<Area, string> = { General: '📦', Barra: '🍸', Cocina: '🍳', Ambas: '↔️' }
  const colors: Record<Area, string> = {
    General: '',
    Barra:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
    Cocina:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
    Ambas:   'bg-teal-500/10 text-teal-400 border-teal-500/20',
  }
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] border px-1.5 py-0.5 rounded-full font-semibold flex-none ${colors[area]}`}>
      {icons[area]} {area === 'Ambas' ? '↔ Compartido' : area}
    </span>
  )
}
