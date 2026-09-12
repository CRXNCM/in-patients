import { useState } from 'react'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader, StatusBadge } from '@/components/shared/CommonComponents'
import { BILLING_TYPES, BILLING_TYPE_LABELS } from '@/data/mockData'
import { useBillingConfig } from '@/context/BillingConfigContext'
import { useToast } from '@/context/ToastContext'
import { formatCurrency } from '@/lib/utils'

export default function SettingsPage() {
  const { toast } = useToast()
  const { categories, settings, updateSettings, updateCategoryBillingType } = useBillingConfig()
  const [local, setLocal] = useState({ ...settings })

  const handleSave = async () => {
    try {
      await updateSettings(local)
      toast({ title: 'Settings Saved', description: 'Hospital and billing configuration updated', variant: 'success' })
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' })
    }
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure hospital system and category billing types"
        action={
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" /> Save Changes
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Hospital Information</CardTitle>
            <CardDescription>Basic hospital details for invoices and receipts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Hospital Name</Label><Input value={local.name} onChange={(e) => setLocal((p) => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Address</Label><Input value={local.address} onChange={(e) => setLocal((p) => ({ ...p, address: e.target.value }))} /></div>
            <div><Label>TIN</Label><Input value={local.tin} onChange={(e) => setLocal((p) => ({ ...p, tin: e.target.value }))} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing Configuration</CardTitle>
            <CardDescription>Financial and automatic daily charges</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Currency</Label><Input value={local.currency} onChange={(e) => setLocal((p) => ({ ...p, currency: e.target.value }))} /></div>
            <div><Label>Low Balance Threshold (ETB)</Label><Input type="number" value={local.lowBalanceThreshold} onChange={(e) => setLocal((p) => ({ ...p, lowBalanceThreshold: Number(e.target.value) }))} /></div>
            <div><Label>VAT %</Label><Input type="number" value={local.vatPercent} onChange={(e) => setLocal((p) => ({ ...p, vatPercent: Number(e.target.value) }))} /></div>
            <div><Label>Daily Doctor Visit Fee (ETB)</Label><Input type="number" value={local.dailyDoctorVisitFee} onChange={(e) => setLocal((p) => ({ ...p, dailyDoctorVisitFee: Number(e.target.value) }))} /></div>
            <div><Label>Daily Doctor Visit Name</Label><Input value={local.dailyDoctorVisitName} onChange={(e) => setLocal((p) => ({ ...p, dailyDoctorVisitName: e.target.value }))} /></div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Receipt Footer</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={local.receiptFooter}
              onChange={(e) => setLocal((p) => ({ ...p, receiptFooter: e.target.value }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Category Billing Types</CardTitle>
          <CardDescription>
            Configure how each service category is entered. Changes apply immediately to charge entry screens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Description</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Services</th>
                  <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Billing Type</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id} className="border-b">
                    <td className="px-4 py-3 font-medium">{cat.name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs max-w-xs">{cat.description}</td>
                    <td className="px-4 py-3">{cat.services.length}</td>
                    <td className="px-4 py-3">
                      <select
                        className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
                        value={cat.billingType}
                        onChange={async (e) => {
                          try {
                            await updateCategoryBillingType(cat.id, e.target.value)
                            toast({ title: 'Billing Type Updated', description: `${cat.name} → ${BILLING_TYPE_LABELS[e.target.value]}`, variant: 'success' })
                          } catch (err) {
                            toast({ title: 'Update failed', description: err.message, variant: 'destructive' })
                          }
                        }}
                      >
                        <option value={BILLING_TYPES.QUANTITY}>{BILLING_TYPE_LABELS.quantity}</option>
                        <option value={BILLING_TYPES.SELECTION}>{BILLING_TYPE_LABELS.selection}</option>
                        <option value={BILLING_TYPES.AUTOMATIC_DAILY}>{BILLING_TYPE_LABELS.automatic_daily}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Current doctor visit fee: {formatCurrency(local.dailyDoctorVisitFee)} / day · Room rates follow bed type assignment.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
