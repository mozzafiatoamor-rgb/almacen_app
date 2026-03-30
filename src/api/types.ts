// ─── Data Models ──────────────────────────────────────────────────────────────

export interface Producto {
  id: string
  categoria: string
  producto: string
  unidad: string
  stockMinimo: number
  stockActual: number
  activo: string
  proveedor: string
  pzaPaq: number
  _row: number
}

export interface Movimiento {
  id: string
  fecha: string
  hora: string
  tipo: 'Entrada' | 'Salida'
  categoria: string
  producto: string
  cantidad: number
  motivo: string
  responsable: string
  notas: string
  _row: number
}

export interface Merma {
  id: string
  fecha: string
  hora: string
  categoria: string
  producto: string
  cantidad: number
  motivo: string
  responsable: string
  notas: string
  _row: number
}

export interface Usuario {
  id: string
  usuario: string
  pin: string        // replaces password — stored as plain text in the sheet
  nombre: string
  rol: 'admin' | 'encargado' | 'almacenista'
  activo: string
  _row: number
}

export interface BitacoraEntry {
  fecha: string
  hora: string
  usuario: string
  accion: string
  detalle: string
  tipo: string
  _row: number
}

export interface StockBajo {
  categoria: string
  producto: string
  unidad: string
  stockActual: number
  stockMinimo: number
  faltante: number
  proveedor: string
}

// ─── App config stored in localStorage ────────────────────────────────────────

export interface AppConfig {
  sheetId: string
  apiKey: string
  scriptUrl: string
}

// ─── Cart items (used in MovimientoForm and MermaForm) ────────────────────────

export interface CartItemMov {
  cat: string
  prod: string
  qty: number
  tipo: 'Entrada' | 'Salida'
  motivo: string
  notas: string
  notaConv: string   // e.g. "3 paq x6"
}

export interface CartItemMerma {
  cat: string
  prod: string
  qty: number
  motivo: string
  notas: string
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type Tab =
  | 'home'
  | 'movimientos'
  | 'inventario'
  | 'compras'
  | 'mermas'
  | 'catalogo'
  | 'bitacora'
  | 'reportes'
  | 'usuarios'

// ─── Modal ────────────────────────────────────────────────────────────────────

export type ModalType =
  | 'entrada'
  | 'salida'
  | 'merma'
  | 'addProduct'
  | 'editProduct'
  | 'addUser'
  | 'editUser'
  | 'settings'
  | 'userMenu'
  | null

// ─── Apps Script responses ────────────────────────────────────────────────────

export interface ApiResponse {
  success: boolean
  error?: string
}

// ─── Current user (stored in session) ────────────────────────────────────────

export interface CurrentUser {
  id: string
  usuario: string
  nombre: string
  rol: 'admin' | 'encargado' | 'almacenista'
}
