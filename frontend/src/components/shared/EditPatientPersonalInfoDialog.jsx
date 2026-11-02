import { useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { usePatients } from '@/context/PatientsContext'
import { useToast } from '@/context/ToastContext'
import { computeAgeFromDob, firstError, trimText, validatePersonalInfo } from '@/lib/validation'

function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-destructive">{message}</p>
}

function fieldsFrom(patient) {
  return {
    name: patient?.name || '',
    dateOfBirth: patient?.dateOfBirth || '',
    gender: patient?.gender || 'Female',
    phone: patient?.phone || '',
    address: patient?.address || '',
    emergencyContact: patient?.emergencyContact || '',
    emergencyPhone: patient?.emergencyPhone || '',
  }
}

export function EditPatientPersonalInfoButton({ patient, onSaved, size = 'sm', variant = 'outline' }) {
  const { toast } = useToast()
  const { updatePatientPersonalInfo } = usePatients()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(() => fieldsFrom(patient))
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(fieldsFrom(patient))
      setErrors({})
    }
  }, [open, patient])

  const set = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = validatePersonalInfo(form, { originalPhone: patient?.phone })
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      toast({ title: firstError(nextErrors) || 'Check the highlighted fields.', variant: 'destructive' })
      return
    }
    const patientId = patient.id || patient.patientId
    const dob = trimText(form.dateOfBirth)
    setBusy(true)
    try {
      const updated = await updatePatientPersonalInfo(patientId, {
        name: trimText(form.name),
        gender: trimText(form.gender),
        dateOfBirth: dob,
        age: dob ? computeAgeFromDob(dob) : patient.age,
        phone: trimText(form.phone),
        address: trimText(form.address),
        emergencyContact: trimText(form.emergencyContact),
        emergencyPhone: trimText(form.emergencyPhone),
      })
      toast({ title: 'Patient information updated', variant: 'success' })
      setOpen(false)
      onSaved?.(updated)
    } catch (err) {
      toast({ title: 'The change was not saved', description: err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  if (!patient?.id && !patient?.patientId) return null

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={(event) => { event.stopPropagation(); setOpen(true) }}>
        <Pencil className="h-4 w-4" /> Edit info
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" onClick={(event) => event.stopPropagation()}>
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Edit personal information</DialogTitle>
              <DialogDescription>
                Correct the name, date of birth, address, and contact details. Admission, bed, and billing are not changed here.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              <div>
                <Label htmlFor="personal-name">Full name</Label>
                <Input id="personal-name" value={form.name} disabled={busy} onChange={(event) => set('name', event.target.value)} />
                <FieldError message={errors.name} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="personal-dob">Date of birth</Label>
                  <Input
                    id="personal-dob"
                    type="date"
                    max={new Date().toISOString().split('T')[0]}
                    value={form.dateOfBirth}
                    disabled={busy}
                    onChange={(event) => set('dateOfBirth', event.target.value)}
                  />
                  <FieldError message={errors.dateOfBirth} />
                </div>
                <div>
                  <Label htmlFor="personal-gender">Gender</Label>
                  <select
                    id="personal-gender"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.gender}
                    disabled={busy}
                    onChange={(event) => set('gender', event.target.value)}
                  >
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                  </select>
                  <FieldError message={errors.gender} />
                </div>
              </div>
              <div>
                <Label htmlFor="personal-address">Address</Label>
                <Textarea id="personal-address" rows={2} value={form.address} disabled={busy} onChange={(event) => set('address', event.target.value)} />
                <FieldError message={errors.address} />
              </div>
              <div>
                <Label htmlFor="personal-phone">Phone</Label>
                <Input id="personal-phone" value={form.phone} disabled={busy} onChange={(event) => set('phone', event.target.value)} />
                <FieldError message={errors.phone} />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="personal-emergency-name">Emergency contact</Label>
                  <Input id="personal-emergency-name" value={form.emergencyContact} disabled={busy} onChange={(event) => set('emergencyContact', event.target.value)} />
                </div>
                <div>
                  <Label htmlFor="personal-emergency-phone">Emergency phone</Label>
                  <Input id="personal-emergency-phone" value={form.emergencyPhone} disabled={busy} onChange={(event) => set('emergencyPhone', event.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
