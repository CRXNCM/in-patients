import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/CommonComponents'
import { bedTypes, depositTypes } from '@/data/mockData'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { useToast } from '@/context/ToastContext'
import { formatCurrency } from '@/lib/utils'
import {
  validateAdmission,
  findDuplicateNameAgeWarning,
  firstError,
  trimText,
  computeAgeFromDob,
  MIN_INITIAL_DEPOSIT,
  NON_CASH_PAYMENT_METHODS,
} from '@/lib/validation'

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-destructive mt-1">{message}</p>
}

export default function AddPatient() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { addPatient, patients, rooms } = usePatients()
  const { ensureAutomaticDailyCharges } = useServiceEntries()

  const [form, setForm] = useState({
    name: '',
    age: '',
    dateOfBirth: '',
    gender: 'Male',
    phone: '',
    address: '',
    emergencyContact: '',
    emergencyPhone: '',
    mrn: '',
    nationalId: '',
    bedType: bedTypes[0].name,
    bedNumber: '',
    admissionDate: new Date().toISOString().split('T')[0],
    admissionReason: '',
    initialDeposit: '',
    depositType: 'Cash',
    referenceNumber: '',
    notes: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const availableBeds = useMemo(() => {
    const room = rooms.find((r) => r.roomType === form.bedType)
    return room?.beds.filter((b) => b.status === 'available') || []
  }, [rooms, form.bedType])

  const set = (key, val) => {
    setForm((p) => ({ ...p, [key]: val }))
    setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmed = {
      ...form,
      name: trimText(form.name),
      address: trimText(form.address),
      emergencyContact: trimText(form.emergencyContact),
      admissionReason: trimText(form.admissionReason),
      mrn: trimText(form.mrn),
      nationalId: trimText(form.nationalId),
      referenceNumber: trimText(form.referenceNumber),
    }

    const validationErrors = validateAdmission(trimmed, { rooms, existingPatients: patients })
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      toast({ title: 'Please fix the errors', description: firstError(validationErrors), variant: 'destructive' })
      return
    }

    const dupWarning = findDuplicateNameAgeWarning(trimmed, patients)
    if (dupWarning && !window.confirm(dupWarning)) return

    const age = trimText(trimmed.age) ? Number(trimmed.age) : computeAgeFromDob(trimmed.dateOfBirth)
    if (age == null || Number.isNaN(age)) {
      setErrors({ age: 'Age or date of birth is required.' })
      toast({ title: 'Please fix the errors', description: 'Age or date of birth is required.', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const patient = await addPatient({
        name: trimmed.name,
        age,
        dateOfBirth: trimText(trimmed.dateOfBirth) || undefined,
        gender: trimmed.gender,
        phone: trimText(trimmed.phone),
        address: trimmed.address,
        emergencyContact: trimmed.emergencyContact,
        emergencyPhone: trimText(trimmed.emergencyPhone),
        mrn: trimmed.mrn || undefined,
        nationalId: trimmed.nationalId || undefined,
        room: trimmed.bedType,
        bed: trimmed.bedNumber || undefined,
        admissionDate: trimmed.admissionDate,
        admissionReason: trimmed.admissionReason,
        deposit: Number(trimmed.initialDeposit),
        depositType: trimmed.depositType,
        referenceNumber: trimmed.referenceNumber || undefined,
        notes: trimmed.notes,
        initialDeposit: Number(trimmed.initialDeposit),
      })

      await ensureAutomaticDailyCharges(patient.id, trimmed.admissionDate, patient)

      toast({
        title: 'Patient Admitted',
        description: `${patient.name} registered. Room assignment and daily charges applied.`,
        variant: 'success',
      })
      navigate(`/reception/patient/${patient.id}`)
    } catch (err) {
      toast({ title: 'Admission failed', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <PageHeader title="Add Patient" description="Register a new in-patient with deposit and bed assignment" />

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5" /> Patient Information</CardTitle>
              <CardDescription>All required fields must be completed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
                <FieldError message={errors.name} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Age *</Label>
                  <Input type="number" min="0" max="120" value={form.age} onChange={(e) => set('age', e.target.value)} />
                  <FieldError message={errors.age} />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input type="date" max={new Date().toISOString().split('T')[0]} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
                  <FieldError message={errors.dateOfBirth} />
                </div>
              </div>
              <div>
                <Label>Gender *</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
                <FieldError message={errors.gender} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+251 911 234 567 (optional)" />
                <FieldError message={errors.phone} />
              </div>
              <div>
                <Label>Address *</Label>
                <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
                <FieldError message={errors.address} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Emergency Contact *</Label>
                  <Input value={form.emergencyContact} onChange={(e) => set('emergencyContact', e.target.value)} />
                  <FieldError message={errors.emergencyContact} />
                </div>
                <div>
                  <Label>Emergency Phone</Label>
                  <Input value={form.emergencyPhone} onChange={(e) => set('emergencyPhone', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>MRN</Label>
                  <Input value={form.mrn} onChange={(e) => set('mrn', e.target.value)} placeholder="Medical record number" />
                  <FieldError message={errors.mrn} />
                </div>
                <div>
                  <Label>National ID</Label>
                  <Input value={form.nationalId} onChange={(e) => set('nationalId', e.target.value)} />
                  <FieldError message={errors.nationalId} />
                </div>
              </div>
              <div>
                <Label>Admission Date *</Label>
                <Input type="date" max={new Date().toISOString().split('T')[0]} value={form.admissionDate} onChange={(e) => set('admissionDate', e.target.value)} />
                <FieldError message={errors.admissionDate} />
              </div>
              <div>
                <Label>Admission Reason *</Label>
                <Input value={form.admissionReason} onChange={(e) => set('admissionReason', e.target.value)} placeholder="Reason for admission..." />
                <FieldError message={errors.admissionReason} />
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Additional notes..." />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Bed Assignment</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Room Type *</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.bedType} onChange={(e) => set('bedType', e.target.value)}>
                    {bedTypes.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name} — {formatCurrency(b.dailyRate)}/day
                      </option>
                    ))}
                  </select>
                  <FieldError message={errors.bedType} />
                </div>
                <div>
                  <Label>Bed *</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={form.bedNumber}
                    onChange={(e) => set('bedNumber', e.target.value)}
                  >
                    <option value="">Auto-assign first available</option>
                    {availableBeds.map((b) => (
                      <option key={b.id} value={b.label}>{b.label}</option>
                    ))}
                  </select>
                  <FieldError message={errors.bedNumber} />
                  <p className="text-xs text-muted-foreground mt-1">{availableBeds.length} bed(s) available in this room type.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Initial Deposit</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Deposit Amount (ETB) *</Label>
                  <Input type="number" min={MIN_INITIAL_DEPOSIT} step="0.01" value={form.initialDeposit} onChange={(e) => set('initialDeposit', e.target.value)} placeholder={`Minimum ${formatCurrency(MIN_INITIAL_DEPOSIT)}`} />
                  <FieldError message={errors.initialDeposit} />
                </div>
                <div>
                  <Label>Payment Method *</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.depositType} onChange={(e) => set('depositType', e.target.value)}>
                    {depositTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <FieldError message={errors.depositType} />
                </div>
                {NON_CASH_PAYMENT_METHODS.includes(form.depositType) && (
                  <div>
                    <Label>Payment Reference *</Label>
                    <Input value={form.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)} placeholder="Transaction / reference number" />
                    <FieldError message={errors.referenceNumber} />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate('/reception')} disabled={submitting}>Cancel</Button>
              <Button type="submit" className="flex-1" disabled={submitting}>{submitting ? 'Admitting...' : 'Admit Patient'}</Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
