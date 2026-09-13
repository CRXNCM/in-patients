import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { DEFAULT_LIST_PAGE_SIZE, getListPageSize } from '@/lib/displayPrefs'

export const LIST_PAGE_SIZE = DEFAULT_LIST_PAGE_SIZE

/** Omit `pageSize` to follow the configured rows-per-page setting. */
export function usePagedItems(items = [], pageSizeOverride) {
  const [page, setPage] = useState(1)
  const pageSize = pageSizeOverride ?? getListPageSize()
  const total = items?.length || 0
  const pageCount = Math.max(1, Math.ceil(total / pageSize) || 1)
  const current = Math.min(page, pageCount)
  const slice = (items || []).slice((current - 1) * pageSize, current * pageSize)

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  return { page: current, setPage, pageCount, slice, total, pageSize }
}

function pageNumbers(page, pageCount) {
  if (pageCount <= 12) return Array.from({ length: pageCount }, (_, i) => i + 1)
  const pages = new Set([1, pageCount, page, page - 1, page + 1, page - 2, page + 2])
  return [...pages].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b)
}

export function Pagination({ page, pageCount, onPageChange, total, pageSize }) {
  if (!total || pageCount <= 1) return null

  const numbers = pageNumbers(page, pageCount)
  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t bg-card">
      <p className="text-xs text-muted-foreground">
        {start}–{end} of {total}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {numbers.map((n, i) => {
          const prev = numbers[i - 1]
          return (
            <span key={n} className="flex items-center gap-1">
              {prev && n - prev > 1 && <span className="px-1 text-muted-foreground">…</span>}
              <button
                type="button"
                onClick={() => onPageChange(n)}
                className={cn(
                  'min-w-8 h-8 rounded-md px-2 text-sm font-medium transition-colors',
                  n === page
                    ? 'bg-primary text-primary-foreground'
                    : 'border bg-background hover:bg-muted text-foreground'
                )}
              >
                {n}
              </button>
            </span>
          )
        })}
      </div>
    </div>
  )
}

export function StatCard({ title, value, subtitle, icon: Icon, trend, className, iconClassName, onClick }) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      className={cn(
        'rounded-xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          {trend && (
            <p className={cn('text-xs font-medium', trend.positive ? 'text-emerald-600' : 'text-red-600')}>
              {trend.positive ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn('rounded-lg p-3', iconClassName || 'bg-primary/10 text-primary')}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  )
}

export function StatusBadge({ status }) {
  const map = {
    sufficient: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    low: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    'in-stock': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'low-stock': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'out-of-stock': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    admitted: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'pending-discharge': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    discharged: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    occupied: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    maintenance: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    out_of_service: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }
  const labels = {
    sufficient: 'Sufficient Balance',
    low: 'Low Balance',
    critical: 'Critical Balance',
    active: 'Active',
    inactive: 'Inactive',
    'in-stock': 'In Stock',
    'low-stock': 'Low Stock',
    'out-of-stock': 'Out of Stock',
    admitted: 'Admitted',
    'pending-discharge': 'Pending Discharge',
    discharged: 'Discharged',
    occupied: 'Occupied',
    maintenance: 'Maintenance',
    out_of_service: 'Out of service',
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', map[status] || map.active)}>
      {labels[status] || status}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>
      {action}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-10 flex-1 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground mt-1">{description}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

export function DataTable({ columns, data, onRowClick, emptyState, pageSize }) {
  const { page, setPage, pageCount, slice, total, pageSize: size } = usePagedItems(data, pageSize)

  if (!data || data.length === 0) {
    return emptyState || (
      <div className="text-center py-12 text-muted-foreground">No data available</div>
    )
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              {columns.map((col) => (
                <th key={col.key} className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap">
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((row, idx) => (
              <tr
                key={row.id || idx}
                className={cn('border-b transition-colors hover:bg-muted/30', onRowClick && 'cursor-pointer')}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 whitespace-nowrap">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={total} pageSize={size} />
    </div>
  )
}
