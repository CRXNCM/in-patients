import { hospitalSettings } from '@/data/mockData'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { HospitalLogo } from '@/components/shared/HospitalLogo'
import { useBillingConfig } from '@/context/BillingConfigContext'

export function CreditPaymentInvoice({ patient, payment, hospital: hospitalOverride }) {
  const { settings } = useBillingConfig()
  const hospital = { ...hospitalSettings, ...(hospitalOverride || settings) }
  if (!patient || !payment) return null

  const companyPay = payment.payerType === 'credit_company' || payment.payerType === 'company'
  const outstanding = Number(payment.outstandingAfter ?? payment.outstanding ?? 0)
  const remaining = Number(payment.remainingAfter ?? ((Number(patient.deposit) || 0) - (Number(patient.totalCharges) || 0)))

  return (
    <div className="mx-auto max-w-md bg-white p-8 text-gray-900 print:max-w-none print:border-0 print:p-0 print:shadow-none rounded-xl border">
      <div className="mb-4 border-b pb-4 text-center">
        {hospital.invoiceShowLogo !== false && <HospitalLogo size="md" className="mx-auto mb-2" />}
        <h2 className="text-lg font-bold text-blue-700">{hospital.name}</h2>
        {hospital.invoiceHeader && <p className="text-xs font-medium text-gray-700">{hospital.invoiceHeader}</p>}
        {hospital.invoiceShowAddress !== false && hospital.address && (
          <p className="text-xs text-gray-600">{hospital.address}</p>
        )}
        <p className="mt-3 text-sm font-semibold tracking-wide">CREDIT PAYMENT INVOICE</p>
      </div>

      <div className="mb-6 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Invoice No:</span>
          <span className="font-mono">{payment.invoiceNumber || payment.id}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Date:</span>
          <span>{formatDate(payment.date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Printed:</span>
          <span>{formatDateTime(new Date().toISOString())}</span>
        </div>
      </div>

      <div className="mb-4 space-y-1 rounded-lg bg-gray-50 p-4 text-sm">
        <p><span className="text-gray-600">Patient:</span> <strong>{patient.name}</strong></p>
        <p><span className="text-gray-600">Patient ID:</span> {patient.id}</p>
        <p><span className="text-gray-600">Room / Bed:</span> {patient.room || '—'} / {patient.bed || '—'}</p>
        <p>
          <span className="text-gray-600">Payer:</span>{' '}
          <strong>{companyPay ? (payment.creditCompanyName || payment.companyName || 'Credit company') : patient.name}</strong>
        </p>
      </div>

      <div className="mb-4 space-y-2 border-y py-4 text-sm">
        <div className="flex justify-between">
          <span>Payment type</span>
          <span className="font-medium">{companyPay ? 'Company payment' : 'Patient deposit'}</span>
        </div>
        <div className="flex justify-between">
          <span>Method</span>
          <span>{payment.method}</span>
        </div>
        {payment.referenceNumber ? (
          <div className="flex justify-between">
            <span>Reference</span>
            <span className="font-mono text-xs">{payment.referenceNumber}</span>
          </div>
        ) : null}
        <div className="flex justify-between pt-2 text-lg font-bold text-emerald-700">
          <span>Amount paid</span>
          <span>{formatCurrency(payment.amount)}</span>
        </div>
        <div className="flex justify-between">
          <span>Outstanding after this payment</span>
          <span className="tabular-nums">{formatCurrency(outstanding)}</span>
        </div>
        <div className="flex justify-between">
          <span>Current balance</span>
          <span className="tabular-nums">{formatCurrency(remaining)}</span>
        </div>
      </div>

      {payment.settled || payment.formerCredit ? (
        <p className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Credit is settled. This patient is now a normal cash patient. The record still shows it used to be a credit stay.
        </p>
      ) : (
        <p className="mb-4 text-sm text-gray-600">Partial payment. Remaining credit can be paid by the company or as a patient deposit.</p>
      )}

      {hospital.invoiceFooter && <p className="text-center text-xs text-gray-500">{hospital.invoiceFooter}</p>}
    </div>
  )
}
