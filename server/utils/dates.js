export function todayStr() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function shiftDate(dateStr, days) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  if (!y || !m || !d) return null
  const next = new Date(y, m - 1, d + days)
  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, '0'),
    String(next.getDate()).padStart(2, '0'),
  ].join('-')
}

export function eachDateInclusive(start, end) {
  if (!start || !end || start > end) return []
  const dates = []
  let cur = start
  while (cur <= end) {
    dates.push(cur)
    cur = shiftDate(cur, 1)
    if (!cur) break
  }
  return dates
}

export function clampChargeDate(date, admissionDate, today = todayStr()) {
  if (!date || !admissionDate) return null
  if (date < admissionDate) return null
  if (date > today) return null
  return date
}

/** Local calendar day as [start, end) Date bounds. `dateStr` is YYYY-MM-DD. */
export function localDayRange(dateStr = todayStr()) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  if (!y || !m || !d) return null
  return {
    start: new Date(y, m - 1, d, 0, 0, 0, 0),
    end: new Date(y, m - 1, d + 1, 0, 0, 0, 0),
  }
}
