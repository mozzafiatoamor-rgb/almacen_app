/** Generate next sequential ID from a list of existing IDs.
 *  e.g. nextId('MV', movimientos) → 'MV0042'
 */
export function nextId(prefix: string, list: { id: string }[]): string {
  const nums = list
    .map(r => parseInt((r.id ?? '0').replace(/\D/g, '')) || 0)
  const max = nums.length ? Math.max(...nums) : 0
  return prefix + String(max + 1).padStart(4, '0')
}
