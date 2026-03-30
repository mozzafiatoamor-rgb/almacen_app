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
