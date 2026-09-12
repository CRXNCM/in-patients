import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-ET', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function stayDurationDays(admissionDate, endDate) {
  if (!admissionDate) return 0
  const start = new Date(`${admissionDate}T12:00:00`)
  const end = new Date(`${(endDate || new Date().toISOString().slice(0, 10))}T12:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  const days = Math.round((end - start) / 86400000) + 1
  return Math.max(1, days)
}

export function formatDateTime(dateStr) {
  return new Date(dateStr).toLocaleString('en-ET', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
