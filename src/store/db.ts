/**
 * Dexie (IndexedDB) store for offline operation queue.
 * When the app is offline, mutations are saved here and replayed on reconnect.
 */
import Dexie, { type Table } from 'dexie'

export interface OfflineOp {
  id?:       number    // auto-increment
  action:    'append' | 'delete' | 'update'
  sheet:     string
  values?:   (string | number)[]
  row?:      number
  createdAt: number    // timestamp
  retries:   number
}

class AlmacenDB extends Dexie {
  offlineOps!: Table<OfflineOp>

  constructor() {
    super('MozzafiatoAlmacen')
    this.version(1).stores({
      offlineOps: '++id, action, sheet, createdAt',
    })
  }
}

export const db = new AlmacenDB()

export async function enqueueOp(op: Omit<OfflineOp, 'id' | 'createdAt' | 'retries'>): Promise<void> {
  await db.offlineOps.add({ ...op, createdAt: Date.now(), retries: 0 })
}

export async function getPendingOps(): Promise<OfflineOp[]> {
  return db.offlineOps.orderBy('createdAt').toArray()
}

export async function removeOp(id: number): Promise<void> {
  await db.offlineOps.delete(id)
}

export async function incrementRetry(id: number): Promise<void> {
  const op = await db.offlineOps.get(id)
  if (op) await db.offlineOps.update(id, { retries: op.retries + 1 })
}

export async function getPendingCount(): Promise<number> {
  return db.offlineOps.count()
}
