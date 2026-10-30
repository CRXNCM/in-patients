import { admissionTypeLabel, isEmergencyOpdAdmission, wasConvertedFromEmergency } from '@/lib/admissions'
import { cn } from '@/lib/utils'

export function AdmissionTypeBadge({ patient, admissionType, convertedFromEmergency, className }) {
  const type = admissionType || patient?.admissionType
  const converted = convertedFromEmergency ?? wasConvertedFromEmergency(patient)
  if (isEmergencyOpdAdmission(type)) {
    return (
      <span
        className={cn(
          'text-[10px] uppercase tracking-wide rounded bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 px-1.5 py-0.5 font-semibold',
          className
        )}
      >
        Emergency OPD
      </span>
    )
  }
  if (converted) {
    return (
      <span
        className={cn(
          'text-[10px] uppercase tracking-wide rounded border border-orange-300 text-orange-800 dark:border-orange-700 dark:text-orange-300 px-1.5 py-0.5 font-semibold',
          className
        )}
      >
        Converted from Emergency OPD
      </span>
    )
  }
  if (type === 'maternity') {
    return (
      <span
        className={cn(
          'text-[10px] uppercase tracking-wide rounded bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 px-1.5 py-0.5',
          className
        )}
      >
        Maternity
      </span>
    )
  }
  if (!type) return null
  return (
    <span
      className={cn(
        'text-[10px] uppercase tracking-wide rounded bg-muted text-muted-foreground px-1.5 py-0.5',
        className
      )}
    >
      {admissionTypeLabel(type)}
    </span>
  )
}
