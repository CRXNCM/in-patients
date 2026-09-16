import * as React from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function FormField({
  id,
  label,
  required,
  description,
  error,
  children,
  className,
}) {
  const generatedId = React.useId()
  const fieldId = id || generatedId
  const descriptionId = description ? `${fieldId}-description` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined

  const control = React.isValidElement(children)
    ? React.cloneElement(children, {
        id: children.props.id ?? fieldId,
        'aria-invalid': error ? true : children.props['aria-invalid'],
        'aria-describedby': describedBy || children.props['aria-describedby'],
      })
    : children

  return (
    <div className={cn('space-y-2', className)}>
      {label ? (
        <Label htmlFor={fieldId}>
          {label}
          {required ? (
            <>
              <span aria-hidden="true" className="text-destructive">
                {' '}
                *
              </span>
              <span className="sr-only"> required</span>
            </>
          ) : null}
        </Label>
      ) : null}
      {control}
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
