import { useState } from 'react'
import { Baby, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { FormField } from '@/components/ui/form-field'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/CommonComponents'
import { usePatients } from '@/context/PatientsContext'
import { cn } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'
import { isMaternityAdmission } from '@/lib/maternity'
import { motion, useReducedMotion, fadeUp, revealTransition } from '@/lib/motion'

function Field({ label, value, mono }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('font-medium', mono && 'font-mono text-sm text-primary')}>{value || '—'}</p>
    </div>
  )
}

export function MaternityAdmissionPanel({ patient, canEdit = true }) {
  const { saveMaternityBaby } = usePatients()
  const { toast } = useToast()
  const reducedMotion = useReducedMotion()
  const baby = patient?.baby
  const [open, setOpen] = useState(!baby)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    name: baby?.name || 'Newborn',
    sex: baby?.sex || '',
    dateOfBirth: baby?.dateOfBirth || '',
    timeOfBirth: baby?.timeOfBirth || '',
    birthWeightGrams: baby?.birthWeightGrams ?? '',
    deliveryType: baby?.deliveryType || '',
    notes: baby?.notes || '',
    status: baby?.status || 'admitted',
  })

  if (!isMaternityAdmission(patient)) return null

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleSave = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await saveMaternityBaby(patient.id, form)
      toast({ title: 'Newborn saved', description: 'Baby details are attached to this maternity admission.', variant: 'success' })
      setOpen(false)
    } catch (err) {
      toast({ title: 'Could not save newborn', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Stay operations</p>
        <CardTitle className="mt-1 text-lg">Maternity Admission</CardTitle>
        <CardDescription>
          One maternity case with two subjects. The mother is the primary patient; the newborn is recorded under this same admission.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <User className="h-4 w-4 text-primary" /> Mother
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Name" value={patient.name} />
              <Field label="Patient ID" value={patient.id} mono />
              <Field label="Room" value={patient.room} />
              <Field label="Bed" value={patient.bed} />
              <div>
                <p className="text-xs text-muted-foreground">Admission status</p>
                <div className="mt-1"><StatusBadge status={patient.status} /></div>
              </div>
            </div>
          </div>
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Baby className="h-4 w-4 text-primary" /> Baby
            </p>
            {baby ? (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Field label="Name" value={baby.name} />
                <Field label="Status" value={baby.status} />
                <Field label="Sex" value={baby.sex} />
                <Field label="Date of birth" value={baby.dateOfBirth} />
                <Field label="Time" value={baby.timeOfBirth} />
                <Field label="Weight" value={baby.birthWeightGrams != null ? `${baby.birthWeightGrams} g` : ''} />
                <Field label="Delivery" value={baby.deliveryType} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Awaiting delivery. Newborn details can be added after birth without creating a separate admission.
              </p>
            )}
          </div>
        </div>

        {canEdit && (
          <div>
            {!open ? (
              <Button type="button" variant="outline" onClick={() => setOpen(true)}>
                {baby ? 'Update newborn details' : 'Add newborn details'}
              </Button>
            ) : (
              <motion.form
                onSubmit={handleSave}
                className="grid gap-3 sm:grid-cols-2"
                initial={reducedMotion ? false : fadeUp.initial}
                animate={fadeUp.animate}
                transition={revealTransition(reducedMotion)}
              >
                <FormField label="Baby name">
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
                </FormField>
                <FormField label="Sex">
                  <NativeSelect value={form.sex} onChange={(e) => set('sex', e.target.value)}>
                    <option value="">Not recorded</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Undetermined</option>
                  </NativeSelect>
                </FormField>
                <FormField label="Date of birth">
                  <Input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
                </FormField>
                <FormField label="Time of birth">
                  <Input type="time" value={form.timeOfBirth} onChange={(e) => set('timeOfBirth', e.target.value)} />
                </FormField>
                <FormField label="Birth weight (grams)">
                  <Input type="number" min="0" className="tabular-nums" value={form.birthWeightGrams} onChange={(e) => set('birthWeightGrams', e.target.value)} />
                </FormField>
                <FormField label="Delivery type">
                  <Input value={form.deliveryType} onChange={(e) => set('deliveryType', e.target.value)} placeholder="SVD, C-section..." />
                </FormField>
                <FormField label="Baby status">
                  <NativeSelect value={form.status} onChange={(e) => set('status', e.target.value)}>
                    <option value="admitted">Admitted</option>
                    <option value="discharged">Discharged</option>
                  </NativeSelect>
                </FormField>
                <FormField label="Notes" className="sm:col-span-2">
                  <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} />
                </FormField>
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save newborn'}</Button>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                </div>
              </motion.form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
