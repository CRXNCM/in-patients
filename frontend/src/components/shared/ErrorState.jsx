import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
      className={cn(compact ? 'py-4' : 'py-2', className)}
      role="alert"
    >
      {title ? <p className="text-sm font-medium">{title}</p> : null}
      <p className={cn('text-sm text-muted-foreground', title && 'mb-4 mt-2')}>{safeMessage(message)}</p>
      {onRetry ? (
        <Button type="button" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </div>
  )
}
