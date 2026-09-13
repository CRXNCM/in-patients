import { StatusBadge, Pagination, usePagedItems } from '@/components/shared/CommonComponents'
import { AuditTrail } from '@/components/shared/ServiceTimeline'
import { computeRecordTotal } from '@/context/ServiceEntriesContext'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, Clock, FileText, RotateCcw } from 'lucide-react'

const statusIcons = { pending: Clock, approved: CheckCircle2, rejected: XCircle }
const statusBorder = {
  pending: 'border-amber-200 dark:border-amber-800',
  approved: 'border-emerald-200 dark:border-emerald-800',
  rejected: 'border-red-200 dark:border-red-800',
}

export function RecordTimeline({ records, showAudit = true, hideMoney = false, pageSize, showSubject = false }) {
  const { page, setPage, pageCount, slice, total, pageSize: size } = usePagedItems(records, pageSize)

  if (!records?.length) {
    return <div className="text-center py-8 text-muted-foreground text-sm">No records yet</div>
  }

  return (
    <div>
    <div className="relative space-y-0">
      {slice.map((record, index) => {
        const Icon = record.type === 'pharmacy_return' ? RotateCcw : (statusIcons[record.status] || FileText)
        const isLast = index === slice.length - 1
        const total = computeRecordTotal(record)

        return (
          <div key={record.id} className="relative flex gap-4 pb-6">
            {!isLast && <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />}
            <div className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-background', statusBorder[record.status])}>
              <Icon className={cn('h-4 w-4', record.type === 'pharmacy_return' ? 'text-orange-600' : record.status === 'pending' ? 'text-amber-600' : record.status === 'approved' ? 'text-emerald-600' : 'text-red-600')} />
            </div>
            <div className={cn('flex-1 min-w-0 rounded-xl border bg-card p-4', statusBorder[record.status])}>
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <p className="font-semibold">{record.recordName}</p>
                  <p className="text-xs text-muted-foreground">
                    {showSubject ? `${record.subjectType === 'baby' ? 'Baby' : 'Mother'} · ` : ''}
                    {record.type === 'pharmacy_return' ? 'Pharmacy Return' : 'Daily Services'} · {formatDate(record.recordDate)} · {record.recordedBy}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={record.status} />
                  {!hideMoney && (
                    <span className={cn('text-sm font-semibold', total < 0 ? 'text-emerald-600' : '')}>
                      {total < 0 ? '-' : ''}{formatCurrency(Math.abs(total))}
                    </span>
                  )}
                </div>
              </div>

              {record.type === 'daily_services' && record.services?.length > 0 && (
                <div className="rounded-lg border overflow-hidden mb-3">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-muted/50 border-b"><th className="px-3 py-2 text-left">Category</th><th className="px-3 py-2 text-left">Service</th><th className="px-3 py-2">Qty</th>{!hideMoney && <th className="px-3 py-2 text-right">Amount</th>}</tr></thead>
                    <tbody>
                      {record.services.map((s) => (
                        <tr key={s.id} className="border-b last:border-0">
                          <td className="px-3 py-2 text-muted-foreground">{s.category}</td>
                          <td className="px-3 py-2 font-medium">{s.serviceName}</td>
                          <td className="px-3 py-2 text-center">{s.quantity}</td>
                          {!hideMoney && <td className="px-3 py-2 text-right">{formatCurrency(s.total)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {record.type === 'pharmacy_return' && record.returnItems?.length > 0 && (
                <div className="rounded-lg border border-orange-200 overflow-hidden mb-3">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-orange-50 dark:bg-orange-950/30 border-b"><th className="px-3 py-2 text-left">Medicine</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2 text-left">Reason</th>{!hideMoney && <th className="px-3 py-2 text-right">Credit</th>}</tr></thead>
                    <tbody>
                      {record.returnItems.map((item) => (
                        <tr key={item.id} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">{item.serviceName}</td>
                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                          <td className="px-3 py-2 text-muted-foreground">{item.reason || '—'}</td>
                          {!hideMoney && <td className="px-3 py-2 text-right text-emerald-600">-{formatCurrency(item.total)}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {record.rejectionReason && <p className="text-xs text-red-600 mb-2">Rejected: {record.rejectionReason}</p>}
              {showAudit && record.auditTrail?.length > 0 && <AuditTrail trail={record.auditTrail} />}
            </div>
          </div>
        )
      })}
    </div>
    <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={total} pageSize={size} />
    </div>
  )
}

export function RecordDetailView({ record, showMoney = true }) {
  if (!record) return null
  const total = computeRecordTotal(record)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><span className="text-muted-foreground">Record Name:</span> <strong>{record.recordName}</strong></div>
        <div><span className="text-muted-foreground">Type:</span> {record.type === 'pharmacy_return' ? 'Pharmacy Return' : 'Daily Services'}</div>
        <div><span className="text-muted-foreground">Date:</span> {formatDate(record.recordDate)}</div>
        <div><span className="text-muted-foreground">Recorded By:</span> {record.recordedBy}</div>
        <div><span className="text-muted-foreground">Submitted:</span> {formatDateTime(record.recordedAt)}</div>
        <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={record.status} /></div>
        {showMoney && (
          <div className="col-span-2"><span className="text-muted-foreground">Record Total:</span> <strong className={total < 0 ? 'text-emerald-600' : ''}>{total < 0 ? '-' : ''}{formatCurrency(Math.abs(total))}</strong></div>
        )}
      </div>

      {record.type === 'daily_services' && (
        <div>
          <p className="text-sm font-semibold mb-2">Services ({record.services?.length || 0})</p>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-3 py-2 text-left">Category</th>
                  <th className="px-3 py-2 text-left">Service</th>
                  <th className="px-3 py-2 text-center">Qty</th>
                  {showMoney && <th className="px-3 py-2 text-right">Unit Price</th>}
                  {showMoney && <th className="px-3 py-2 text-right">Total</th>}
                  <th className="px-3 py-2 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {record.services?.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{s.category}</td>
                    <td className="px-3 py-2 font-medium">{s.serviceName}</td>
                    <td className="px-3 py-2 text-center">{s.quantity}</td>
                    {showMoney && <td className="px-3 py-2 text-right">{formatCurrency(s.unitPrice)}</td>}
                    {showMoney && <td className="px-3 py-2 text-right font-semibold">{formatCurrency(s.total)}</td>}
                    <td className="px-3 py-2 text-xs text-muted-foreground">{s.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {record.type === 'pharmacy_return' && (
        <div>
          <p className="text-sm font-semibold mb-2 text-orange-700">Returned Medicines ({record.returnItems?.length || 0})</p>
          <div className="rounded-lg border border-orange-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-orange-50 dark:bg-orange-950/30 border-b">
                  <th className="px-3 py-2 text-left">Medicine</th>
                  <th className="px-3 py-2 text-center">Qty Returned</th>
                  {showMoney && <th className="px-3 py-2 text-right">Unit Price</th>}
                  {showMoney && <th className="px-3 py-2 text-right">Credit</th>}
                  <th className="px-3 py-2 text-left">Reason</th>
                </tr>
              </thead>
              <tbody>
                {record.returnItems?.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{item.serviceName}</td>
                    <td className="px-3 py-2 text-center">{item.quantity}</td>
                    {showMoney && <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>}
                    {showMoney && <td className="px-3 py-2 text-right text-emerald-600 font-semibold">-{formatCurrency(item.total)}</td>}
                    <td className="px-3 py-2 text-muted-foreground">{item.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {record.auditTrail?.length > 0 && <AuditTrail trail={record.auditTrail} />}
    </div>
  )
}
