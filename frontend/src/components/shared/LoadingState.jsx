import { cn } from '@/lib/utils'

export function LoadingState({ message = 'Loading…', className }) {
  return (
    <div
      className={cn('ui-enter flex flex-col items-center justify-center gap-3 px-6 py-16', className)}
      role="status"
      aria-live="polite"
    >
      <div className="ui-shimmer h-1 w-28 overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <span className="ui-shimmer-bar" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}
