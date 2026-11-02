import { useEffect, useState } from 'react'
import { CreditCard, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePatients } from '@/context/PatientsContext'
import { computeCreditState, creditCompanyLabel, creditStatusLabel } from '@/lib/credit'
import { formatCurrency } from '@/lib/utils'
import { hospitalSettings, depositTypes } from '@/data/mockData'
import { useBillingConfig } from '@/context/BillingConfigContext'
import { NON_CASH_PAYMENT_METHODS, firstError, trimText, validateDeposit } from '@/lib/validation'
import { useToast } from '@/context/ToastContext'

export function CreditSettlementPanel({
  patient,
  outstanding,
  deposits = [],
  onPaid,
}) {
  const { toast } = useToast()
  const { addCreditPayment } = usePatients()
  const credit = computeCreditState(patient)
  const { settings: hospitalConfig } = useBillingConfig()
  const paymentMethods = hospitalConfig.paymentMethods?.length ? hospitalConfig.paymentMethods : depositTypes
  const referenceRequiredMethods = Array.isArray(hospitalConfig.referenceRequiredMethods)
    ? hospitalConfig.referenceRequiredMethods
    : NON_CASH_PAYMENT_METHODS
  const defaultPaymentMethod = paymentMethods.includes(hospitalConfig.defaultPaymentMethod)
    ? hospitalConfig.defaultPaymentMethod
    : paymentMethods[0]

  const [payerType, setPayerType] = useState('company')
  const [amount, setAmount] = useState(outstanding > 0 ? String(outstanding) : '')
  const [method, setMethod] = useState(defaultPaymentMethod)
  const [referenceNumber, setReferenceNumber] = useState('')
  const [errors, setErrors] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (outstanding > 0) setAmount(String(outstanding))
  }, [outstanding, patient.id])

  if (!credit.isCreditPatient) return null

  const due = Math.max(0, Number(outstanding) || 0)

  const submit = async () => {
    const form = {
      amount: trimText(amount),
      method,
      referenceNumber: trimText(referenceNumber),
    }
    const nextErrors = validateDeposit(form, deposits, { referenceRequiredMethods, paymentMethods })
    if (payerType === 'company' && !patient.creditCompanyId && !patient.creditCompanyName) {
      nextErrors.creditCompanyId = 'This stay has no credit company on file.'
    }
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors)
      toast({ title: 'Please fix the errors', description: firstError(nextErrors), variant: 'destructive' })
      return
    }
    setBusy(true)
    setErrors({})
    try {
      const result = await addCreditPayment(patient.id, {
        payerType: payerType === 'company' ? 'company' : 'self',
        creditCompanyId: payerType === 'company' ? patient.creditCompanyId : undefined,
        amount: Number(form.amount),
        method: form.method,
        referenceNumber: form.referenceNumber || undefined,
      })
      toast({
        title: result.settled ? 'Credit settled' : 'Payment recorded',
        description: result.settled
          ? 'This patient is now a normal cash patient. The record still shows it used to be on credit.'
          : `${formatCurrency(Number(form.amount))} recorded. Remaining credit can be paid later.`,
        variant: 'success',
      })
      setReferenceNumber('')
      onPaid?.(result)
    } catch (err) {
      toast({ title: 'Payment failed', description: err.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-8 border-warning/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-warning" />
          Credit settlement
        </CardTitle>
        <CardDescription>
          Company or patient can pay part or all of the bill. A payment invoice prints after you record it.
          When the outstanding is covered, the stay becomes a normal cash patient.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Credit status</p>
            <p className="font-medium">{creditStatusLabel(credit.depositStatus)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Company on file</p>
            <p className="font-medium">{creditCompanyLabel(patient, 'Not recorded')}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outstanding charges</p>
            <p className="font-semibold tabular-nums">{formatCurrency(due)}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Who is paying">
            <NativeSelect value={payerType} onChange={(event) => setPayerType(event.target.value)}>
              <option value="company">Credit company</option>
              <option value="self">Patient deposit (self pay)</option>
            </NativeSelect>
          </FormField>
          {payerType === 'company' ? (
            <FormField label="Paying company" required error={errors.creditCompanyId}>
              <Input value={creditCompanyLabel(patient, 'No company on this stay')} disabled readOnly />
            </FormField>
          ) : (
            <p className="self-end text-sm text-muted-foreground">
              Record a deposit from the patient. This still goes on the same credit stay until the bill is covered.
            </p>
          )}
          <FormField label={`Amount (${hospitalConfig.currency || hospitalSettings.currency || 'ETB'})`} required error={errors.amount}>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FormField>
          <FormField label="Payment method" required error={errors.method}>
            <NativeSelect value={method} onChange={(event) => setMethod(event.target.value)}>
              {paymentMethods.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </NativeSelect>
          </FormField>
          {referenceRequiredMethods.includes(method) ? (
            <FormField label="Payment reference" required error={errors.referenceNumber}>
              <Input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} />
            </FormField>
          ) : null}
        </div>

        <Button type="button" onClick={submit} disabled={busy}>
          <Printer className="mr-2 h-4 w-4" />
          {busy ? 'Recording…' : 'Pay and print invoice'}
        </Button>
      </CardContent>
    </Card>
  )
}
