import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { DoctorPicker } from '@/components/shared/DoctorPicker'
import { useBillingConfig } from '@/context/BillingConfigContext'
import { usePatients } from '@/context/PatientsContext'
import { useToast } from '@/context/ToastContext'
import { api, USE_API } from '@/api/client'
import { bedTypes, depositTypes } from '@/data/mockData'
import { formatCurrency } from '@/lib/utils'
import {
  validateAdmission,
  firstError,
  trimText,
  MIN_INITIAL_DEPOSIT,
  NON_CASH_PAYMENT_METHODS,
} from '@/lib/validation'

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-destructive mt-1">{message}</p>
}

export function ConvertToInpatientDialog({ patient, open, onOpenChange, onConverted }) {
  const { toast } = useToast()
  const { rooms, convertToInpatient } = usePatients()
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
    bedType: bedTypes[0].name,
    bedNumber: '',
    doctorIds: [],
    initialDeposit: '',
    depositType: defaultPaymentMethod,
    referenceNumber: '',
    admissionPaymentMode: 'paid',
    creditCompanyId: '',
  })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [doctors, setDoctors] = useState([])
  const [companies, setCompanies] = useState([])

  useEffect(() => {
    if (!open || !USE_API) return undefined
    let cancelled = false
    api.getDoctors({ active: true }).then((rows) => {
      if (!cancelled) setDoctors(rows)
    }).catch(() => {
      if (!cancelled) setDoctors([])
    })
    return () => { cancelled = true }
  }, [open])

  useEffect(() => {
    if (!open || !USE_API || !creditAdmissionsEnabled) return undefined
    let cancelled = false
    api.listCreditCompanies({ active: true }).then((data) => {
      if (!cancelled) setCompanies(data.companies || [])
    }).catch(() => {
      if (!cancelled) setCompanies([])
    })
    return () => { cancelled = true }
  }, [open, creditAdmissionsEnabled])

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
      name: patient.name,
      gender: patient.gender,
      age: patient.age,
      ...form,
      admissionType: 'normal',
    }
    const validationErrors = validateAdmission(trimmed, {
      rooms,
      existingPatients: [],
      rules: { minimumInitialDeposit, referenceRequiredMethods, paymentMethods },
    })
    if (!form.doctorIds?.length) validationErrors.doctorIds = 'Doctor assignment is required.'
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors)
      toast({ title: 'Please complete conversion details', description: firstError(validationErrors), variant: 'destructive' })
      return
    }

    const room = rooms.find((r) => r.roomType === form.bedType)
    const bedLabel = form.bedNumber || room?.beds.find((b) => b.status === 'available')?.label
    setSubmitting(true)
    try {
      const updated = await convertToInpatient(patient.id, {
        bedId: bedLabel,
        doctorIds: form.doctorIds,
        depositAmount: Number(form.initialDeposit || 0),
        depositMethod: form.depositType,
        referenceNumber: trimText(form.referenceNumber) || undefined,
        admissionPaymentMode: form.admissionPaymentMode,
        creditCompanyId: form.admissionPaymentMode === 'credit' ? form.creditCompanyId : undefined,
      })
      toast({
        title: 'Converted to inpatient',
        description: `${patient.name} now has a bed, doctor, and admission deposit. Earlier Emergency OPD charges are unchanged.`,
        variant: 'success',
      })
      onOpenChange(false)
      onConverted?.(updated)
    } catch (err) {
      toast({ title: 'Conversion failed', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Convert to Inpatient</DialogTitle>
          <DialogDescription>
            Assign a bed, visiting doctor, and admission deposit. Emergency OPD services already recorded keep their original prices.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Room Type *</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.bedType}
              onChange={(e) => set('bedType', e.target.value)}
            >
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
          </div>
          <div>
            <Label>Visiting Doctors *</Label>
            <DoctorPicker
              doctors={doctors}
              selectedIds={form.doctorIds}
              onChange={(ids) => set('doctorIds', ids)}
              disabled={submitting}
            />
            <FieldError message={errors.doctorIds} />
          </div>
          <div>
            <Label>Payment status *</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.admissionPaymentMode}
              onChange={(e) => set('admissionPaymentMode', e.target.value)}
            >
              <option value="paid">Paid</option>
              {creditAdmissionsEnabled && <option value="credit">Credit</option>}
            </select>
          </div>
          {form.admissionPaymentMode === 'credit' && (
            <div>
              <Label>Credit Company *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.creditCompanyId}
                onChange={(e) => set('creditCompanyId', e.target.value)}
              >
                <option value="">Select a credit company</option>
                {companies.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
              <FieldError message={errors.creditCompanyId} />
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
            />
            <FieldError message={errors.initialDeposit} />
          </div>
          <div>
            <Label>Payment Method *</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.depositType}
              onChange={(e) => set('depositType', e.target.value)}
            >
              {paymentMethods.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <FieldError message={errors.depositType} />
          </div>
          {referenceRequiredMethods.includes(form.depositType) && (
            <div>
              <Label>Payment Reference *</Label>
              <Input value={form.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)} />
              <FieldError message={errors.referenceNumber} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? 'Converting…' : 'Convert to Inpatient'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
