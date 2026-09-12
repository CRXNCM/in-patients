import { StatusBadge } from '@/components/shared/CommonComponents'
import { patients } from '@/data/mockData'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { CheckCircle2, XCircle, Clock, FileText } from 'lucide-react'

const statusIcons = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
}

const statusBorder = {
  pending: 'border-amber-200 dark:border-amber-800',
  approved: 'border-emerald-200 dark:border-emerald-800',
  rejected: 'border-red-200 dark:border-red-800',
}

export function ServiceTimeline({ entries, showAudit = true, compact = false }) {
  if (!entries?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No service records yet
      </div>
    )
  }

  return (
    <div className="relative space-y-0">
      {entries.map((entry, index) => {
        const Icon = statusIcons[entry.status] || FileText
        const patient = patients.find((p) => p.id === entry.patientId)
        const isLast = index === entries.length - 1

        return (
          <div key={entry.id} className="relative flex gap-4 pb-6">
            {!isLast && (
              <div className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
            )}
            <div
              className={cn(
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-background',
                statusBorder[entry.status]
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4',
                  entry.status === 'pending' && 'text-amber-600',
                  entry.status === 'approved' && 'text-emerald-600',
                  entry.status === 'rejected' && 'text-red-600'
                )}
              />
            </div>
            <div className={cn('flex-1 min-w-0 rounded-xl border bg-card p-4', statusBorder[entry.status])}>
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-sm">{entry.serviceName}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.category}
                    {!compact && patient && ` · ${patient.name}`}
                  </p>
                </div>
                <StatusBadge status={entry.status} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mb-3">
                <div>
                  <span className="text-muted-foreground">Qty:</span>{' '}
                  <span className="font-medium">{entry.quantity}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Unit:</span>{' '}
                  <span className="font-medium">{formatCurrency(entry.unitPrice)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total:</span>{' '}
                  <span className="font-semibold">{formatCurrency(entry.total)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Source:</span>{' '}
                  <span className="font-medium capitalize">{entry.source}</span>
                </div>
              </div>

              {entry.notes && (
                <p className="text-xs text-muted-foreground mb-2 italic">&ldquo;{entry.notes}&rdquo;</p>
              )}

              {entry.rejectionReason && (
                <p className="text-xs text-red-600 mb-2">Rejection: {entry.rejectionReason}</p>
              )}

              {showAudit && entry.auditTrail?.length > 0 && (
                <AuditTrail trail={entry.auditTrail} />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function AuditTrail({ trail }) {
  const actionLabels = {
    recorded: 'Recorded',
    approved: 'Approved',
    rejected: 'Rejected',
  }

  const actionColors = {
    recorded: 'text-blue-600',
    approved: 'text-emerald-600',
    rejected: 'text-red-600',
  }

  return (
    <div className="mt-3 pt-3 border-t border-dashed">
      <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Audit Trail</p>
      <div className="space-y-1.5">
        {trail.map((item, i) => (
          <div key={i} className="flex flex-wrap items-baseline gap-x-2 text-xs">
            <span className={cn('font-semibold', actionColors[item.action])}>
              {actionLabels[item.action] || item.action}
            </span>
            <span className="text-muted-foreground">by {item.by}</span>
            <span className="text-muted-foreground">· {formatDateTime(item.at)}</span>
            {item.note && <span className="text-muted-foreground w-full sm:w-auto">— {item.note}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
