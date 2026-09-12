import { hospitalSettings } from '@/data/mockData'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function groupInvoiceByCategory(items = []) {
  const groups = []
  const index = new Map()

  items.forEach((item) => {
    const category = item.department || 'Other'
    if (!index.has(category)) {
      const group = { category, items: [], total: 0, quantity: 0 }
      index.set(category, group)
      groups.push(group)
    }
    const group = index.get(category)
    group.items.push(item)
    group.total += Number(item.total) || 0
    group.quantity += Number(item.quantity) || 0
  })

  return groups
}

export function InvoicePreview({
  patient,
  items,
  deposit,
  totalCharges,
  remainingBalance,
  variant = 'detailed',
}) {
  const vatAmount = hospitalSettings.vatPercent > 0 ? totalCharges * (hospitalSettings.vatPercent / 100) : 0
  const grandTotal = totalCharges + vatAmount
  const balancePositive = remainingBalance >= 0
  const groups = groupInvoiceByCategory(items)
  const isSummary = variant === 'summary'

  return (
    <div className="max-w-3xl mx-auto bg-white text-gray-900 p-8 print:p-0 print:max-w-none rounded-xl border print:border-0 print:shadow-none">
      <div className="flex items-start justify-between border-b pb-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl">CC</div>
          <div>
            <h2 className="text-xl font-bold text-blue-700">{hospitalSettings.name}</h2>
            <p className="text-sm text-gray-600">{hospitalSettings.address}</p>
            <p className="text-sm text-gray-600">TIN: {hospitalSettings.tin}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-blue-700">{isSummary ? 'SUMMARY INVOICE' : 'DETAILED INVOICE'}</p>
          <p className="text-sm text-gray-600">Date: {formatDateTime(new Date().toISOString())}</p>
          <p className="text-sm text-gray-600">Patient: {patient.name}</p>
          <p className="text-sm text-gray-600">ID: {patient.id}</p>
        </div>
      </div>

      {isSummary ? (
        <table className="w-full text-sm mb-6">
          <thead>
            <tr className="border-b-2 border-blue-200">
              <th className="py-2 text-left">#</th>
              <th className="py-2 text-left">Category</th>
              <th className="py-2 text-right">Items</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group, idx) => (
              <tr key={group.category} className="border-b border-gray-100">
                <td className="py-2">{idx + 1}</td>
                <td className="py-2 font-medium">{group.category}</td>
                <td className="py-2 text-right">{group.items.length}</td>
                <td className={cn('py-2 text-right', group.total < 0 && 'text-emerald-700')}>
                  {group.total < 0 ? '-' : ''}
                  {formatCurrency(Math.abs(group.total))}
                </td>
              </tr>
            ))}
            {groups.length === 0 && (
              <tr>
                <td colSpan={4} className="py-6 text-center text-gray-500">No approved charges</td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <div className="mb-6 space-y-5">
          {groups.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">No approved charges</p>
          )}
          {groups.map((group) => (
            <div key={group.category}>
              <div className="flex items-center justify-between border-b-2 border-blue-200 pb-1 mb-2">
                <h3 className="text-sm font-bold text-blue-700">{group.category}</h3>
                <span className={cn('text-sm font-semibold', group.total < 0 && 'text-emerald-700')}>
                  {group.total < 0 ? '-' : ''}
                  {formatCurrency(Math.abs(group.total))}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-1.5 text-left font-medium">Date</th>
                    <th className="py-1.5 text-left font-medium">Service</th>
                    <th className="py-1.5 text-right font-medium">Qty</th>
                    <th className="py-1.5 text-right font-medium">Price</th>
                    <th className="py-1.5 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.id} className="border-b border-gray-100">
                      <td className="py-1.5">{formatDate(item.date)}</td>
                      <td className="py-1.5">{item.item}</td>
                      <td className="py-1.5 text-right">{item.quantity}</td>
                      <td className="py-1.5 text-right">{formatCurrency(item.price)}</td>
                      <td className={cn('py-1.5 text-right', item.total < 0 && 'text-emerald-700')}>
                        {item.total < 0 ? '-' : ''}
                        {formatCurrency(Math.abs(item.total))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end mb-6">
        <div className="w-64 space-y-2 text-sm">
          <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(totalCharges)}</span></div>
          {hospitalSettings.vatPercent > 0 && (
            <div className="flex justify-between"><span>VAT ({hospitalSettings.vatPercent}%):</span><span>{formatCurrency(vatAmount)}</span></div>
          )}
          <div className="flex justify-between font-bold text-base border-t pt-2"><span>Grand Total:</span><span>{formatCurrency(grandTotal)}</span></div>
          <div className="flex justify-between text-emerald-700"><span>Total Deposits:</span><span>{formatCurrency(deposit)}</span></div>
          <div className={cn('flex justify-between font-bold text-base border-t pt-2', balancePositive ? 'text-emerald-600' : 'text-red-600')}>
            <span>Remaining Balance:</span>
            <span>{formatCurrency(remainingBalance)}</span>
          </div>
        </div>
      </div>
      <div className="border-t pt-4 text-center text-xs text-gray-500"><p>{hospitalSettings.receiptFooter}</p></div>
    </div>
  )
}
