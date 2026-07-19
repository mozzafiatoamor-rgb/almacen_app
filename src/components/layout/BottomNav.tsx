/**
 * BottomNav — Speed Dial pattern.
 *
 * A single circular FAB (☰) sits at the bottom-center of the screen.
 * Tapping it triggers a staggered Framer Motion animation that fans all
 * navigation items upward as circular icon buttons with labels.
 * Tapping outside (or an item) closes the dial.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../auth/AuthContext'
import type { Tab } from '../../api/types'

interface NavItem {
  tab:         Tab
  icon:        string
  label:       string
  admin?:      boolean   // only for admin
  restricted?: boolean   // hidden for barista/cocinero
}

const NAV_ITEMS: NavItem[] = [
  { tab: 'home',        icon: '🏠', label: 'Inicio'                          },
  { tab: 'movimientos', icon: '📥', label: 'Mov.'                            },
  { tab: 'inventario',  icon: '📦', label: 'Inventario'                      },
  { tab: 'compras',     icon: '🛒', label: 'Compras',    restricted: true    },
  { tab: 'mermas',      icon: '⚠️', label: 'Mermas',     restricted: true    },
  { tab: 'catalogo',    icon: '📋', label: 'Catálogo',   restricted: true    },
  { tab: 'reportes',    icon: '📊', label: 'Reportes',   restricted: true    },
  { tab: 'gastos',      icon: '💰', label: 'Gastos',     restricted: true    },
  { tab: 'bitacora',    icon: '📜', label: 'Bitácora',   restricted: true    },
  { tab: 'usuarios',    icon: '👥', label: 'Usuarios',   admin: true         },
]

interface Props {
  activeTab: Tab
  onSwitch:  (t: Tab) => void
}

// Items per column — we'll show 2 columns of 5
const ITEMS_PER_COL = 5

export default function BottomNav({ activeTab, onSwitch }: Props) {
  const { isAdmin, isAreaRestricted } = useAuth()
  const [open, setOpen] = useState(false)

  const visible = NAV_ITEMS.filter(n => {
    if (n.admin       && !isAdmin)          return false
    if (n.restricted  && isAreaRestricted)  return false
    return true
  })

  // Split into two columns: left col, right col
  const leftCol  = visible.filter((_, i) => i % 2 === 0)
  const rightCol = visible.filter((_, i) => i % 2 !== 0)

  function selectTab(t: Tab) {
    setOpen(false)
    onSwitch(t)
  }

  // Current tab label for FAB tooltip
  const current = visible.find(n => n.tab === activeTab)

  return (
    <>
      {/* Backdrop — closes dial on outside tap */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Speed Dial items */}
      <AnimatePresence>
        {open && (
          <div
            className="fixed bottom-[90px] left-0 right-0 z-[100] flex justify-center gap-6 px-4 pointer-events-none"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Left column */}
            <div className="flex flex-col-reverse gap-3 items-end pointer-events-auto">
              {leftCol.map((item, i) => (
                <DialItem
                  key={item.tab}
                  item={item}
                  index={i}
                  isActive={activeTab === item.tab}
                  onSelect={() => selectTab(item.tab)}
                  labelSide="right"
                />
              ))}
            </div>

            {/* Right column */}
            <div className="flex flex-col-reverse gap-3 items-start pointer-events-auto">
              {rightCol.map((item, i) => (
                <DialItem
                  key={item.tab}
                  item={item}
                  index={i}
                  isActive={activeTab === item.tab}
                  onSelect={() => selectTab(item.tab)}
                  labelSide="left"
                />
              ))}
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Fixed bottom bar with FAB */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[110] flex justify-center items-end pb-5"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        {/* Current tab label (above FAB) */}
        <AnimatePresence>
          {!open && current && (
            <motion.span
              key="cur-label"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute bottom-[78px] text-[10px] text-text2 font-medium pointer-events-none"
              style={{ bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }}
            >
              {current.icon} {current.label}
            </motion.span>
          )}
        </AnimatePresence>

        {/* FAB */}
        <motion.button
          onClick={() => setOpen(v => !v)}
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 24 }}
          className="w-14 h-14 rounded-full bg-accent shadow-lg shadow-accent/40 flex items-center justify-center text-white text-2xl select-none"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {open ? '✕' : '☰'}
        </motion.button>
      </div>
    </>
  )
}

// ─── Individual dial item ─────────────────────────────────────────────────────

interface DialItemProps {
  item:      NavItem
  index:     number
  isActive:  boolean
  onSelect:  () => void
  labelSide: 'left' | 'right'
}

function DialItem({ item, index, isActive, onSelect, labelSide }: DialItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.7 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{ opacity: 0, y: 16,    scale: 0.7  }}
      transition={{
        type:      'spring',
        stiffness: 380,
        damping:   26,
        delay:     index * 0.04,
      }}
      className="flex items-center gap-2.5"
    >
      {/* Label — left side shows right of button, right side shows left of button */}
      {labelSide === 'left' && (
        <span className="text-[11px] font-semibold text-white bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-lg whitespace-nowrap">
          {item.label}
        </span>
      )}

      {/* Circle button */}
      <button
        onClick={onSelect}
        className={`
          w-12 h-12 rounded-full flex items-center justify-center text-xl
          shadow-md transition-transform active:scale-95
          ${isActive
            ? 'bg-accent text-white shadow-accent/40'
            : 'bg-surface border border-white/10 text-text1'
          }
        `}
        style={{ WebkitTapHighlightColor: 'transparent' }}
        aria-label={item.label}
      >
        {item.icon}
      </button>

      {labelSide === 'right' && (
        <span className="text-[11px] font-semibold text-white bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-lg whitespace-nowrap">
          {item.label}
        </span>
      )}
    </motion.div>
  )
}
