import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/shared/CommonComponents'
import { useAuth } from '@/context/AuthContext'
import { useWorkflowRequests } from '@/context/WorkflowRequestsContext'
import { formatDateTime } from '@/lib/utils'
import { medicineSummary } from '@/services/pharmacyFulfillment'

function queuePath(roleKey, kind) {
  if (roleKey === 'pharmacist' && kind === 'pharmacy') return '/pharmacist'
  if (roleKey === 'nurse' && kind === 'pharmacy') return '/nurse/pharmacy'
  if (roleKey === 'admin' && kind === 'pharmacy') return '/admin/pharmacy-requests'
  if (roleKey === 'laboratory' && kind === 'laboratory') return '/laboratory'
  if (roleKey === 'nurse' && kind === 'laboratory') return '/nurse/laboratory'
  if (roleKey === 'admin' && kind === 'laboratory') return '/admin/laboratory-requests'
  return null
}

export function PatientWorkflowPanel({ patient }) {
  const { user } = useAuth()
  const { pharmacyOrders, laboratoryOrders } = useWorkflowRequests()
  const orders = pharmacyOrders.filter((order) => order.patientId === patient?.id)
  const laboratoryRows = laboratoryOrders.filter((order) => order.patientId === patient?.id)
  const pharmacyPath = queuePath(user?.roleKey, 'pharmacy')
  const laboratoryPath = queuePath(user?.roleKey, 'laboratory')

  if (!patient) return null

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="text-lg">Pharmacy and laboratory status</CardTitle>
        <CardDescription>
          Submitted from this patient's record. Handover and returns stay visible here. Current held quantity is what was handed over minus what was returned.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="pharmacy">
          <TabsList>
            <TabsTrigger value="pharmacy">Pharmacy</TabsTrigger>
            <TabsTrigger value="laboratory">Laboratory</TabsTrigger>
          </TabsList>
          <TabsContent value="pharmacy" className="space-y-3">
            {pharmacyPath ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to={pharmacyPath}>Open pharmacy queue</Link>
                </Button>
              </div>
            ) : null}
            {orders.length === 0 ? <p className="text-sm text-muted-foreground">No pharmacy requests for this admission.</p> : orders.map((order) => (
              <div key={order.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{formatDateTime(order.requestedAt)} · {order.requestedByName}</p>
                  <StatusBadge status={order.status} />
                </div>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {medicineSummary(order).map((line) => (
                    <li key={line.lineId}>
                      {line.name}: requested {line.requestedQuantity}, handed over {line.suppliedQuantity}, returned {line.returned}, currently held {line.netHeld}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="laboratory" className="space-y-3">
            {laboratoryPath ? (
              <div className="flex justify-end">
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to={laboratoryPath}>Open laboratory queue</Link>
                </Button>
              </div>
            ) : null}
            {laboratoryRows.length === 0 ? <p className="text-sm text-muted-foreground">No laboratory requests for this admission.</p> : laboratoryRows.map((order) => (
              <div key={order.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{formatDateTime(order.requestedAt)} · {order.requestedByName}</p>
                  <StatusBadge status={order.status} />
                </div>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {(order.items || []).map((item) => (
                    <li key={item.lineId}>
                      {item.name}: {item.status}
                      {item.receptionStatus === 'approved' ? ' · reception approved' : item.receptionStatus === 'pending' ? ' · waiting for reception' : ''}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
