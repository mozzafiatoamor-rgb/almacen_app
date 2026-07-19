/**
 * React Query hooks for all data reads.
 * Mutations (writes) are done inline in each form/page using appendRow, etc.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchCatalogo,
  fetchMovimientos,
  fetchMermas,
  fetchUsuarios,
  fetchBitacora,
  fetchGastos,
} from '../api/sheets'
import { today } from '../utils/dates'
import type { StockBajo, Producto } from '../api/types'

// Stale times
const STALE_CATALOGO    = 5 * 60_000   // 5 min  (changes infrequently)
const STALE_MOVIMIENTOS = 2 * 60_000   // 2 min
const STALE_MERMAS      = 2 * 60_000
const STALE_USUARIOS    = 10 * 60_000  // 10 min
const STALE_BITACORA    = 5 * 60_000
const STALE_GASTOS      = 2 * 60_000

export function useCatalogo() {
  return useQuery({
    queryKey:  ['catalogo'],
    queryFn:   fetchCatalogo,
    staleTime: STALE_CATALOGO,
  })
}

export function useMovimientos() {
  return useQuery({
    queryKey:  ['movimientos'],
    queryFn:   fetchMovimientos,
    staleTime: STALE_MOVIMIENTOS,
  })
}

export function useMermas() {
  return useQuery({
    queryKey:  ['mermas'],
    queryFn:   fetchMermas,
    staleTime: STALE_MERMAS,
  })
}

export function useUsuarios() {
  return useQuery({
    queryKey:  ['usuarios'],
    queryFn:   fetchUsuarios,
    staleTime: STALE_USUARIOS,
  })
}

export function useBitacora() {
  return useQuery({
    queryKey:  ['bitacora'],
    queryFn:   fetchBitacora,
    staleTime: STALE_BITACORA,
  })
}

export function useGastos() {
  return useQuery({
    queryKey:  ['gastos'],
    queryFn:   fetchGastos,
    staleTime: STALE_GASTOS,
  })
}

// ─── Derived data ─────────────────────────────────────────────────────────────

export function useStockBajo(): StockBajo[] {
  const { data: catalogo = [] } = useCatalogo()
  return catalogo
    .filter(p => p.stockMinimo > 0 && p.stockActual < p.stockMinimo)
    .map(p => ({
      categoria:   p.categoria,
      producto:    p.producto,
      unidad:      p.unidad,
      stockActual: p.stockActual,
      stockMinimo: p.stockMinimo,
      faltante:    p.stockMinimo - p.stockActual,
      proveedor:   p.proveedor,
      precioRef:   p.precioRef,
      area:        p.area,
      prioridad:   p.prioridad,
    }))
    .sort((a, b) => b.prioridad - a.prioridad)
}

export function useHomeStats() {
  const { data: movimientos = [] } = useMovimientos()
  const { data: mermas = [] }      = useMermas()
  const { data: catalogo = [] }    = useCatalogo()
  const stockBajo                  = useStockBajo()
  const todayStr                   = today()

  const entHoy = movimientos
    .filter(m => m.fecha === todayStr && m.tipo === 'Entrada')
    .reduce((s, m) => s + m.cantidad, 0)

  const salHoy = movimientos
    .filter(m => m.fecha === todayStr && m.tipo === 'Salida')
    .reduce((s, m) => s + m.cantidad, 0)

  const merHoy = mermas
    .filter(m => m.fecha === todayStr)
    .reduce((s, m) => s + m.cantidad, 0)

  return {
    entHoy,
    salHoy,
    merHoy,
    stockBajoCount: stockBajo.length,
    totalProductos:  catalogo.length,
    ultimosMov:      movimientos.slice(0, 5),
    stockBajoItems:  stockBajo.slice(0, 8),
  }
}

// ─── Invalidation helpers ─────────────────────────────────────────────────────

export function useInvalidate() {
  const qc = useQueryClient()
  return {
    catalogo:    () => qc.invalidateQueries({ queryKey: ['catalogo'] }),
    movimientos: () => qc.invalidateQueries({ queryKey: ['movimientos'] }),
    mermas:      () => qc.invalidateQueries({ queryKey: ['mermas'] }),
    usuarios:    () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
    bitacora:    () => qc.invalidateQueries({ queryKey: ['bitacora'] }),
    gastos:      () => qc.invalidateQueries({ queryKey: ['gastos'] }),
    all:         () => qc.invalidateQueries(),
  }
}

// ─── Offline-aware append helper ──────────────────────────────────────────────

export function getCategoriasFromCatalogo(catalogo: Producto[]): string[] {
  return [...new Set(catalogo.map(p => p.categoria))].sort()
}

export function getProveedoresFromCatalogo(catalogo: Producto[]): string[] {
  return [...new Set(catalogo.map(p => p.proveedor))].sort()
}
