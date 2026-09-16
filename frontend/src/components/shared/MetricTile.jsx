import { cn } from '@/lib/utils'
import { DASHBOARD_TILE } from '@/components/shared/DashboardChrome'
import { motion, useReducedMotion, hoverLift, tapPress, microTransition } from '@/lib/motion'

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
  const reduced = useReducedMotion()
  const caption = description || subtitle
  const valueTone = alert ? TONE_VALUE.warning : TONE_VALUE[tone] || TONE_VALUE.default
  const classes = cn(
    DASHBOARD_TILE,
    'w-full px-4 py-4 text-left transition-shadow duration-200 ease-out-soft',
    onClick && 'cursor-pointer',
    className
  )

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
      </div>
      <p className={cn('mt-2 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl', valueTone)}>
        {value}
      </p>
      {caption ? <p className="mt-1 text-xs text-muted-foreground">{caption}</p> : null}
      {trend ? <p className="mt-1 text-xs text-muted-foreground">{trend}</p> : null}
    </>
  )

  if (!onClick) {
    return <div className={classes}>{body}</div>
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={classes}
      whileHover={hoverLift(reduced)}
      whileTap={tapPress(reduced)}
      transition={microTransition(reduced)}
    >
      {body}
    </motion.button>
  )
}
