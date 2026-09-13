import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { DEFAULT_CURRENCY, getDisplayPrefs } from '@/lib/displayPrefs'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount) {
  const { currency } = getDisplayPrefs()
  try {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: currency || DEFAULT_CURRENCY,
      minimumFractionDigits: 2,
    }).format(amount)
  } catch {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: DEFAULT_CURRENCY,
      minimumFractionDigits: 2,
    }).format(amount)
  }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/**
 * Intl rejects a null or unknown timeZone, so an unconfigured timezone must mean
 * "use the browser zone" rather than reaching the formatter.
 */
function dateTimeFormat(locale, { timeZone, ...options }) {
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat(locale, { timeZone, ...options })
    } catch {
      /* fall through to the browser timezone */
    }
  }
  return new Intl.DateTimeFormat(locale, options)
}

/** Formats a Date using the configured date format, optionally in the configured timezone. */
function formatDateParts(date, { dateFormat, timeZone }) {
  const base = { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }
  if (dateFormat === 'iso') return dateTimeFormat('en-CA', base).format(date)
  if (dateFormat === 'dmy') return dateTimeFormat('en-GB', base).format(date)
  return dateTimeFormat('en-ET', { timeZone, year: 'numeric', month: 'short', day: 'numeric' }).format(date)
}

export function formatDate(dateStr) {
  if (dateStr === null || dateStr === undefined || dateStr === '') return ''
  const { dateFormat } = getDisplayPrefs()
  // Calendar-day strings are already hospital-local days, so never shift them by timezone.
  const dateOnly = typeof dateStr === 'string' && DATE_ONLY.test(dateStr)
  const date = dateOnly ? new Date(`${dateStr}T12:00:00`) : new Date(dateStr)
  if (Number.isNaN(date.getTime())) return String(dateStr)
  if (dateOnly && dateFormat === 'iso') return dateStr
  return formatDateParts(date, { dateFormat, timeZone: dateOnly ? undefined : getDisplayPrefs().timezone || undefined })
}

export function stayDurationDays(admissionDate, endDate) {
  if (!admissionDate) return 0
  const now = new Date()
  const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const start = new Date(`${admissionDate}T12:00:00`)
  const end = new Date(`${endDate || localToday}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const days = Math.round((end - start) / 86400000) + 1
  return Math.max(1, days)
}

export function formatDateTime(dateStr) {
  if (dateStr === null || dateStr === undefined || dateStr === '') return ''
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return String(dateStr)
  const { dateFormat, timeFormat, timezone } = getDisplayPrefs()
  const timeOpts = { timeZone: timezone || undefined, hour: '2-digit', minute: '2-digit' }
  if (timeFormat === '12h') timeOpts.hour12 = true
  if (timeFormat === '24h') {
    timeOpts.hour12 = false
    timeOpts.hourCycle = 'h23'
  }
  const datePart = formatDateParts(date, { dateFormat, timeZone: timezone || undefined })
  return `${datePart}, ${dateTimeFormat('en-ET', timeOpts).format(date)}`
}

export function getBalanceStatus(remainingBalance, threshold = 3000) {
  if (remainingBalance >= threshold * 2) return 'sufficient'
  if (remainingBalance >= threshold) return 'low'
  return 'critical'
}

export function getStatusBadge(status) {
  const map = {
    sufficient: { label: 'Sufficient Balance', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    low: { label: 'Low Balance', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    critical: { label: 'Critical Balance', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
    'in-stock': { label: 'In Stock', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
    'low-stock': { label: 'Low Stock', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
    'out-of-stock': { label: 'Out of Stock', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
    admitted: { label: 'Admitted', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
    'pending-discharge': { label: 'Pending Discharge', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
    discharged: { label: 'Discharged', className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  }
  return map[status] || { label: status, className: 'bg-gray-100 text-gray-600' }
}
