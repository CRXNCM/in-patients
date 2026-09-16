import * as React from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const SearchInput = React.forwardRef(function SearchInput(
  { id, label, className, placeholder = 'Search', ...props },
  ref
) {
  const generatedId = React.useId()
  const inputId = id || generatedId

  return (
    <div className="relative">
      {label ? (
        <Label htmlFor={inputId} className="sr-only">
          {label}
        </Label>
      ) : null}
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        ref={ref}
        id={inputId}
        type="search"
        placeholder={placeholder}
        className={cn('pl-9', className)}
        {...props}
      />
    </div>
  )
})

SearchInput.displayName = 'SearchInput'

export { SearchInput }
