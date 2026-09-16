import { cn } from '@/lib/utils'
import { DASHBOARD_TILE } from '@/components/shared/DashboardChrome'

const TONE_VALUE = {
  default: '',
  warning: 'text-warning',
  success: 'text-success',
  danger: 'text-destructive',
}

export function MetricTile({
  label,
  value,
  description,
  subtitle,
  icon: Icon,
  trend,
  tone = 'default',
  alert = false,
  onClick,
  className,
}) {
  const Comp = onClick ? 'button' : 'div'
  const caption = description || subtitle
  const valueTone = alert ? TONE_VALUE.warning : TONE_VALUE[tone] || TONE_VALUE.default

  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        DASHBOARD_TILE,
        'w-full px-4 py-4 text-left',
        onClick && 'cursor-pointer',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
      </div>
      <p className={cn('mt-2 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl', valueTone)}>
        {value}
      </p>
      {caption ? <p className="mt-1 text-xs text-muted-foreground">{caption}</p> : null}
      {trend ? <p className="mt-1 text-xs text-muted-foreground">{trend}</p> : null}
    </Comp>
  )
}
