import { hospitalSettings } from '@/data/mockData'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'

export function DepositReceipt({ patient, deposit, hospital = hospitalSettings }) {
  if (!patient || !deposit) return null

  return (
    <div className="max-w-md mx-auto bg-white text-gray-900 p-8 rounded-xl border print:border-0">
      <div className="text-center border-b pb-4 mb-4">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold mb-2">
          CC
        </div>
        <h2 className="text-lg font-bold text-blue-700">{hospital.name}</h2>
        <p className="text-xs text-gray-600">{hospital.address}</p>
        <p className="text-xs text-gray-600">TIN: {hospital.tin}</p>
        <p className="text-sm font-semibold mt-3 tracking-wide">DEPOSIT RECEIPT</p>
      </div>

      <div className="space-y-2 text-sm mb-6">
        <div className="flex justify-between"><span className="text-gray-600">Receipt No:</span><span className="font-mono">DEP-{deposit.id}</span></div>
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

      <p className="text-center text-xs text-gray-500">{hospital.receiptFooter}</p>
      <p className="text-center text-xs text-gray-400 mt-4">Keep this receipt for your records</p>
    </div>
  )
}
