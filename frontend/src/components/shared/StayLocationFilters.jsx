import { NativeSelect } from '@/components/ui/native-select'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const controlClass = 'h-9'

export function StayLocationFilters({
  roomType,
  ward,
  status,
  roomTypeOptions = [],
  wardOptions = [],
  onChange,
  className,
}) {
  const set = (key, value) => onChange?.({ roomType, ward, status, [key]: value })

  return (
    <div className={cn('flex flex-wrap items-end gap-3', className)}>
      <div className="min-w-[9.5rem]">
        <Label htmlFor="stay-room-type" className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted-foreground">
          Room type
        </Label>
        <NativeSelect
          id="stay-room-type"
          className={controlClass}
          value={roomType}
          onChange={(event) => set('roomType', event.target.value)}
        >
          <option value="">All room types</option>
          {roomTypeOptions.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </NativeSelect>
      </div>
      <div className="min-w-[9.5rem]">
        <Label htmlFor="stay-ward" className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted-foreground">
          Ward
        </Label>
        <NativeSelect
          id="stay-ward"
          className={controlClass}
          value={ward}
          onChange={(event) => set('ward', event.target.value)}
        >
          <option value="">All wards</option>
          {wardOptions.map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </NativeSelect>
      </div>
      <div className="min-w-[9.5rem]">
        <Label htmlFor="stay-status" className="mb-1.5 block text-[11px] uppercase tracking-wide text-muted-foreground">
          Status
        </Label>
        <NativeSelect
          id="stay-status"
          className={controlClass}
          value={status}
          onChange={(event) => set('status', event.target.value)}
        >
          <option value="">All active</option>
          <option value="admitted">Admitted</option>
          <option value="pending-discharge">Pending discharge</option>
        </NativeSelect>
      </div>
    </div>
  )
}
