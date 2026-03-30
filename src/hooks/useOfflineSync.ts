/**
 * Watches network status and replays queued offline operations when back online.
 */
import { useEffect, useState } from 'react'
import { getConfig } from '../api/config'
import { getPendingOps, removeOp, incrementRetry, getPendingCount, type OfflineOp } from '../store/db'
import { useToast } from './useToast'
import { useInvalidate } from './useSheets'

const MAX_RETRIES = 3

async function executeOp(op: OfflineOp): Promise<void> {
  const { scriptUrl } = getConfig()
  const body: Record<string, unknown> = { action: op.action, sheet: op.sheet }
  if (op.values) body['values'] = op.values
  if (op.row)    body['row']    = op.row

  const res  = await fetch(scriptUrl, { method: 'POST', body: JSON.stringify(body) })
  const data = await res.json()
  if (!data.success) throw new Error(data.error)
}

export function useOfflineSync() {
  const [online, setOnline]         = useState(navigator.onLine)
  const [pendingCount, setPending]  = useState(0)
  const toast                       = useToast()
  const invalidate                  = useInvalidate()

  useEffect(() => {
    const goOnline  = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // When back online, flush the queue
  useEffect(() => {
    if (!online) return
    async function flush() {
      const ops = await getPendingOps()
      if (!ops.length) return
      let ok = 0
      let fail = 0
      for (const op of ops) {
        try {
          await executeOp(op)
          await removeOp(op.id!)
          ok++
        } catch {
          if (op.retries >= MAX_RETRIES) {
            await removeOp(op.id!)
            fail++
          } else {
            await incrementRetry(op.id!)
          }
        }
      }
      if (ok)   { toast(`${ok} operación(es) sincronizada(s)`, 'success'); invalidate.all() }
      if (fail) { toast(`${fail} operación(es) fallaron tras ${MAX_RETRIES} intentos`, 'error') }
      setPending(await getPendingCount())
    }
    flush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  return { online, pendingCount }
}
