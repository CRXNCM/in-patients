import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'

function safeMessage(message) {
  if (message == null || message === '') return 'Something went wrong. Please try again.'
  const text = String(message).trim()
  if (!text) return 'Something went wrong. Please try again.'
  if (text.includes('\n') || /at\s+\S+\s+\(/.test(text) || text.length > 280) {
    return 'The request failed. Please try again.'
  }
  return text
}

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = 'Retry',
  compact = false,
  className,
}) {
  return (
    <div
      className={cn('ui-enter', compact ? 'py-4' : 'py-2', className)}
      role="alert"
    >
      <div className={cn('flex gap-3', compact ? 'items-start' : 'flex-col items-start')}>
        <div
          className={cn(
            'flex shrink-0 items-center justify-center rounded-full border bg-destructive/5 text-destructive shadow-sm',
            compact ? 'h-8 w-8' : 'mb-1 h-10 w-10'
          )}
          aria-hidden="true"
        >
          <AlertCircle className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
        </div>
        <div className="min-w-0">
          {title ? <p className="text-sm font-medium">{title}</p> : null}
          <p className={cn('text-sm text-muted-foreground', title && 'mb-4 mt-2')}>{safeMessage(message)}</p>
          {onRetry ? (
            <Button type="button" onClick={onRetry}>
              {retryLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
