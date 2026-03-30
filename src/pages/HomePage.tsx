import { useAuth } from '../auth/AuthContext'
import { useHomeStats, useStockBajo } from '../hooks/useSheets'
import StatBox from '../components/shared/StatBox'
import { today } from '../utils/dates'
import type { Tab } from '../api/types'

interface Props {
  onOpenModal: (type: 'entrada' | 'salida' | 'merma') => void
  onSwitch:    (tab: Tab) => void
}

export default function HomePage({ onOpenModal, onSwitch }: Props) {
  const { user }   = useAuth()
  const stats      = useHomeStats()
  const stockBajo  = useStockBajo()

  const rolLabel = user?.rol === 'admin'
    ? '🔑 Administrador' : user?.rol === 'encargado'
    ? '👨‍🍳 Encargado'
    : '📦 Almacenista'

  return (
    <div className="px-4 py-4 pb-24">
      {/* User banner */}
      <div className="flex items-center gap-3 bg-surface rounded-card px-4 py-3 mb-4 border border-white/[0.04]">
        <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center font-bold text-white text-lg flex-shrink-0">
          {user?.nombre?.charAt(0).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-semibold text-text1">Hola, {user?.nombre} 👋</div>
          <div className="text-xs text-text2">{rolLabel}</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <StatBox value={stats.entHoy}          label="📥 Entradas Hoy"  color="green"  />
        <StatBox value={stats.salHoy}          label="📤 Salidas Hoy"   color="orange" />
        <StatBox value={stats.stockBajoCount}  label="🚨 Stock Bajo"    color="red"    />
        <StatBox value={stats.totalProductos}  label="📦 Productos"     color="blue"   />
        {stats.merHoy > 0 && (
          <StatBox value={stats.merHoy} label="⚠️ Merma Hoy" color="red" />
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        {[
          { icon: '📥', label: 'Entrada',        action: () => onOpenModal('entrada') },
          { icon: '📤', label: 'Salida',          action: () => onOpenModal('salida')  },
          { icon: '⚠️', label: 'Merma',           action: () => onOpenModal('merma')   },
          { icon: '🛒', label: 'Lista Compras',   action: () => onSwitch('compras')    },
          { icon: '🔄', label: 'Actualizar',      action: () => window.location.reload() },
        ].map(q => (
          <button
            key={q.label}
            onClick={q.action}
            className="flex flex-col items-center gap-1.5 py-4 px-2 bg-surface rounded-card border border-white/[0.04] hover:border-accent/30 transition-colors"
          >
            <span className="text-2xl">{q.icon}</span>
            <span className="text-[11px] font-medium text-text1">{q.label}</span>
          </button>
        ))}
      </div>

      {/* Stock bajo alert */}
      {stockBajo.length > 0 && (
        <div className="bg-surface rounded-card border border-white/[0.04] mb-4 overflow-hidden">
          <div className="flex justify-between items-center px-4 py-3 border-b border-surface3">
            <span className="font-bold text-sm">🚨 Stock Bajo</span>
            <span className="text-xs bg-red/20 text-red px-2 py-0.5 rounded-full font-semibold">{stockBajo.length}</span>
          </div>
          {stats.stockBajoItems.map(p => (
            <div key={p.producto} className="flex items-center px-4 py-3 border-b border-surface3/50 last:border-0 gap-3">
              <div className="flex-1">
                <div className="text-sm font-semibold text-text1">{p.producto}</div>
                <div className="text-xs text-text2">{p.categoria} · {p.unidad} · 🏪 {p.proveedor}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-lg text-red">{p.stockActual}</div>
                <div className="text-[10px] text-text2">Mín: {p.stockMinimo} (Faltan: {p.faltante})</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Últimos movimientos */}
      <div className="bg-surface rounded-card border border-white/[0.04]">
        <div className="px-4 py-3 border-b border-surface3">
          <span className="font-bold text-sm">📥 Últimos Movimientos</span>
        </div>
        {stats.ultimosMov.length === 0 ? (
          <div className="px-4 py-6 text-sm text-text2 text-center">Sin movimientos hoy</div>
        ) : (
          stats.ultimosMov.map((m, i) => {
            const icon  = m.tipo === 'Entrada' ? '🟢' : '🔴'
            const color = m.tipo === 'Entrada' ? 'text-green' : 'text-orange'
            return (
              <div key={i} className="flex items-center px-4 py-3 border-b border-surface3/50 last:border-0">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-text1">{icon} {m.producto}</div>
                  <div className="text-xs text-text2">📅 {m.fecha} · {m.tipo} · 👤 {m.responsable}</div>
                </div>
                <span className={`font-mono font-bold ${color}`}>{m.tipo === 'Entrada' ? '+' : '-'}{m.cantidad}</span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
