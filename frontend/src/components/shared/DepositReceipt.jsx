import { hospitalSettings } from '@/data/mockData'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { HospitalLogo } from '@/components/shared/HospitalLogo'
import { useBillingConfig } from '@/context/BillingConfigContext'

export function DepositReceipt({ patient, deposit, hospital: hospitalOverride }) {
  const { settings } = useBillingConfig()
  const hospital = { ...hospitalSettings, ...(hospitalOverride || settings) }
  if (!patient || !deposit) return null

  const receiptPrefix = hospital.receiptPrefix ?? 'DEP-'

  return (
    <div className="max-w-md mx-auto bg-white text-gray-900 p-8 print:p-0 print:max-w-none rounded-xl border print:border-0 print:shadow-none">
      <div className="text-center border-b pb-4 mb-4">
        {hospital.receiptShowLogo !== false && <HospitalLogo size="md" className="mx-auto mb-2" />}
        <h2 className="text-lg font-bold text-blue-700">{hospital.name}</h2>
        {hospital.receiptHeader && <p className="text-xs font-medium text-gray-700">{hospital.receiptHeader}</p>}
        {hospital.receiptShowAddress !== false && hospital.address && (
          <p className="text-xs text-gray-600">{hospital.address}</p>
        )}
        {hospital.receiptShowPhone && hospital.phone && (
          <p className="text-xs text-gray-600">Tel: {hospital.phone}</p>
        )}
        {hospital.receiptShowTin !== false && hospital.tin && (
          <p className="text-xs text-gray-600">TIN: {hospital.tin}</p>
        )}
        <p className="text-sm font-semibold mt-3 tracking-wide">DEPOSIT RECEIPT</p>
      </div>

      <div className="space-y-2 text-sm mb-6">
        <div className="flex justify-between"><span className="text-gray-600">Receipt No:</span><span className="font-mono">{receiptPrefix}{deposit.id}</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Date:</span><span>{formatDate(deposit.date)}</span></div>
        <div className="flex justify-between"><span className="text-gray-600">Printed:</span><span>{formatDateTime(new Date().toISOString())}</span></div>
      </div>

      <div className="rounded-lg bg-gray-50 p-4 mb-4 text-sm space-y-1">
        <p><span className="text-gray-600">Patient:</span> <strong>{patient.name}</strong></p>
        <p><span className="text-gray-600">Patient ID:</span> {patient.id}</p>
        <p><span className="text-gray-600">Room / Bed:</span> {patient.room} / {patient.bed}</p>
      </div>

      <div className="border-y py-4 mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Deposit Type</span>
          <span className="font-medium">{deposit.method}{deposit.isInitial ? ' (Initial)' : ''}</span>
        </div>
        <div className="flex justify-between">
          <span>Received By</span>
          <span>{deposit.receivedBy}</span>
        </div>
        <div className="flex justify-between text-lg font-bold text-emerald-700 pt-2">
          <span>Amount Received</span>
          <span>{formatCurrency(deposit.amount)}</span>
        </div>
      </div>

      {hospital.receiptFooter && <p className="text-center text-xs text-gray-500">{hospital.receiptFooter}</p>}
      <p className="text-center text-xs text-gray-400 mt-4">Keep this receipt for your records</p>
    </div>
  )
}
