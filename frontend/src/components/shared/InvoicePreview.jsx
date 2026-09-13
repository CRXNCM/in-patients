import { hospitalSettings } from '@/data/mockData'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { HospitalLogo } from '@/components/shared/HospitalLogo'
import { useBillingConfig } from '@/context/BillingConfigContext'

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

function Amount({ value, className }) {
  const negative = Number(value) < 0
  return (
    <span className={cn('tabular-nums', negative && 'text-emerald-700', className)}>
      {negative ? '-' : ''}
      {formatCurrency(Math.abs(Number(value) || 0))}
    </span>
  )
}

function MetaField({ label, value, mono }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">{label}</dt>
      <dd className={cn('mt-1 text-sm font-medium text-slate-800', mono && 'font-mono text-xs')}>{value}</dd>
    </div>
  )
}

export function InvoicePreview({
  patient,
  items,
  deposit,
  totalCharges,
  remainingBalance: _remainingBalance,
  variant = 'detailed',
  hospital: hospitalOverride,
}) {
  const { settings } = useBillingConfig()
  const hospital = { ...hospitalSettings, ...(hospitalOverride || settings) }
  const vatPercent = Number(hospital.vatPercent) || 0
  const vatAmount = vatPercent > 0 ? totalCharges * (vatPercent / 100) : 0
  const grandTotal = totalCharges + vatAmount
  const invoiceRemaining = deposit - grandTotal
  const balancePositive = invoiceRemaining >= 0
  const groups = groupInvoiceByCategory(items)
  const isSummary = variant === 'summary'
  const location = [patient?.room, patient?.bed].filter(Boolean).join(' / ')
  const footerText = hospital.invoiceFooter || hospital.receiptFooter

  return (
    <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 print:max-w-none print:overflow-visible print:rounded-none print:shadow-none print:ring-0">
      <div className="flex flex-col gap-6 border-b border-slate-200 bg-gradient-to-br from-slate-50 via-white to-white px-8 py-7 sm:flex-row sm:items-start sm:justify-between print:bg-white print:px-0 print:pt-0">
        <div className="flex items-center gap-4">
          {hospital.invoiceShowLogo !== false && <HospitalLogo size="lg" className="shrink-0" />}
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">{hospital.name}</h2>
            {hospital.invoiceHeader && (
              <p className="mt-0.5 text-xs font-medium text-slate-600">{hospital.invoiceHeader}</p>
            )}
            {hospital.invoiceShowAddress !== false && hospital.address && (
              <p className="mt-0.5 text-xs text-slate-500">{hospital.address}</p>
            )}
            {hospital.invoiceShowPhone && hospital.phone && (
              <p className="text-xs text-slate-500">Tel: {hospital.phone}</p>
            )}
            {hospital.invoiceShowTin !== false && hospital.tin && (
              <p className="text-xs text-slate-500">TIN: {hospital.tin}</p>
            )}
          </div>
        </div>
        <div className="sm:text-right">
          <span className="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700 ring-1 ring-sky-100 print:bg-white print:px-0 print:text-slate-900 print:ring-0">
            {isSummary ? 'Summary Invoice' : 'Detailed Invoice'}
          </span>
          <p className="mt-3 text-xs text-slate-500">Date: {formatDateTime(new Date().toISOString())}</p>
        </div>
      </div>

      <dl className="grid gap-x-8 gap-y-4 border-b border-slate-200 px-8 py-5 sm:grid-cols-2 lg:grid-cols-4 print:px-0">
        <MetaField label="Patient" value={patient.name} />
        <MetaField label="Patient ID" value={patient.id} mono />
        {location && <MetaField label="Room / Bed" value={location} />}
        {patient.admissionDate && <MetaField label="Admitted" value={formatDate(patient.admissionDate)} />}
      </dl>

      <div className="px-8 py-6 print:px-0">
        {isSummary ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                <th className="w-10 py-2.5 text-left font-medium">#</th>
                <th className="py-2.5 text-left font-medium">Category</th>
                <th className="py-2.5 text-right font-medium">Items</th>
                <th className="py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group, idx) => (
                <tr key={group.category} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 text-slate-400 tabular-nums">{idx + 1}</td>
                  <td className="py-3 font-medium text-slate-800">{group.category}</td>
                  <td className="py-3 text-right text-slate-500 tabular-nums">{group.items.length}</td>
                  <td className="py-3 text-right font-medium">
                    <Amount value={group.total} />
                  </td>
                </tr>
              ))}
              {groups.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-sm text-slate-400">
                    No approved charges
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="space-y-4">
            {groups.length === 0 && (
              <p className="py-10 text-center text-sm text-slate-400">No approved charges</p>
            )}
            {groups.map((group) => (
              <section
                key={group.category}
                className="overflow-hidden rounded-xl ring-1 ring-slate-200 print:overflow-visible print:rounded-none print:border print:border-slate-300 print:ring-0"
              >
                <header className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-2.5 print:break-after-avoid print:bg-white">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">{group.category}</h3>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200 print:px-0 print:ring-0">
                      {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <Amount value={group.total} className="text-sm font-semibold" />
                </header>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] uppercase tracking-[0.14em] text-slate-400">
                      <th className="py-2 pl-4 text-left font-medium">Date</th>
                      <th className="py-2 text-left font-medium">Service</th>
                      <th className="py-2 text-right font-medium">Qty</th>
                      <th className="py-2 text-right font-medium">Price</th>
                      <th className="py-2 pr-4 text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pl-4 text-slate-500 tabular-nums">{formatDate(item.date)}</td>
                        <td className="py-2.5 pr-3 text-slate-800">{item.item}</td>
                        <td className="py-2.5 text-right text-slate-500 tabular-nums">{item.quantity}</td>
                        <td className="py-2.5 text-right text-slate-500 tabular-nums">{formatCurrency(item.price)}</td>
                        <td className="py-2.5 pr-4 text-right font-medium">
                          <Amount value={item.total} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end px-8 pb-7 print:px-0">
        <dl className="w-full max-w-xs space-y-2 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-slate-200 print:bg-white print:border print:border-slate-300 print:ring-0">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Subtotal</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(totalCharges)}</dd>
          </div>
          {vatPercent > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-slate-500">VAT ({vatPercent}%)</dt>
              <dd className="font-medium tabular-nums">{formatCurrency(vatAmount)}</dd>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-200 pt-2">
            <dt className="font-semibold text-slate-900">Grand Total</dt>
            <dd className="text-base font-semibold tabular-nums">{formatCurrency(grandTotal)}</dd>
          </div>
          <div className="flex items-center justify-between text-emerald-700">
            <dt>Total Deposits</dt>
            <dd className="font-medium tabular-nums">{formatCurrency(deposit)}</dd>
          </div>
          <div
            className={cn(
              'flex items-center justify-between border-t border-slate-200 pt-2 font-semibold',
              balancePositive ? 'text-emerald-600' : 'text-red-600'
            )}
          >
            <dt>Remaining Balance</dt>
            <dd className="text-base tabular-nums">{formatCurrency(invoiceRemaining)}</dd>
          </div>
        </dl>
      </div>

      {footerText && (
        <div className="border-t border-slate-200 px-8 py-5 text-center text-[11px] text-slate-500 print:px-0">
          <p>{footerText}</p>
        </div>
      )}
    </div>
  )
}
