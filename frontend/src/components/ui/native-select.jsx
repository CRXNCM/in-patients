import * as React from 'react'
import { cn } from '@/lib/utils'

const NativeSelect = React.forwardRef(({ className, error, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      'ui-control flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted/40',
      'aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive',
      error && 'border-destructive focus-visible:ring-destructive',
      className
    )}
    {...props}
    aria-invalid={error ? true : props['aria-invalid']}
  />
))
NativeSelect.displayName = 'NativeSelect'

export { NativeSelect }
