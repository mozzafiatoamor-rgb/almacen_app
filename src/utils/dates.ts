/** Normalize any date string to DD/MM/YYYY */
export function normDate(d: string): string {
  if (!d) return ''
  const s = String(d).trim()
  if (s.includes('-')) {
    const [y, m, day] = s.split('-')
    return `${day?.padStart(2,'0')}/${m?.padStart(2,'0')}/${y}`
  }
  if (s.includes('/')) {
    const [day, m, y] = s.split('/')
    return `${day?.padStart(2,'0')}/${m?.padStart(2,'0')}/${y}`
  }
  return s
}

/** Today as DD/MM/YYYY (es-MX) */
export function today(): string {
  return new Date().toLocaleDateString('es-MX', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

/** Current date and time strings */
export function nowDateTime(): { date: string; time: string } {
  const d = new Date()
  return {
    date: d.toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' }),
    time: d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }
}

/** DD/MM/YYYY → YYYY-MM-DD (for <input type="date"> value) */
export function dateToISO(d: string): string {
  if (!d) return ''
  if (d.includes('-')) return d
  const [day, m, y] = d.split('/')
  return `${y}-${m?.padStart(2,'0')}-${day?.padStart(2,'0')}`
}

/** YYYY-MM-DD → DD/MM/YYYY */
export function isoToDate(d: string): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

/** Format date for display */
export function formatDate(d: string): string {
  if (!d) return ''
  return d // already DD/MM/YYYY
}
