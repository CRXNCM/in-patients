import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { motion, useReducedMotion, hoverLift, tapPress, microTransition } from '@/lib/motion'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-[color,background-color,border-color,box-shadow,opacity] duration-140 ease-out-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md',
        outline: 'border border-input bg-background hover:border-primary/30 hover:bg-accent hover:text-accent-foreground hover:shadow-sm',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-sm',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, disabled, ...props }, ref) => {
  const reduced = useReducedMotion()
  const classes = cn(buttonVariants({ variant, size, className }))

  if (asChild) {
    return <Slot className={classes} ref={ref} {...props} />
  }

  const quiet = variant === 'link' || variant === 'ghost' || disabled || reduced

  return (
    <motion.button
      {...props}
      className={classes}
      ref={ref}
      disabled={disabled}
      whileHover={quiet ? undefined : hoverLift(reduced)}
      whileTap={disabled || reduced ? undefined : tapPress(reduced)}
      transition={microTransition(reduced)}
    />
  )
})
Button.displayName = 'Button'

export { Button, buttonVariants }
