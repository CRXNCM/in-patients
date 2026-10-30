import { useWorkflowRequests } from '@/context/WorkflowRequestsContext'
import { medicineSummary } from '@/services/pharmacyFulfillment'
import { StatusBadge } from '@/components/shared/CommonComponents'

export function PharmacyReconciliation({ patientId }) {
  const { pharmacyOrders } = useWorkflowRequests()
  const orders = pharmacyOrders.filter((order) => order.patientId === patientId)
  const openOrders = orders.filter((order) => order.status === 'pending' || order.status === 'partially_fulfilled')
  const lines = orders.flatMap((order) => medicineSummary(order))
  const unfulfilled = lines.filter((line) => line.outstanding > 0 && (line.status === 'pending' || line.status === 'partial'))
  const held = lines.filter((line) => line.netHeld > 0)

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
      <p className="font-semibold">Pharmacy reconciliation</p>
      <p className="mt-1 text-muted-foreground">
        Outstanding pharmacy work for this stay. Discharge is not blocked by these items. Reception still completes discharge under the existing rules.
      </p>
      <ul className="mt-3 space-y-2">
        <li>Open pharmacy requests: {openOrders.length}</li>
        <li>
          Unfulfilled quantities: {unfulfilled.length === 0 ? 'None' : unfulfilled.map((line) => `${line.name} (${line.outstanding})`).join(', ')}
        </li>
        <li>
          Still held by the ward: {held.length === 0 ? 'None' : held.map((line) => `${line.name} (${line.netHeld})`).join(', ')}
        </li>
      </ul>
      {openOrders.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {openOrders.map((order) => <StatusBadge key={order.id} status={order.status} />)}
        </div>
      ) : null}
      <p className="mt-3 text-xs text-muted-foreground">
        A medicine return keeps the original handover. Pharmacy verifies the quantity it accepts, and reception reviews that quantity before any billing adjustment. Quantities still held are listed above.
      </p>
    </div>
  )
}
