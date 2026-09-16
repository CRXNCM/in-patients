import { useEffect, useMemo, useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import { FormField } from '@/components/ui/form-field'
import { Input } from '@/components/ui/input'
import { formatCurrency, formatDate } from '@/lib/utils'
import { todayStr } from '@/lib/validation'
import { api, USE_API } from '@/api/client'
import { useToast } from '@/context/ToastContext'

export function AssignedDoctorsPanel({
  patient,
  canAdd = false,
  hideMoney = false,
  onChanged,
}) {
  const { toast } = useToast()
  const [doctors, setDoctors] = useState([])
  const [doctorId, setDoctorId] = useState('')
  const [effectiveFrom, setEffectiveFrom] = useState(todayStr())
  const [submitting, setSubmitting] = useState(false)
  const assignments = patient?.assignedDoctors || []

  useEffect(() => {
    if (!USE_API || !canAdd) return undefined
    let cancelled = false
    api.getDoctors({ active: true })
      .then((rows) => {
        if (!cancelled) setDoctors(rows)
      })
      .catch(() => {
        if (!cancelled) setDoctors([])
      })
    return () => {
      cancelled = true
    }
  }, [canAdd])

  const alreadyAssigned = useMemo(
    () => new Set(assignments.filter((a) => a.status === 'active').map((a) => a.doctorId)),
    [assignments]
  )
  const addable = doctors.filter((d) => d.active && !alreadyAssigned.has(d.id))

  const handleAdd = async () => {
    if (!doctorId) {
      toast({ title: 'Select a doctor', variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      const res = await api.assignDoctor(patient.id, { doctorId, effectiveFrom })
      toast({ title: 'Doctor assigned', description: res.assignment?.doctorName, variant: 'success' })
      setDoctorId('')
      onChanged?.(res)
    } catch (err) {
      toast({ title: 'Could not assign doctor', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleEnd = async (assignment) => {
    if (!window.confirm(`End assignment for ${assignment.doctorName}? Historical visits stay on the bill.`)) return
    setSubmitting(true)
    try {
      const res = await api.endDoctorAssignment(patient.id, assignment.id)
      toast({ title: 'Assignment ended', variant: 'success' })
      onChanged?.(res)
    } catch (err) {
      toast({ title: 'Could not end assignment', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Stay operations</p>
        <CardTitle className="mt-1 flex items-center gap-2 text-lg">
          <Stethoscope className="h-5 w-5 text-primary" />
          Assigned Doctors
        </CardTitle>
        <CardDescription>
          {hideMoney
            ? 'Visiting doctors assigned to this admission.'
            : 'Daily visit prices are stored when the doctor is assigned. Later catalog price changes do not rewrite past days.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {assignments.length === 0 && (
          <p className="text-sm text-muted-foreground">No visiting doctors are assigned to this admission.</p>
        )}
        <div className="space-y-3">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-background/60 p-3 transition-colors duration-140 ease-out-soft hover:bg-muted/30">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{assignment.doctorName}</p>
                  {assignment.status === 'active' ? (
                    <span className="text-xs font-medium text-success">Active</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Ended</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{assignment.specialty}</p>
                {!hideMoney ? (
                  <p className="text-sm tabular-nums">{formatCurrency(assignment.visitPrice)} / day</p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Assigned {formatDate(assignment.effectiveFrom)}
                  {assignment.effectiveTo ? ` · Ended ${formatDate(assignment.effectiveTo)}` : ''}
                  {assignment.assignedBy ? ` · by ${assignment.assignedBy}` : ''}
                </p>
              </div>
              {canAdd && assignment.status === 'active' && patient.status !== 'discharged' && (
                <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={() => handleEnd(assignment)}>
                  End assignment
                </Button>
              )}
            </div>
          ))}
        </div>

        {canAdd && patient.status !== 'discharged' && (
          <div className="grid items-end gap-3 sm:grid-cols-3">
            <FormField label="Add doctor">
              <NativeSelect
                value={doctorId}
                onChange={(e) => setDoctorId(e.target.value)}
              >
                <option value="">Select an active doctor</option>
                {addable.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.name} — {doctor.specialty}{hideMoney ? '' : ` — ${formatCurrency(doctor.visitPrice)}/day`}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField label="Effective date">
              <Input
                type="date"
                min={patient.admissionDate}
                max={todayStr()}
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </FormField>
            <Button type="button" onClick={handleAdd} disabled={submitting || !doctorId}>
              {submitting ? 'Saving...' : 'Add doctor'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
