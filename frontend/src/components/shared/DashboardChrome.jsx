import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/utils'

/** Shared command-overview look first used on the Admin Dashboard. */

export const DASHBOARD_PANEL =
  'relative overflow-hidden rounded-2xl border border-primary/15 bg-card/80 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] backdrop-blur-md dark:border-white/10 dark:bg-slate-950/55'

export const DASHBOARD_OUTLINE_BUTTON = 'border-sky-500/30'

export const DASHBOARD_TILE =
  'rounded-xl border border-primary/10 bg-background/50 dark:border-white/10 dark:bg-white/5'

export const DASHBOARD_FOLD_GRID = 'grid gap-5 lg:grid-cols-12'

export function LiveDot({ className }) {
  return (
    <span className={cn('relative flex h-2 w-2', className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
    </span>
  )
}

export function SectionKicker({ children, className }) {
  return (
    <p className={cn('text-[11px] font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-400', className)}>
      {children}
    </p>
  )
}

export function PanelGlow() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl dark:bg-sky-400/15"
    />
  )
}

export function DashboardPanel({ as: Tag = 'section', className, padded = true, glow = false, children, ...props }) {
  return (
    <Tag className={cn(DASHBOARD_PANEL, padded && 'p-6', className)} {...props}>
      {glow ? <PanelGlow /> : null}
      {children}
    </Tag>
  )
}

export function DashboardHero({
  kicker = 'Operations',
  title,
  description,
  generatedAt,
  live = true,
  action,
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="mb-2 flex items-center gap-2">
          {live ? <LiveDot /> : null}
          <SectionKicker>{kicker}</SectionKicker>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {(description || generatedAt) && (
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {description}
            {generatedAt ? ` Updated ${formatDateTime(generatedAt)}.` : ''}
          </p>
        )}
      </div>
      {action}
    </div>
  )
}

export function MetricRing({ percent = 0, label = 'full', className }) {
  const value = Number.isFinite(percent) ? percent : 0
  return (
    <div
      className={cn('relative h-[7.5rem] w-[7.5rem] shrink-0 rounded-full p-[7px]', className)}
      style={{
        background: `conic-gradient(#0ea5e9 ${value}%, rgb(148 163 184 / 0.28) 0)`,
      }}
      aria-hidden="true"
    >
      <div className="flex h-full w-full flex-col items-center justify-center rounded-full bg-card dark:bg-slate-950">
        <span className="text-2xl font-semibold tabular-nums tracking-tight">{value}%</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

export function DashboardFrame({ children, busy, className }) {
  return (
    <div
      aria-busy={busy || undefined}
      className={cn(
        'relative -mx-4 -my-4 min-h-[calc(100vh-4rem)] px-4 py-6 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8',
        className
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_hsl(199_89%_48%/0.16),_transparent_52%)] dark:bg-[radial-gradient(ellipse_at_top,_hsl(199_89%_48%/0.22),_transparent_48%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:44px_44px] opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_78%)]"
      />
      <div className="relative mx-auto max-w-[1400px] space-y-6">{children}</div>
    </div>
  )
}
