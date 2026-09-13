import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export function DoctorPicker({ doctors = [], selectedIds = [], onChange, disabled }) {
  const [query, setQuery] = useState('')

  const selected = useMemo(
    () => selectedIds.map((id) => doctors.find((d) => d.id === id)).filter(Boolean),
    [doctors, selectedIds]
  )

  const available = useMemo(() => {
    const q = query.trim().toLowerCase()
    return doctors.filter((d) => {
      if (!d.active || selectedIds.includes(d.id)) return false
      if (!q) return true
      return `${d.name} ${d.specialty}`.toLowerCase().includes(q)
    })
  }, [doctors, query, selectedIds])

  const add = (id) => {
    if (disabled) return
    onChange([...selectedIds, id])
    setQuery('')
  }

  const remove = (id) => {
    if (disabled) return
    onChange(selectedIds.filter((item) => item !== id))
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Search doctors</Label>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name or specialty"
          disabled={disabled}
        />
      </div>
      {available.length > 0 && (
        <div className="max-h-40 overflow-auto rounded-md border divide-y">
          {available.map((doctor) => (
            <button
              type="button"
              key={doctor.id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
              onClick={() => add(doctor.id)}
            >
              <span className="font-medium">{doctor.name}</span>
              <span className="block text-xs text-muted-foreground">
                {doctor.specialty} · Daily visit {formatCurrency(doctor.visitPrice)}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2">
        {selected.length === 0 && (
          <p className="text-xs text-muted-foreground">No visiting doctors selected. Admission can continue without one.</p>
        )}
        {selected.map((doctor) => (
          <div key={doctor.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="font-medium">{doctor.name}</p>
              <p className="text-xs text-muted-foreground">Specialty: {doctor.specialty}</p>
              <p className="text-xs text-muted-foreground">Daily visit: {formatCurrency(doctor.visitPrice)}</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(doctor.id)} disabled={disabled}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
