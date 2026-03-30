import { useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { useMovimientos, useMermas, useCatalogo } from '../hooks/useSheets'

const COLORS = ['#3b82f6', '#34d399', '#fb923c', '#f87171', '#fbbf24', '#22d3ee', '#a78bfa']

export default function ReportesPage() {
  const { data: movimientos = [] } = useMovimientos()
  const { data: mermas = [] }      = useMermas()
  const { data: catalogo = [] }    = useCatalogo()

  // Movimientos por día (últimos 14 días)
  const movByDay = useMemo(() => {
    const map: Record<string, { fecha: string; entradas: number; salidas: number }> = {}
    for (const m of movimientos) {
      if (!map[m.fecha]) map[m.fecha] = { fecha: m.fecha, entradas: 0, salidas: 0 }
      if (m.tipo === 'Entrada') map[m.fecha].entradas += m.cantidad
      else map[m.fecha].salidas += m.cantidad
    }
    return Object.values(map)
      .sort((a, b) => a.fecha.localeCompare(b.fecha))
      .slice(-14)
      .map(d => ({ ...d, fecha: d.fecha.substring(0, 5) })) // DD/MM
  }, [movimientos])

  // Top 10 productos por consumo (salidas)
  const topProductos = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of movimientos.filter(m => m.tipo === 'Salida')) {
      map[m.producto] = (map[m.producto] ?? 0) + m.cantidad
    }
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, value]) => ({ name: name.substring(0, 18), value }))
  }, [movimientos])

  // Mermas por motivo
  const mermasByMotivo = useMemo(() => {
    const map: Record<string, number> = {}
    for (const m of mermas) {
      const key = m.motivo.split(' ')[0] // first word as key
      map[key] = (map[key] ?? 0) + m.cantidad
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }))
  }, [mermas])

  // Categorías de stock bajo
  const stockPorCategoria = useMemo(() => {
    const map: Record<string, { total: number; bajo: number }> = {}
    for (const p of catalogo) {
      if (!map[p.categoria]) map[p.categoria] = { total: 0, bajo: 0 }
      map[p.categoria].total++
      if (p.stockMinimo > 0 && p.stockActual < p.stockMinimo) map[p.categoria].bajo++
    }
    return Object.entries(map).map(([name, v]) => ({ name, ...v }))
  }, [catalogo])

  const tooltip = { contentStyle: { background: '#162030', border: '1px solid #2a3d56', borderRadius: '10px', fontSize: '12px' }, labelStyle: { color: '#e0eaf4' } }

  return (
    <div className="px-4 py-4 pb-24">
      <h1 className="text-base font-bold mb-5">📊 Reportes</h1>

      {/* Entradas vs Salidas por día */}
      <Section title="📥📤 Movimientos últimos 14 días">
        {movByDay.length < 2
          ? <Empty />
          : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={movByDay} barSize={8}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3d56" />
                <XAxis dataKey="fecha" tick={{ fill: '#7a94b0', fontSize: 10 }} />
                <YAxis tick={{ fill: '#7a94b0', fontSize: 10 }} />
                <Tooltip {...tooltip} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#7a94b0' }} />
                <Bar dataKey="entradas" name="Entradas" fill="#34d399" radius={[3, 3, 0, 0]} />
                <Bar dataKey="salidas"  name="Salidas"  fill="#fb923c" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )
        }
      </Section>

      {/* Top productos por consumo */}
      <Section title="🏆 Top 10 Productos por Consumo">
        {topProductos.length === 0
          ? <Empty />
          : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={topProductos} layout="vertical" barSize={10} margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3d56" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#7a94b0', fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#e0eaf4', fontSize: 10 }} width={90} />
                <Tooltip {...tooltip} />
                <Bar dataKey="value" name="Salidas" fill="#3b82f6" radius={[0, 3, 3, 0]}>
                  {topProductos.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )
        }
      </Section>

      {/* Mermas por motivo */}
      <Section title="⚠️ Mermas por Motivo">
        {mermasByMotivo.length === 0
          ? <Empty msg="Sin mermas registradas" />
          : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={mermasByMotivo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {mermasByMotivo.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip {...tooltip} />
              </PieChart>
            </ResponsiveContainer>
          )
        }
      </Section>

      {/* Stock por categoría */}
      <Section title="📦 Stock Bajo por Categoría">
        {stockPorCategoria.length === 0
          ? <Empty />
          : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stockPorCategoria} barSize={12}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a3d56" />
                <XAxis dataKey="name" tick={{ fill: '#7a94b0', fontSize: 9 }} />
                <YAxis tick={{ fill: '#7a94b0', fontSize: 10 }} />
                <Tooltip {...tooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="total" name="Total"     fill="#3b82f6" radius={[3,3,0,0]} />
                <Bar dataKey="bajo"  name="Bajo stock" fill="#f87171" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )
        }
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface rounded-card border border-white/[0.04] mb-4 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface3 text-sm font-bold">{title}</div>
      <div className="p-3">{children}</div>
    </div>
  )
}

function Empty({ msg = 'Sin datos suficientes' }: { msg?: string }) {
  return <p className="text-center text-text2 text-sm py-8">{msg}</p>
}
