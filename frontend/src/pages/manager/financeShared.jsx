import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDate } from '@/lib/utils'
import { getDisplayPrefs } from '@/lib/displayPrefs'

export function localToday() {
  const now = new Date()
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
}

export function shiftDate(dateStr, days) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  const next = new Date(y, m - 1, d + days)
  return [
    next.getFullYear(),
    String(next.getMonth() + 1).padStart(2, '0'),
    String(next.getDate()).padStart(2, '0'),
  ].join('-')
}

export function shiftMonth(dateStr, delta) {
  const [y, m] = String(dateStr).split('-').map(Number)
  const next = new Date(y, m - 1 + delta, 1)
  return [next.getFullYear(), String(next.getMonth() + 1).padStart(2, '0'), '01'].join('-')
}

export function mondayWeekStart(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  if (!y || !m || !d) return dateStr
  const weekday = new Date(y, m - 1, d).getDay()
  const offset = weekday === 0 ? -6 : 1 - weekday
  return shiftDate(dateStr, offset)
}

export function formatClock(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  const { timeFormat, timezone } = getDisplayPrefs()
  const opts = { hour: '2-digit', minute: '2-digit' }
  if (timezone) opts.timeZone = timezone
  if (timeFormat === '12h') opts.hour12 = true
  if (timeFormat === '24h') opts.hour12 = false
  try {
    return new Intl.DateTimeFormat('en-ET', opts).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-ET', { hour: '2-digit', minute: '2-digit' }).format(date)
  }
}

export function periodLabel(view, date) {
  if (view === 'week') {
    const start = mondayWeekStart(date)
    return `${formatDate(start)} – ${formatDate(shiftDate(start, 6))}`
  }
  if (view === 'month') {
    const [y, m] = String(date).split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
  }
  return formatDate(date)
}

export function FinancePeriodBar({ view, onViewChange, date, onDateChange, data }) {
  const today = data?.today || localToday()
  const weekStart = mondayWeekStart(date)
  const canNext =
    view === 'day'
      ? date < today
      : view === 'week'
        ? shiftDate(weekStart, 7) <= today
        : shiftMonth(date, 1) <= today

  const step = (direction) => {
    if (view === 'day') {
      const next = shiftDate(date, direction)
      onDateChange(next > today ? today : next)
      return
    }
    if (view === 'week') {
      const next = shiftDate(weekStart, direction * 7)
      onDateChange(next > today ? today : next)
      return
    }
    const next = shiftMonth(date, direction)
    onDateChange(next > today ? today : next)
  }

  const prevLabel = view === 'week' ? 'Previous week' : view === 'month' ? 'Previous month' : 'Previous'
  const nextLabel = view === 'week' ? 'Next week' : view === 'month' ? 'Next month' : 'Next'

  return (
    <>
      <Tabs value={view} onValueChange={onViewChange} className="mb-6">
        <TabsList>
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => step(-1)} aria-label={prevLabel}>
            <ChevronLeft className="h-4 w-4" />
            <span className="ml-1 hidden sm:inline">{prevLabel}</span>
          </Button>
          <p className="min-w-[10rem] text-center text-sm font-medium tabular-nums">
            {periodLabel(view, date)}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => step(1)} disabled={!canNext} aria-label={nextLabel}>
            <span className="mr-1 hidden sm:inline">{nextLabel}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {view === 'day' && (
          <input
            type="date"
            className="h-9 rounded-md border bg-background px-3 text-sm tabular-nums shadow-sm"
            max={today}
            value={date}
            onChange={(event) => {
              const next = event.target.value
              if (next) onDateChange(next > today ? today : next)
            }}
          />
        )}
      </div>
    </>
  )
}

export const filterControlClass =
  'h-9 rounded-md border bg-background px-3 text-sm shadow-sm'
