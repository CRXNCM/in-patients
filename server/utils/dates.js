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

/** Monday–Sunday week containing `dateStr`. */
export function mondayWeekRange(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  if (!y || !m || !d) return null
  const weekday = new Date(y, m - 1, d).getDay()
  const offset = weekday === 0 ? -6 : 1 - weekday
  const startDate = shiftDate(dateStr, offset)
  const endDate = shiftDate(startDate, 6)
  if (!startDate || !endDate) return null
  return { startDate, endDate }
}

/** Local calendar month containing `dateStr`. `start`/`end` are [start, end) Date bounds. */
export function localMonthRange(dateStr) {
  const [y, m] = String(dateStr).split('-').map(Number)
  if (!y || !m) return null
  const lastDay = new Date(y, m, 0).getDate()
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`
  const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return {
    startDate,
    endDate,
    start: new Date(y, m - 1, 1, 0, 0, 0, 0),
    end: new Date(y, m, 1, 0, 0, 0, 0),
  }
}

export function clampToToday(dateStr, today = todayStr()) {
  if (!dateStr) return today
  return dateStr > today ? today : dateStr
}
