/**
 * GastosPage — expense analysis module.
 *
 * Shows all registered purchase expenses (entries with precioUnit > 0),
 * with:
 *  - Summary cards: total spent this month, this week, total records
 *  - Bar chart: daily spend (last 14 days)
 *  - Pie chart: spend by category
 *  - Bar chart: top 10 products by total spend
 *  - Table: recent gastos with search/filter
 */
import { useState, useMemo } from 'react'
import { useGastos } from '../hooks/useSheets'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import SearchBar   from '../components/shared/SearchBar'
import FilterPills from '../components/shared/FilterPills'
import EmptyState  from '../components/shared/EmptyState'
import { today }   from '../utils/dates'

const COLORS = ['#3b82f6', '#f97316', '#22c55e', '#a855f7', '#eab308', '#ec4899', '#06b6d4', '#f43f5e']

function fmt(n: number) {
  return `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function monthStart() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function weekStart() {
  const d = new Date()
  d.setDate(d.getDate() - 6)
  return d.toISOString().slice(0, 10)
}

export default function GastosPage() {
  const { data: gastos = [], isLoading } = useGastos()
  const [query,  setQuery]  = useState('')
  const [catF,   setCatF]   = useState('todas')
  const [rango,  setRango]  = useState<'mes' | 'semana' | 'todo'>('mes')

  const todayStr = today()
  const msStart  = monthStart()
  const wsStart  = weekStart()

  // ── Summary ──────────────────────────────────────────────────────────────────
  const totalMes    = useMemo(() => gastos.filter(g => g.fecha >= msStart).reduce((s, g) => s + g.total, 0), [gastos, msStart])
  const totalSemana = useMemo(() => gastos.filter(g => g.fecha >= wsStart).reduce((s, g) => s + g.total, 0), [gastos, wsStart])
  const totalGeneral = useMemo(() => gastos.reduce((s, g) => s + g.total, 0), [gastos])

  // ── Filtered list ─────────────────────────────────────────────────────────
  const categorias = useMemo(() => [...new Set(gastos.map(g => g.categoria))].sort(), [gastos])

  const rangoStart = rango === 'mes' ? msStart : rango === 'semana' ? wsStart : '0000-00-00'

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return gastos.filter(g =>
      g.fecha >= rangoStart &&
      (catF === 'todas' || g.categoria === catF) &&
      (!q || g.producto.toLowerCase().includes(q) || g.proveedor.toLowerCase().includes(q))
    )
  }, [gastos, query, catF, rangoStart])

  // ── Chart: spend last 14 days ─────────────────────────────────────────────
  const dailyData = useMemo(() => {
    const days: Record<string, number> = {}
    // Build last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      days[d.toISOString().slice(0, 10)] = 0
    }
    for (const g of gastos.filter(g => g.fecha >= weekStart())) {
      if (g.fecha in days) days[g.fecha] += g.total
    }
    return Object.entries(days).map(([fecha, total]) => ({
      dia: fecha.slice(5),  // MM-DD
      total: Math.round(total * 100) / 100,
    }))
  }, [gastos])

  // ── Chart: by category ────────────────────────────────────────────────────
  const byCat = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const g of filtered) acc[g.categoria] = (acc[g.categoria] ?? 0) + g.total
    return Object.entries(acc)
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  // ── Chart: top products ───────────────────────────────────────────────────
  const topProducts = useMemo(() => {
    const acc: Record<string, number> = {}
    for (const g of filtered) acc[g.producto] = (acc[g.producto] ?? 0) + g.total
    return Object.entries(acc)
      .map(([name, total]) => ({ name, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [filtered])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-text2 text-sm">
        Cargando gastos…
      </div>
    )
  }

  return (
    <div className="px-4 py-4 pb-28">
      <h1 className="text-base font-bold mb-4">💰 Gastos</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <SummaryCard label="Este mes" value={fmt(totalMes)} color="text-accent" />
        <SummaryCard label="Esta semana" value={fmt(totalSemana)} color="text-green" />
        <SummaryCard label="Total" value={fmt(totalGeneral)} color="text-text1" />
      </div>

      {gastos.length === 0 ? (
        <EmptyState
          icon="💰"
          message="Sin gastos registrados. Agrega un precio al registrar una Entrada para que aparezca aquí."
        />
      ) : (
        <>
          {/* Chart: daily spend */}
          <div className="bg-surface rounded-card border border-white/[0.04] p-4 mb-4">
            <div className="text-xs font-semibold text-text2 mb-3">Gasto diario — últimos 14 días</div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="dia" tick={{ fontSize: 9, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#162030', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, fontSize: 11 }}
                  formatter={(v: number) => [fmt(v), 'Gasto']}
                />
                <Bar dataKey="total" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Filters */}
          <div className="flex gap-2 mb-2 overflow-x-auto pb-1 scrollbar-none">
            {(['mes', 'semana', 'todo'] as const).map(r => (
              <button
                key={r}
                onClick={() => setRango(r)}
                className={`flex-none text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  rango === r ? 'bg-accent text-white' : 'bg-surface2 text-text2'
                }`}
              >
                {r === 'mes' ? 'Este mes' : r === 'semana' ? 'Esta semana' : 'Todo'}
              </button>
            ))}
          </div>

          <FilterPills options={categorias} active={catF} onSelect={setCatF} allLabel="Todas" />
          <SearchBar value={query} onChange={setQuery} placeholder="Buscar producto o proveedor…" />

          {/* Filtered total */}
          {filtered.length > 0 && (
            <div className="bg-accent/10 border border-accent/30 rounded-xl px-3.5 py-2.5 mb-4 flex justify-between items-center">
              <span className="text-xs text-accent font-semibold">{filtered.length} registros</span>
              <span className="text-sm font-bold text-accent">
                {fmt(filtered.reduce((s, g) => s + g.total, 0))}
              </span>
            </div>
          )}

          {/* Charts: category + top products (side by side on wide, stacked on mobile) */}
          {byCat.length > 0 && (
            <div className="grid grid-cols-1 gap-4 mb-4">
              {/* Pie: by category */}
              <div className="bg-surface rounded-card border border-white/[0.04] p-4">
                <div className="text-xs font-semibold text-text2 mb-3">Gasto por categoría</div>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={byCat}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={65}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {byCat.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#162030', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, fontSize: 11 }}
                      formatter={(v: number) => [fmt(v), 'Total']}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Bar: top products */}
              {topProducts.length > 0 && (
                <div className="bg-surface rounded-card border border-white/[0.04] p-4">
                  <div className="text-xs font-semibold text-text2 mb-3">Top productos por gasto</div>
                  <ResponsiveContainer width="100%" height={Math.max(topProducts.length * 28, 100)}>
                    <BarChart
                      data={topProducts}
                      layout="vertical"
                      margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                    >
                      <XAxis type="number" tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={v => `$${v}`} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                      <Tooltip
                        contentStyle={{ background: '#162030', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, fontSize: 11 }}
                        formatter={(v: number) => [fmt(v), 'Total']}
                      />
                      <Bar dataKey="total" fill="#f97316" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Table */}
          {filtered.length === 0 ? (
            <EmptyState icon="🔍" message="Sin resultados para el filtro aplicado" />
          ) : (
            <div className="bg-surface rounded-card border border-white/[0.04] overflow-hidden">
              <div className="px-4 py-2.5 border-b border-surface3 flex justify-between text-[10px] font-semibold text-text2 uppercase">
                <span>Producto / Fecha</span>
                <span>Total</span>
              </div>
              {filtered.slice(0, 80).map((g, i) => (
                <div key={i} className="flex items-center px-4 py-2.5 border-b border-surface3/50 last:border-0 gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text1 truncate">{g.producto}</div>
                    <div className="text-[11px] text-text2">
                      {g.fecha} · {g.cantidad} {g.producto} · ${g.precioUnit.toFixed(2)}/u · {g.proveedor}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-yellow-400 flex-none">{fmt(g.total)}</span>
                </div>
              ))}
              {filtered.length > 80 && (
                <div className="text-center text-xs text-text2 py-3">
                  Mostrando 80 de {filtered.length} registros
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-surface rounded-card border border-white/[0.04] px-3 py-3 text-center">
      <div className={`text-sm font-bold ${color} leading-tight`}>{value}</div>
      <div className="text-[10px] text-text2 mt-0.5">{label}</div>
    </div>
  )
}
