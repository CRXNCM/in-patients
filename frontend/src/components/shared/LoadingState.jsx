import { cn } from '@/lib/utils'

export function LoadingState({ message = 'Loading…', className }) {
  return (
    <p
      className={cn('px-6 py-16 text-center text-sm text-muted-foreground', className)}
      role="status"
      aria-live="polite"
    >
      {message}
    </p>
  )
}
