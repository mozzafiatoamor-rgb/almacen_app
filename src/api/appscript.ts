/**
 * Write operations via Google Apps Script Web App (POST).
 * All mutations go through here so server-side stock logic runs correctly.
 */
import { getConfig, SHEET_NAMES } from './config'
import type { ApiResponse } from './types'

async function post(body: object): Promise<ApiResponse> {
  const { scriptUrl } = getConfig()
  const res = await fetch(scriptUrl, {
    method:  'POST',
    body:    JSON.stringify(body),
    // Apps Script CORS: no custom headers, mode no-cors falls back to opaque
    // so we keep default mode
  })
  const data: ApiResponse = await res.json()
  if (!data.success) throw new Error(data.error ?? 'Error desconocido')
  return data
}

// ─── Generic row operations ───────────────────────────────────────────────────

export async function appendRow(sheet: string, values: (string | number)[]): Promise<void> {
  await post({ action: 'append', sheet, values })
}

export async function deleteRow(sheet: string, row: number): Promise<void> {
  if (row < 2) throw new Error('Row inválido')
  await post({ action: 'delete', sheet, row })
}

export async function updateRow(sheet: string, row: number, values: (string | number)[]): Promise<void> {
  await post({ action: 'update', sheet, row, values })
}

// ─── Domain-specific appends ──────────────────────────────────────────────────

export async function appendMovimiento(values: (string | number)[]): Promise<void> {
  await appendRow(SHEET_NAMES.movimientos, values)
}

export async function appendMerma(values: (string | number)[]): Promise<void> {
  await appendRow(SHEET_NAMES.mermas, values)
}

export async function appendProducto(values: (string | number)[]): Promise<void> {
  await appendRow(SHEET_NAMES.catalogo, values)
}

export async function appendBitacora(values: (string | number)[]): Promise<void> {
  await appendRow(SHEET_NAMES.bitacora, values)
}

export async function appendUsuario(values: (string | number)[]): Promise<void> {
  await appendRow(SHEET_NAMES.usuarios, values)
}

export async function appendGasto(values: (string | number)[]): Promise<void> {
  await appendRow(SHEET_NAMES.gastos, values)
}

// ─── Toggle producto activo (archive / restore) ───────────────────────────────

/**
 * Sets col G (activo) of a Catálogo row to 'SI' or 'NO'.
 * Uses the generic update action — only overwrites column G.
 * The backend handleUpdate writes the full values array starting at col A,
 * so we pass a 7-element array: [id, cat, prod, unidad, min, stock, activo].
 * To avoid overwriting other cols, we use a targeted single-cell update
 * by passing a 1-element values array offset to col 7 via the row field.
 *
 * Simpler approach: we send the full 13-col row. The caller must provide
 * the full product so no data is lost. But since we only need to flip activo,
 * we use a minimal payload with just the new activo value placed at the right
 * column via a custom action. Instead, reuse `update` with a full row snapshot.
 */
export async function toggleActivo(
  sheet: string,
  row: number,
  activo: 'SI' | 'NO',
  fullRowValues: (string | number)[]
): Promise<void> {
  // fullRowValues has all columns; set index 6 (col G) to the new activo value
  const updated = [...fullRowValues]
  updated[6] = activo
  await post({ action: 'update', sheet, row, values: updated })
}

// ─── Send report via WhatsApp (employee → boss) ───────────────────────────────

export interface ReportPayload {
  reportType: 'daily' | 'urgent'
  empleado:   string
  mensaje:    string
}

export async function sendReport(payload: ReportPayload): Promise<void> {
  await post({ action: 'sendReport', ...payload })
}

// ─── Proveedores ──────────────────────────────────────────────────────────────

export async function appendProveedor(values: (string | number)[]): Promise<void> {
  await appendRow(SHEET_NAMES.proveedores, values)
}

export async function updateProveedor(row: number, values: (string | number)[]): Promise<void> {
  await updateRow(SHEET_NAMES.proveedores, row, values)
}

// ─── Pedidos ──────────────────────────────────────────────────────────────────

export async function appendPedido(values: (string | number)[]): Promise<void> {
  await appendRow(SHEET_NAMES.pedidos, values)
}

/**
 * Marks a pedido row as 'recibido' or 'cancelado'.
 * Updates cols H (estado) and I (fechaRecibido) only — passes a full row snapshot.
 */
export async function updatePedidoEstado(
  row: number,
  fullRowValues: (string | number)[],
  estado: 'recibido' | 'cancelado',
  fechaRecibido: string
): Promise<void> {
  const updated = [...fullRowValues]
  updated[7] = estado
  updated[8] = fechaRecibido
  await post({ action: 'update', sheet: SHEET_NAMES.pedidos, row, values: updated })
}

// ─── Stock reconciliation ─────────────────────────────────────────────────────

export async function reconcileStock(): Promise<void> {
  await post({ action: 'reconcile' })
}

// ─── Check Apps Script health ─────────────────────────────────────────────────

export async function pingApi(): Promise<boolean> {
  try {
    const { scriptUrl } = getConfig()
    const res = await fetch(scriptUrl)
    const data = await res.json()
    return data.status === 'ok'
  } catch {
    return false
  }
}
