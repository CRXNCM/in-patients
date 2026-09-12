import centralLogo from '@/asset/central_logo.png'
import { cn } from '@/lib/utils'

const sizeClasses = {
  xs: 'h-7 w-7',
  sm: 'h-9 w-9',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
  xl: 'h-20 w-20',
}

export function HospitalLogo({ size = 'md', className, alt = 'Central City Hospital logo' }) {
  return (
    <img
      src={centralLogo}
      alt={alt}
      className={cn('object-contain', typeof size === 'string' ? sizeClasses[size] || sizeClasses.md : null, className)}
      style={typeof size === 'number' ? { height: size, width: size } : undefined}
    />
  )
}

export { centralLogo as hospitalLogoSrc }
