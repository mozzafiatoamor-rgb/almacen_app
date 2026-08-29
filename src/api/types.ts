// ─── Data Models ──────────────────────────────────────────────────────────────

export type Area = 'General' | 'Barra' | 'Cocina' | 'Ambas'

export const AREAS: Area[] = ['General', 'Barra', 'Cocina', 'Ambas']

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
  codigoBarras: string   // col J — EAN-13/EAN-8
  precioRef: number      // col K — last price paid per unit
  area: Area             // col L — which area uses this product
  prioridad: number      // col M — 1 (low) to 5 (critical), default 3
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
  precioUnit: number     // col K — optional unit price (Entradas only)
  areaDestino: string    // col L — destination area (Salidas only)
  _row: number
}

export interface Gasto {
  id: string
  fecha: string
  hora: string
  producto: string
  categoria: string
  cantidad: number
  precioUnit: number
  total: number
  proveedor: string
  responsable: string
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

export type Rol = 'admin' | 'encargado' | 'almacenista' | 'barista' | 'cocinero'

export interface Usuario {
  id: string
  usuario: string
  pin: string        // replaces password — stored as plain text in the sheet
  nombre: string
  rol:    Rol
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
  precioRef: number      // for budget estimate
  area: Area             // for area filtering in ComprasPage
  prioridad: number      // 1-5 — used for sorting and urgent alerts
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
  notaConv: string    // e.g. "3 paq x6"
  precioUnit: number  // optional unit price for Entradas
  proveedor: string   // producto's proveedor (for Gastos)
  areaDestino: string // destination area for Salidas
}

export interface CartItemMerma {
  cat: string
  prod: string
  qty: number
  motivo: string
  notas: string
}

// ─── Control de turno ─────────────────────────────────────────────────────────

export type EstadoTurno = 'abierto' | 'cerrado'
export type TipoTurno   = 'mañana' | 'tarde' | 'noche'
export type FaseConteo  = 'inicial' | 'venta' | 'final'

export interface Turno {
  id:          string
  fecha:       string
  turno:       TipoTurno
  responsable: string
  horaInicio:  string
  horaFin:     string
  estado:      EstadoTurno
  notas:       string
  _row:        number
}

export interface ConteoItem {
  id:             string
  turnoId:        string
  fase:           FaseConteo
  producto:       string
  unidad:         string
  cantidad:       number
  hora:           string
  justificacion:  string
  _row:           number
}

// ─── Proveedores ──────────────────────────────────────────────────────────────

export interface Proveedor {
  id:       string
  nombre:   string
  telefono: string   // WhatsApp number, e.g. 529831234567
  contacto: string   // contact person name
  notas:    string
  _row:     number
}

// ─── Pedidos ──────────────────────────────────────────────────────────────────

export type EstadoPedido = 'pendiente' | 'recibido' | 'cancelado'

export interface Pedido {
  id:             string
  fecha:          string
  proveedor:      string
  producto:       string
  cantidad:       number
  unidad:         string
  precioRef:      number
  estado:         EstadoPedido
  fechaRecibido:  string
  responsable:    string
  _row:           number
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type Tab =
  | 'home'
  | 'movimientos'
  | 'inventario'
  | 'compras'
  | 'pedidos'
  | 'proveedores'
  | 'turno'
  | 'mermas'
  | 'catalogo'
  | 'bitacora'
  | 'reportes'
  | 'gastos'
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
  rol: Rol
}
