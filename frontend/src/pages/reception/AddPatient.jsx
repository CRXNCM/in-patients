import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/CommonComponents'
import { bedTypes, depositTypes } from '@/data/mockData'
import { useBillingConfig } from '@/context/BillingConfigContext'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { useToast } from '@/context/ToastContext'
import { formatCurrency } from '@/lib/utils'
import { DoctorPicker } from '@/components/shared/DoctorPicker'
import { api, USE_API } from '@/api/client'
import {
  validateAdmission,
  findDuplicateNameAgeWarning,
  firstError,
  trimText,
  computeAgeFromDob,
  todayStr,
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
  const { settings: hospitalConfig } = useBillingConfig()

  const paymentMethods = hospitalConfig.paymentMethods?.length ? hospitalConfig.paymentMethods : depositTypes
  const referenceRequiredMethods = Array.isArray(hospitalConfig.referenceRequiredMethods)
    ? hospitalConfig.referenceRequiredMethods
    : NON_CASH_PAYMENT_METHODS
  const minimumInitialDeposit = Number.isFinite(Number(hospitalConfig.minimumInitialDeposit))
    ? Number(hospitalConfig.minimumInitialDeposit)
    : MIN_INITIAL_DEPOSIT
  const creditAdmissionsEnabled = hospitalConfig.creditAdmissionsEnabled !== false
  const defaultPaymentMethod = paymentMethods.includes(hospitalConfig.defaultPaymentMethod)
    ? hospitalConfig.defaultPaymentMethod
    : paymentMethods[0]
  const currencyCode = hospitalConfig.currency || 'ETB'

  const [form, setForm] = useState({
    name: '',
    age: '',
    dateOfBirth: '',
    gender: 'Male',
    phone: '',
    address: '',
    mrn: '',
    nationalId: '',
    bedType: bedTypes[0].name,
    bedNumber: '',
    admissionDate: '',
    initialDeposit: '',
    depositType: defaultPaymentMethod,
    referenceNumber: '',
    notes: '',
    admissionPaymentMode: 'paid',
    doctorIds: [],
    admissionType: 'normal',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [doctors, setDoctors] = useState([])

  const methodKey = paymentMethods.join('|')
  const [methodTouched, setMethodTouched] = useState(false)
  useEffect(() => {
    setForm((prev) => {
      const next = { ...prev }
      if (!methodTouched || !paymentMethods.includes(prev.depositType)) next.depositType = defaultPaymentMethod
      if (!creditAdmissionsEnabled && prev.admissionPaymentMode === 'credit') next.admissionPaymentMode = 'paid'
      return next.depositType === prev.depositType && next.admissionPaymentMode === prev.admissionPaymentMode
        ? prev
        : next
    })
  }, [methodKey, defaultPaymentMethod, creditAdmissionsEnabled, methodTouched, paymentMethods])

  useEffect(() => {
    if (!USE_API) return undefined
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
  }, [])

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
    const admissionDate = trimText(form.admissionDate) || todayStr()
    const trimmed = {
      ...form,
      name: trimText(form.name),
      address: trimText(form.address),
      mrn: trimText(form.mrn),
      nationalId: trimText(form.nationalId),
      referenceNumber: trimText(form.referenceNumber),
      admissionDate,
      admissionPaymentMode: form.admissionPaymentMode,
      doctorIds: form.doctorIds,
    }

    const validationErrors = validateAdmission(trimmed, {
      rooms,
      existingPatients: patients,
      rules: { minimumInitialDeposit, referenceRequiredMethods, paymentMethods },
    })
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
        mrn: trimmed.mrn || undefined,
        nationalId: trimmed.nationalId || undefined,
        room: trimmed.bedType,
        bed: trimmed.bedNumber || undefined,
        admissionDate,
        deposit: Number(trimmed.initialDeposit || 0),
        depositType: trimmed.depositType,
        referenceNumber: trimmed.referenceNumber || undefined,
        notes: trimmed.notes,
        initialDeposit: Number(trimmed.initialDeposit || 0),
        admissionPaymentMode: trimmed.admissionPaymentMode,
        doctorIds: trimmed.doctorIds,
        admissionType: trimmed.admissionType || 'normal',
      })

      await ensureAutomaticDailyCharges(patient.id, admissionDate, patient)

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
                <Label>Admission Type *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={form.admissionType}
                  onChange={(e) => set('admissionType', e.target.value)}
                >
                  <option value="normal">Normal</option>
                  <option value="maternity">Maternity (mother & baby)</option>
                </select>
                {form.admissionType === 'maternity' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    The mother is the primary patient. Newborn details can be added after delivery on the same admission.
                  </p>
                )}
              </div>
              <div>
                <Label>Admission Date</Label>
                <Input type="date" max={todayStr()} value={form.admissionDate} onChange={(e) => set('admissionDate', e.target.value)} />
                <FieldError message={errors.admissionDate} />
                <p className="text-xs text-muted-foreground mt-1">Optional. Defaults to today if left blank.</p>
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
              <CardHeader>
                <CardTitle>Visiting Doctors</CardTitle>
                <CardDescription>Optional. Selected doctors generate a daily visit charge from the admission date.</CardDescription>
              </CardHeader>
              <CardContent>
                <DoctorPicker
                  doctors={doctors}
                  selectedIds={form.doctorIds}
                  onChange={(ids) => set('doctorIds', ids)}
                  disabled={submitting}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Admission Deposit</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Payment status *</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.admissionPaymentMode} onChange={(e) => set('admissionPaymentMode', e.target.value)}>
                    <option value="paid">Paid</option>
                    {creditAdmissionsEnabled && <option value="credit">Credit</option>}
                  </select>
                  {!creditAdmissionsEnabled && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Credit admissions are disabled in hospital settings.
                    </p>
                  )}
                </div>
                {form.admissionPaymentMode === 'credit' && (
                  <div className="rounded-md border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 p-3 text-sm">
                    <p className="font-semibold">CREDIT PATIENT</p>
                    <p className="text-muted-foreground">
                      Required deposit remains {formatCurrency(minimumInitialDeposit)}. Amount paid now can be 0. Outstanding deposit stays visible until later payments cover it.
                    </p>
                  </div>
                )}
                <div>
                  <Label>{form.admissionPaymentMode === 'credit' ? `Amount paid now (${currencyCode})` : `Deposit Amount (${currencyCode}) *`}</Label>
                  <Input
                    type="number"
                    min={form.admissionPaymentMode === 'credit' ? 0 : minimumInitialDeposit}
                    step="0.01"
                    value={form.initialDeposit}
                    onChange={(e) => set('initialDeposit', e.target.value)}
                    placeholder={form.admissionPaymentMode === 'credit' ? '0 if nothing is paid today' : `Minimum ${formatCurrency(minimumInitialDeposit)}`}
                  />
                  <FieldError message={errors.initialDeposit} />
                </div>
                <div>
                  <Label>Payment Method *</Label>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.depositType} onChange={(e) => { setMethodTouched(true); set('depositType', e.target.value) }}>
                    {paymentMethods.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <FieldError message={errors.depositType} />
                </div>
                {referenceRequiredMethods.includes(form.depositType) && (
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
