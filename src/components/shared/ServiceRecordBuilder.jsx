import { useState, useEffect } from 'react'
import { Plus, Trash2, CheckCircle2, RotateCcw, Info, Bed, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBillingConfig } from '@/context/BillingConfigContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { useToast } from '@/context/ToastContext'
import { RoomTransferPanel } from '@/components/shared/RoomTransferPanel'
import { formatCurrency } from '@/lib/utils'
import { BILLING_TYPES } from '@/data/mockData'
import { cn } from '@/lib/utils'
import {
  validateServiceCart,
  validateReturnCart,
  validatePositiveNumber,
  firstError,
  trimText,
} from '@/lib/validation'

export function ServiceRecordBuilder({
  patientId,
  patientName,
  source,
  recordedBy,
  hideMoney = false,
  autoApprove = false,
  onDone,
}) {
  const { toast } = useToast()
  const { categories, settings } = useBillingConfig()
  const {
    buildServiceLine,
    buildReturnLine,
    submitDailyRecord,
    submitPharmacyReturn,
    getPendingEditableRecord,
    getPatientRecords,
  } = useServiceEntries()

  const manualCategories = categories.filter((c) => c.billingType !== BILLING_TYPES.AUTOMATIC_DAILY)
  const pharmacyCategory = categories.find((c) => c.id === 'pharmacy')

  const [mode, setMode] = useState('services')
  const [activeCategory, setActiveCategory] = useState(manualCategories[0]?.name || categories[0]?.name || '')
  const [cart, setCart] = useState([])
  const [returnCart, setReturnCart] = useState([])
  const [checkedItems, setCheckedItems] = useState({})
  const [form, setForm] = useState({ serviceName: '', quantity: 1, notes: '' })
  const [returnForm, setReturnForm] = useState({ serviceName: '', quantity: 1, reason: '' })
  const [editingRecordId, setEditingRecordId] = useState(null)
  const [editingReturnId, setEditingReturnId] = useState(null)
  const [paperSlipRef, setPaperSlipRef] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const pendingDaily = getPendingEditableRecord(patientId, 'daily_services', today)
  const pendingReturn = getPendingEditableRecord(patientId, 'pharmacy_return', today)
  const activeCat = categories.find((c) => c.name === activeCategory)

  useEffect(() => {
    if (pendingDaily && mode === 'services') {
      setCart(pendingDaily.services.filter((s) => s.category !== 'Room Services' && s.category !== 'Doctor Visits'))
      setEditingRecordId(pendingDaily.id)
    }
  }, [pendingDaily?.id])

  useEffect(() => {
    if (pendingReturn && mode === 'returns') {
      setReturnCart(pendingReturn.returnItems)
      setEditingReturnId(pendingReturn.id)
    }
  }, [pendingReturn?.id])

  useEffect(() => {
    setCheckedItems({})
    setForm({ serviceName: '', quantity: 1, notes: '' })
  }, [activeCategory])

  const toggleCheckItem = (serviceName, defaultQty = 1) => {
    setCheckedItems((prev) => {
      const next = { ...prev }
      if (next[serviceName] !== undefined) delete next[serviceName]
      else next[serviceName] = defaultQty
      return next
    })
  }

  const setItemQuantity = (serviceName, qty) => {
    const num = Math.max(1, Number(qty) || 1)
    setCheckedItems((prev) => ({ ...prev, [serviceName]: num }))
  }

  const addCheckedToCart = () => {
    const names = Object.keys(checkedItems)
    if (names.length === 0) {
      toast({ title: 'Select at least one item', variant: 'destructive' })
      return
    }
    if (activeCat?.billingType === BILLING_TYPES.QUANTITY) {
      for (const name of names) {
        const qtyErr = validatePositiveNumber(checkedItems[name], 'Quantity', { min: 0 })
        if (qtyErr) {
          toast({ title: 'Invalid quantity', description: qtyErr, variant: 'destructive' })
          return
        }
      }
    }
    const lines = names.map((name) => {
      const svc = activeCat.services.find((s) => s.name === name)
      return buildServiceLine({
        category: activeCategory,
        serviceName: name,
        quantity: checkedItems[name],
        unitPrice: svc.price,
        notes: '',
      })
    })
    setCart((prev) => [...prev, ...lines])
    setCheckedItems({})
    toast({ title: 'Items added', description: `${lines.length} item(s) added to record`, variant: 'success' })
  }

  const renderChecklistPanel = (description) => (
    <div>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      <div className="grid gap-2 sm:grid-cols-2 mb-4">
        {activeCat.services.map((svc) => {
          const checked = checkedItems[svc.name] !== undefined
          return (
            <div
              key={svc.name}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 transition-colors',
                checked ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input shrink-0"
                checked={checked}
                onChange={() => toggleCheckItem(svc.name)}
              />
              <span className="flex-1 text-sm font-medium min-w-0">{svc.name}</span>
              {!hideMoney && (
                <span className="text-xs text-muted-foreground shrink-0">{formatCurrency(svc.price)}</span>
              )}
              <div className="flex items-center gap-1 shrink-0">
                <Label className="text-xs text-muted-foreground sr-only">Qty</Label>
                <Input
                  type="number"
                  min="1"
                  className="h-8 w-16 text-center"
                  value={checked ? checkedItems[svc.name] : 1}
                  disabled={!checked}
                  onChange={(e) => setItemQuantity(svc.name, e.target.value)}
                />
              </div>
            </div>
          )
        })}
      </div>
      <Button type="button" onClick={addCheckedToCart} disabled={Object.keys(checkedItems).length === 0}>
        <Plus className="h-4 w-4 mr-1" /> Add Selected ({Object.keys(checkedItems).length})
      </Button>
    </div>
  )

  const handleDoneServices = async () => {
    const cartErrors = validateServiceCart(cart, activeCategory, categories)
    if (Object.keys(cartErrors).length) {
      toast({ title: 'Validation error', description: firstError(cartErrors), variant: 'destructive' })
      return
    }

    const slip = trimText(paperSlipRef)
    if (slip) {
      const cartKey = cart.map((s) => `${s.serviceName}:${s.quantity}`).sort().join('|')
      const duplicate = getPatientRecords(patientId).find((r) => {
        if (r.recordDate !== today || r.status === 'rejected') return false
        const key = (r.services || []).map((s) => `${s.serviceName}:${s.quantity}`).sort().join('|')
        return key === cartKey
      })
      if (duplicate && !window.confirm('A record with the same services already exists for today. Submit anyway?')) {
        return
      }
    }

    const servicesPayload = cart.map((line, i) =>
      i === 0 && slip ? { ...line, notes: `${line.notes || ''} Paper slip #${slip}`.trim() } : line
    )

    setSubmitting(true)
    const count = cart.length
    try {
      await submitDailyRecord({
        patientId,
        services: servicesPayload,
        source,
        recordedBy,
        existingRecordId: editingRecordId,
        recordDate: today,
      })
      setCart([])
      setEditingRecordId(null)
      setPaperSlipRef('')
      toast({
        title: autoApprove ? 'Record Saved' : 'Daily Record Submitted',
        description: autoApprove
          ? `${patientName} — ${count} service(s) added`
          : `${patientName} — sent to reception for approval`,
        variant: 'success',
      })
      onDone?.()
    } catch (err) {
      toast({ title: 'Submit failed', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const addToReturnCart = () => {
    if (!returnForm.serviceName) {
      toast({ title: 'Select a medicine', variant: 'destructive' })
      return
    }
    const qtyErr = validatePositiveNumber(returnForm.quantity, 'Return quantity', { min: 0 })
    if (qtyErr) {
      toast({ title: 'Invalid quantity', description: qtyErr, variant: 'destructive' })
      return
    }
    const med = pharmacyCategory?.services.find((s) => s.name === returnForm.serviceName)
    if (!med) return
    const line = buildReturnLine({
      serviceName: returnForm.serviceName,
      quantity: returnForm.quantity,
      unitPrice: med.price,
      reason: returnForm.reason,
    })
    setReturnCart((prev) => [...prev, line])
    setReturnForm({ serviceName: '', quantity: 1, reason: '' })
    toast({ title: 'Added to return', description: returnForm.serviceName, variant: 'success' })
  }

  const handleDoneReturn = async () => {
    const returnErrors = validateReturnCart(returnCart)
    if (Object.keys(returnErrors).length) {
      toast({ title: 'Validation error', description: firstError(returnErrors), variant: 'destructive' })
      return
    }
    setSubmitting(true)
    try {
      await submitPharmacyReturn({
        patientId,
        returnItems: returnCart,
        source,
        recordedBy,
        existingRecordId: editingReturnId,
      })
      setReturnCart([])
      setEditingReturnId(null)
      toast({
        title: autoApprove ? 'Return Saved' : 'Pharmacy Return Submitted',
        description: `${patientName} — reception will cross-check`,
        variant: 'success',
      })
      onDone?.()
    } catch (err) {
      toast({ title: 'Submit failed', description: err.message, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const renderCategoryPanel = () => {
    if (!activeCat) return null

    if (activeCat.billingType === BILLING_TYPES.AUTOMATIC_DAILY) {
      const isRoom = activeCat.id === 'room'
      return (
        <div className="space-y-6">
          <div className="rounded-xl border bg-muted/30 p-6 text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mx-auto">
              {isRoom ? <Bed className="h-6 w-6" /> : <Stethoscope className="h-6 w-6" />}
            </div>
            <h3 className="font-semibold">{activeCat.name}</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {isRoom
                ? 'Room charges are calculated automatically from the patient\'s room assignment history.'
                : 'This category is billed automatically once per admission day.'}
            </p>
            {!isRoom && !hideMoney && (
              <p className="text-sm font-medium text-primary">
                Daily fee: {formatCurrency(settings.dailyDoctorVisitFee)}
              </p>
            )}
            <div className="flex items-start gap-2 text-left text-xs text-muted-foreground bg-background rounded-lg p-3 border max-w-md mx-auto">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {isRoom
                  ? 'If the room changes, the correct rate applies from the transfer date onward. No manual entry needed.'
                  : 'Reception can disable a specific day\'s doctor visit if the doctor did not visit. No manual entry needed.'}
              </span>
            </div>
          </div>
          {isRoom && !hideMoney && (
            <div className="rounded-xl border p-4 text-left">
              <RoomTransferPanel patientId={patientId} assignedBy={recordedBy} />
            </div>
          )}
        </div>
      )
    }

    if (
      activeCat.billingType === BILLING_TYPES.SELECTION ||
      activeCat.billingType === BILLING_TYPES.QUANTITY
    ) {
      return renderChecklistPanel(`${activeCat.description} — select items and set quantity for each.`)
    }

    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Charge Entry — {patientName}</CardTitle>
        <CardDescription>
          {hideMoney
            ? 'Entry form changes by category type. Click Done when the day\'s record is complete.'
            : 'Quantity, selection, or automatic billing depending on category.'}
          {editingRecordId && mode === 'services' && (
            <span className="block text-amber-600 mt-1">Editing pending record — reception has not approved yet</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={setMode} className="mb-4">
          <TabsList>
            <TabsTrigger value="services">Services</TabsTrigger>
            <TabsTrigger value="returns">
              <RotateCcw className="h-4 w-4 mr-1" /> Pharmacy Returns
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === 'services' ? (
          <>
            <Tabs value={activeCategory} onValueChange={setActiveCategory}>
              <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1 mb-4">
                {categories.map((cat) => (
                  <TabsTrigger key={cat.id} value={cat.name} className="text-xs">
                    {cat.name}
                  </TabsTrigger>
                ))}
              </TabsList>
              {categories.map((cat) => (
                <TabsContent key={cat.id} value={cat.name}>
                  {activeCategory === cat.name && renderCategoryPanel()}
                </TabsContent>
              ))}
            </Tabs>

            {cart.length > 0 && (
              <div className="mt-6 rounded-xl border overflow-hidden">
                <div className="bg-muted/50 px-4 py-2 font-semibold text-sm">Current Record ({cart.length} items)</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left">Category</th>
                      <th className="px-4 py-2 text-left">Service</th>
                      <th className="px-4 py-2 text-left">Qty</th>
                      {!hideMoney && <th className="px-4 py-2 text-right">Total</th>}
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((item, idx) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-4 py-2 text-muted-foreground">{item.category}</td>
                        <td className="px-4 py-2 font-medium">{item.serviceName}</td>
                        <td className="px-4 py-2">{item.quantity}</td>
                        {!hideMoney && <td className="px-4 py-2 text-right">{formatCurrency(item.total)}</td>}
                        <td className="px-4 py-2">
                          <Button variant="ghost" size="icon" onClick={() => setCart((p) => p.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeCat?.billingType !== BILLING_TYPES.AUTOMATIC_DAILY && (
              <div className="flex flex-wrap gap-2 mt-6 items-end">
                <div className="flex-1 min-w-[180px]">
                  <Label className="text-xs">Paper Slip # (optional)</Label>
                  <Input
                    placeholder="e.g. 12345"
                    value={paperSlipRef}
                    onChange={(e) => setPaperSlipRef(e.target.value)}
                    disabled={submitting}
                  />
                </div>
                {pendingDaily && !editingRecordId && (
                  <Button variant="outline" onClick={() => {
                    setCart(pendingDaily.services.filter((s) => !['Room Services', 'Doctor Visits'].includes(s.category)))
                    setEditingRecordId(pendingDaily.id)
                  }} disabled={submitting}>
                    Edit Pending Record
                  </Button>
                )}
                <Button className="flex-1 sm:flex-none" size="lg" onClick={handleDoneServices} disabled={submitting || cart.length === 0}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> {submitting ? 'Saving...' : 'Done — Save Record'}
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              Record medicines returned to pharmacy. Reception will cross-check before removing from the patient record.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end mb-4">
              <div className="lg:col-span-2">
                <Label>Medicine</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={returnForm.serviceName}
                  onChange={(e) => setReturnForm((p) => ({ ...p, serviceName: e.target.value }))}
                >
                  <option value="">Select medicine...</option>
                  {pharmacyCategory?.services.map((s) => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Quantity Returned</Label>
                <Input type="number" min="1" value={returnForm.quantity} onChange={(e) => setReturnForm((p) => ({ ...p, quantity: e.target.value }))} />
              </div>
              <div>
                <Button type="button" onClick={addToReturnCart} className="w-full"><Plus className="h-4 w-4 mr-1" /> Add</Button>
              </div>
            </div>
            <div className="mb-4">
              <Label>Return Reason</Label>
              <Input placeholder="Unused, expired, wrong order..." value={returnForm.reason} onChange={(e) => setReturnForm((p) => ({ ...p, reason: e.target.value }))} />
            </div>
            {returnCart.length > 0 && (
              <div className="rounded-xl border overflow-hidden mb-4">
                <div className="bg-red-50 dark:bg-red-950/30 px-4 py-2 font-semibold text-sm text-red-700">Return Items ({returnCart.length})</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left">Medicine</th>
                      <th className="px-4 py-2 text-left">Qty</th>
                      <th className="px-4 py-2 text-left">Reason</th>
                      {!hideMoney && <th className="px-4 py-2 text-right">Credit</th>}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnCart.map((item, idx) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-4 py-2 font-medium">{item.serviceName}</td>
                        <td className="px-4 py-2">{item.quantity}</td>
                        <td className="px-4 py-2 text-muted-foreground">{item.reason || '—'}</td>
                        {!hideMoney && <td className="px-4 py-2 text-right text-emerald-600">-{formatCurrency(item.total)}</td>}
                        <td className="px-4 py-2">
                          <Button variant="ghost" size="icon" onClick={() => setReturnCart((p) => p.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button size="lg" variant="destructive" onClick={handleDoneReturn} disabled={submitting || returnCart.length === 0}>
              <CheckCircle2 className="h-4 w-4 mr-2" /> {submitting ? 'Submitting...' : 'Done — Submit Return'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
