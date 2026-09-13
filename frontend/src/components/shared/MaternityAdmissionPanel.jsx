import { useState } from 'react'
import { Baby, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { usePatients } from '@/context/PatientsContext'
import { useToast } from '@/context/ToastContext'
import { isMaternityAdmission } from '@/lib/maternity'

function Field({ label, value }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || '—'}</p>
    </div>
  )
}

export function MaternityAdmissionPanel({ patient, canEdit = true }) {
  const { saveMaternityBaby } = usePatients()
  const { toast } = useToast()
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
    <Card className="mb-6 border-rose-200 dark:border-rose-900">
      <CardHeader>
        <CardTitle>Maternity Admission</CardTitle>
        <CardDescription>
          One maternity case with two subjects. The mother is the primary patient; the newborn is recorded under this same admission.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Mother
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Name" value={patient.name} />
              <Field label="Patient ID" value={patient.id} />
              <Field label="Room" value={patient.room} />
              <Field label="Bed" value={patient.bed} />
              <Field label="Admission status" value={patient.status} />
            </div>
          </div>
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Baby className="h-4 w-4 text-rose-600" /> Baby
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
              <form onSubmit={handleSave} className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Baby name</Label>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
                </div>
                <div>
                  <Label>Sex</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.sex}
                    onChange={(e) => set('sex', e.target.value)}
                  >
                    <option value="">Not recorded</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Undetermined</option>
                  </select>
                </div>
                <div>
                  <Label>Date of birth</Label>
                  <Input type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
                </div>
                <div>
                  <Label>Time of birth</Label>
                  <Input type="time" value={form.timeOfBirth} onChange={(e) => set('timeOfBirth', e.target.value)} />
                </div>
                <div>
                  <Label>Birth weight (grams)</Label>
                  <Input type="number" min="0" value={form.birthWeightGrams} onChange={(e) => set('birthWeightGrams', e.target.value)} />
                </div>
                <div>
                  <Label>Delivery type</Label>
                  <Input value={form.deliveryType} onChange={(e) => set('deliveryType', e.target.value)} placeholder="SVD, C-section..." />
                </div>
                <div>
                  <Label>Baby status</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.status}
                    onChange={(e) => set('status', e.target.value)}
                  >
                    <option value="admitted">Admitted</option>
                    <option value="discharged">Discharged</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <Label>Notes</Label>
                  <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} />
                </div>
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save newborn'}</Button>
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                </div>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
