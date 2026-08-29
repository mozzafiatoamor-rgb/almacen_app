/**
 * Read-only access to Google Sheets via Sheets API v4 (API Key).
 * Writes go through appscript.ts.
 */
import { getConfig, SHEET_NAMES } from './config'
import { normDate } from '../utils/dates'
import type {
  Producto,
  Movimiento,
  Merma,
  Usuario,
  BitacoraEntry,
  Gasto,
  Proveedor,
  Pedido,
  EstadoPedido,
  ProductoConteo,
  Turno,
  EstadoTurno,
  TipoTurno,
  FaseConteo,
  ConteoItem,
  Area,
} from './types'

async function readRange(sheet: string, range: string): Promise<string[][]> {
  const { sheetId, apiKey } = getConfig()
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(sheet)}!${range}?key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sheets API ${res.status}: ${text}`)
  }
  const data = await res.json()
  return (data.values as string[][] | undefined) ?? []
}

// ─── Catálogo ─────────────────────────────────────────────────────────────────

const VALID_AREAS: Area[] = ['General', 'Barra', 'Cocina', 'Ambas']
function parseArea(val: string): Area {
  const trimmed = (val ?? '').trim() as Area
  return VALID_AREAS.includes(trimmed) ? trimmed : 'General'
}

export async function fetchCatalogo(includeInactive = false): Promise<Producto[]> {
  const rows = await readRange(SHEET_NAMES.catalogo, 'A2:M500')
  return rows
    .map((r, i) => ({
      id:           r[0] ?? '',
      categoria:    r[1] ?? '',
      producto:     r[2] ?? '',
      unidad:       r[3] ?? '',
      stockMinimo:  parseInt(r[4]) || 0,
      stockActual:  parseInt(r[5]) || 0,
      activo:       (r[6] ?? 'SI').toString().trim().toUpperCase(),
      proveedor:    r[7] ?? 'Sin asignar',
      pzaPaq:       parseInt(r[8]) || 1,
      codigoBarras: r[9] ?? '',
      precioRef:    parseFloat(r[10]) || 0,
      area:         parseArea(r[11]),
      prioridad:    parseInt(r[12]) || 3,
      _row:         i + 2,
    }))
    .filter(p => p.producto && (includeInactive || p.activo !== 'NO'))
}

// ─── Movimientos ──────────────────────────────────────────────────────────────

export async function fetchMovimientos(): Promise<Movimiento[]> {
  const rows = await readRange(SHEET_NAMES.movimientos, 'A2:L3000')
  return rows
    .map((r, i) => ({
      id:          r[0] ?? '',
      fecha:       normDate(r[1] ?? ''),
      hora:        r[2] ?? '',
      tipo:        (r[3] ?? 'Entrada') as 'Entrada' | 'Salida',
      categoria:   r[4] ?? '',
      producto:    r[5] ?? '',
      cantidad:    parseInt(r[6]) || 0,
      motivo:      r[7] ?? '',
      responsable: r[8] ?? '',
      notas:       r[9] ?? '',
      precioUnit:  parseFloat(r[10]) || 0,
      areaDestino: r[11] ?? '',
      _row:        i + 2,
    }))
    .filter(m => m.producto)
    .reverse()
}

// ─── Mermas ───────────────────────────────────────────────────────────────────

export async function fetchMermas(): Promise<Merma[]> {
  const rows = await readRange(SHEET_NAMES.mermas, 'A2:I2000')
  return rows
    .map((r, i) => ({
      id:          r[0] ?? '',
      fecha:       normDate(r[1] ?? ''),
      hora:        r[2] ?? '',
      categoria:   r[3] ?? '',
      producto:    r[4] ?? '',
      cantidad:    parseInt(r[5]) || 0,
      motivo:      r[6] ?? '',
      responsable: r[7] ?? '',
      notas:       r[8] ?? '',
      _row:        i + 2,
    }))
    .filter(m => m.producto)
    .reverse()
}

// ─── Usuarios ─────────────────────────────────────────────────────────────────

export async function fetchUsuarios(): Promise<Usuario[]> {
  const rows = await readRange(SHEET_NAMES.usuarios, 'A2:F50')
  return rows
    .map((r, i) => ({
      id:      r[0] ?? '',
      usuario: r[1] ?? '',
      pin:     r[2] ?? '',       // Column C is now PIN (was password)
      nombre:  r[3] ?? '',
      rol:     ((r[4] ?? 'almacenista').toLowerCase()) as Usuario['rol'],
      activo:  (r[5] ?? 'SI').toString().trim().toUpperCase(),
      _row:    i + 2,
    }))
    .filter(u => u.usuario && u.activo !== 'NO')
}

// ─── Gastos ───────────────────────────────────────────────────────────────────

export async function fetchGastos(): Promise<Gasto[]> {
  const rows = await readRange(SHEET_NAMES.gastos, 'A2:J2000')
  return rows
    .map((r, i) => ({
      id:          r[0] ?? '',
      fecha:       normDate(r[1] ?? ''),
      hora:        r[2] ?? '',
      producto:    r[3] ?? '',
      categoria:   r[4] ?? '',
      cantidad:    parseInt(r[5]) || 0,
      precioUnit:  parseFloat(r[6]) || 0,
      total:       parseFloat(r[7]) || 0,
      proveedor:   r[8] ?? '',
      responsable: r[9] ?? '',
      _row:        i + 2,
    }))
    .filter(g => g.producto)
    .reverse()
}

// ─── Proveedores ──────────────────────────────────────────────────────────────

export async function fetchProveedores(): Promise<Proveedor[]> {
  const rows = await readRange(SHEET_NAMES.proveedores, 'A2:E200')
  return rows
    .map((r, i) => ({
      id:       r[0] ?? '',
      nombre:   r[1] ?? '',
      telefono: r[2] ?? '',
      contacto: r[3] ?? '',
      notas:    r[4] ?? '',
      _row:     i + 2,
    }))
    .filter(p => p.nombre)
}

// ─── Pedidos ──────────────────────────────────────────────────────────────────

const VALID_ESTADOS: EstadoPedido[] = ['pendiente', 'recibido', 'cancelado']

export async function fetchPedidos(): Promise<Pedido[]> {
  const rows = await readRange(SHEET_NAMES.pedidos, 'A2:J2000')
  return rows
    .map((r, i) => ({
      id:            r[0] ?? '',
      fecha:         normDate(r[1] ?? ''),
      proveedor:     r[2] ?? '',
      producto:      r[3] ?? '',
      cantidad:      parseInt(r[4]) || 0,
      unidad:        r[5] ?? '',
      precioRef:     parseFloat(r[6]) || 0,
      estado:        (VALID_ESTADOS.includes(r[7] as EstadoPedido) ? r[7] : 'pendiente') as EstadoPedido,
      fechaRecibido: normDate(r[8] ?? ''),
      responsable:   r[9] ?? '',
      _row:          i + 2,
    }))
    .filter(p => p.producto)
    .reverse()
}

// ─── ProductosConteo ──────────────────────────────────────────────────────────

export async function fetchProductosConteo(): Promise<ProductoConteo[]> {
  const rows = await readRange(SHEET_NAMES.productosConteo, 'A2:D200')
  return rows
    .map((r, i) => ({
      id:     r[0] ?? '',
      nombre: r[1] ?? '',
      unidad: r[2] ?? '',
      activo: (r[3] ?? 'SI').toString().trim().toUpperCase(),
      _row:   i + 2,
    }))
    .filter(p => p.nombre && p.activo !== 'NO')
}

// ─── Turnos ───────────────────────────────────────────────────────────────────

export async function fetchTurnos(): Promise<Turno[]> {
  const rows = await readRange(SHEET_NAMES.turnos, 'A2:H500')
  return rows
    .map((r, i) => ({
      id:          r[0] ?? '',
      fecha:       normDate(r[1] ?? ''),
      turno:       (r[2] ?? 'mañana') as TipoTurno,
      responsable: r[3] ?? '',
      horaInicio:  r[4] ?? '',
      horaFin:     r[5] ?? '',
      estado:      (r[6] ?? 'abierto') as EstadoTurno,
      notas:       r[7] ?? '',
      _row:        i + 2,
    }))
    .filter(t => t.id)
    .reverse()
}

// ─── ConteoItems ──────────────────────────────────────────────────────────────

export async function fetchConteoItems(turnoId?: string): Promise<ConteoItem[]> {
  const rows = await readRange(SHEET_NAMES.conteoItems, 'A2:I3000')
  return rows
    .map((r, i) => ({
      id:            r[0] ?? '',
      turnoId:       r[1] ?? '',
      fase:          (r[2] ?? 'inicial') as FaseConteo,
      producto:      r[3] ?? '',
      unidad:        r[4] ?? '',
      cantidad:      parseFloat(r[5]) || 0,
      hora:          r[6] ?? '',
      justificacion: r[7] ?? '',
      _row:          i + 2,
    }))
    .filter(c => c.producto && (!turnoId || c.turnoId === turnoId))
}

// ─── Bitácora ─────────────────────────────────────────────────────────────────

export async function fetchBitacora(): Promise<BitacoraEntry[]> {
  const rows = await readRange(SHEET_NAMES.bitacora, 'A2:F1500')
  return rows
    .map((r, i) => ({
      fecha:   normDate(r[0] ?? ''),
      hora:    r[1] ?? '',
      usuario: r[2] ?? '',
      accion:  r[3] ?? '',
      detalle: r[4] ?? '',
      tipo:    r[5] ?? '',
      _row:    i + 2,
    }))
    .filter(b => b.accion)
    .reverse()
    .slice(0, 500)
}
