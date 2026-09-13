import { useEffect, useMemo, useState } from 'react'
import { Save, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/CommonComponents'
import { BILLING_TYPES, BILLING_TYPE_LABELS, PAYMENT_METHOD_OPTIONS } from '@/data/mockData'
import { useBillingConfig } from '@/context/BillingConfigContext'
import { useToast } from '@/context/ToastContext'
import { formatCurrency } from '@/lib/utils'
import { validateHospitalSettings, firstError, hasErrors } from '@/lib/validation'

const EDITABLE_KEYS = [
  'name', 'address', 'tin', 'phone', 'email',
  'currency', 'vatPercent', 'paymentMethods', 'defaultPaymentMethod', 'referenceRequiredMethods',
  'dailyDoctorVisitFee', 'dailyDoctorVisitName',
  'receiptHeader', 'receiptFooter', 'receiptPrefix',
  'receiptShowLogo', 'receiptShowAddress', 'receiptShowPhone', 'receiptShowTin',
  'invoiceHeader', 'invoiceFooter',
  'invoiceShowLogo', 'invoiceShowAddress', 'invoiceShowPhone', 'invoiceShowTin',
  'lowBalanceThreshold', 'minimumInitialDeposit', 'creditAdmissionsEnabled', 'allowDischargeWithOutstandingBalance',
  'timezone', 'dateFormat', 'timeFormat', 'listPageSize',
]

const NUMBER_KEYS = ['vatPercent', 'dailyDoctorVisitFee', 'lowBalanceThreshold', 'minimumInitialDeposit', 'listPageSize']
const BOOLEAN_KEYS = [
  'receiptShowLogo', 'receiptShowAddress', 'receiptShowPhone', 'receiptShowTin',
  'invoiceShowLogo', 'invoiceShowAddress', 'invoiceShowPhone', 'invoiceShowTin',
  'creditAdmissionsEnabled', 'allowDischargeWithOutstandingBalance',
]

const DATE_FORMAT_OPTIONS = [
  { value: 'locale', label: 'Sep 13, 2026 (default)' },
  { value: 'iso', label: '2026-09-13' },
  { value: 'dmy', label: '13/09/2026' },
]

const TIME_FORMAT_OPTIONS = [
  { value: 'locale', label: 'Follow browser (default)' },
  { value: '12h', label: '02:30 PM' },
  { value: '24h', label: '14:30' },
]

const selectClass =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

const textareaClass =
  'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

function toFormState(settings) {
  const form = {}
  for (const key of EDITABLE_KEYS) {
    const value = settings?.[key]
    if (BOOLEAN_KEYS.includes(key)) form[key] = Boolean(value)
    else if (NUMBER_KEYS.includes(key)) form[key] = value === null || value === undefined ? '' : String(value)
    else if (key === 'paymentMethods' || key === 'referenceRequiredMethods') form[key] = Array.isArray(value) ? [...value] : []
    else form[key] = value ?? ''
  }
  return form
}

/** Only changed fields are sent, so an untouched section can never be overwritten. */
function buildPatch(form, baseline) {
  const patch = {}
  for (const key of EDITABLE_KEYS) {
    const next = form[key]
    const prev = baseline[key]
    if (JSON.stringify(next) === JSON.stringify(prev)) continue
    if (NUMBER_KEYS.includes(key)) patch[key] = next === '' ? null : Number(next)
    else patch[key] = next
  }
  return patch
}

function Field({ label, hint, error, htmlFor, children }) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

function ToggleRow({ id, label, hint, checked, onCheckedChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
      <div>
        <Label htmlFor={id} className="cursor-pointer">{label}</Label>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

function MethodChecklist({ options, selected, onToggle, name }) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {options.map((method) => (
        <label
          key={method}
          className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <input
            type="checkbox"
            name={name}
            className="h-4 w-4 rounded border-input accent-primary"
            checked={selected.includes(method)}
            onChange={() => onToggle(method)}
          />
          {method}
        </label>
      ))}
    </div>
  )
}

export default function SettingsPage() {
  const { toast } = useToast()
  const { categories, settings, loading, updateSettings, updateCategoryBillingType } = useBillingConfig()
  const [baseline, setBaseline] = useState(() => toFormState(settings))
  const [form, setForm] = useState(() => toFormState(settings))
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (loading) return
    const next = toFormState(settings)
    setBaseline(next)
    setForm(next)
  }, [loading, settings])

  const patch = useMemo(() => buildPatch(form, baseline), [form, baseline])
  const dirty = Object.keys(patch).length > 0

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }))
  const setInput = (key) => (event) => set(key)(event.target.value)

  const toggleInList = (key, method) =>
    setForm((prev) => {
      const list = prev[key] || []
      return { ...prev, [key]: list.includes(method) ? list.filter((m) => m !== method) : [...list, method] }
    })

  const handleReset = () => {
    setForm(baseline)
    setErrors({})
  }

  const handleSave = async () => {
    const found = validateHospitalSettings(form, { paymentMethods: PAYMENT_METHOD_OPTIONS })
    setErrors(found)
    if (hasErrors(found)) {
      toast({ title: 'Please fix the errors', description: firstError(found), variant: 'destructive' })
      return
    }
    if (!dirty) return

    setSaving(true)
    try {
      await updateSettings(patch)
      toast({ title: 'Settings Saved', description: 'Hospital configuration updated', variant: 'success' })
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Settings" description="Configure hospital system and category billing types" />
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">Loading settings…</CardContent>
        </Card>
      </div>
    )
  }

  const enabledMethods = form.paymentMethods || []

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure hospital system and category billing types"
        action={
          <div className="flex items-center gap-3">
            {dirty && <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Unsaved changes</span>}
            <Button variant="outline" onClick={handleReset} disabled={!dirty || saving}>
              <Undo2 className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={handleSave} disabled={!dirty || saving}>
              <Save className="mr-2 h-4 w-4" /> {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        }
      />

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Hospital Information</CardTitle>
            <CardDescription>Basic hospital details for invoices and receipts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Hospital Name" htmlFor="hospital-name" error={errors.name}>
              <Input id="hospital-name" value={form.name} onChange={setInput('name')} />
            </Field>
            <Field label="Address" htmlFor="hospital-address">
              <Input id="hospital-address" value={form.address} onChange={setInput('address')} />
            </Field>
            <Field label="TIN" htmlFor="hospital-tin">
              <Input id="hospital-tin" value={form.tin} onChange={setInput('tin')} />
            </Field>
            <Field
              label="Phone"
              htmlFor="hospital-phone"
              hint="Shown on receipts and invoices when the matching toggle is on."
            >
              <Input id="hospital-phone" value={form.phone} onChange={setInput('phone')} />
            </Field>
            <Field label="Email" htmlFor="hospital-email" error={errors.email}>
              <Input id="hospital-email" value={form.email} onChange={setInput('email')} />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing &amp; Payment Configuration</CardTitle>
            <CardDescription>Currency, tax, payment methods, and automatic daily charges</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Currency"
              htmlFor="currency"
              error={errors.currency}
              hint="3-letter code used to format every amount in the app."
            >
              <Input id="currency" maxLength={3} value={form.currency} onChange={setInput('currency')} />
            </Field>
            <Field
              label="VAT %"
              htmlFor="vat"
              error={errors.vatPercent}
              hint="Applied to the invoice subtotal. 0 disables the VAT line."
            >
              <Input id="vat" type="number" min="0" max="100" value={form.vatPercent} onChange={setInput('vatPercent')} />
            </Field>

            <div>
              <Label>Enabled Payment Methods</Label>
              <MethodChecklist
                name="paymentMethods"
                options={PAYMENT_METHOD_OPTIONS}
                selected={enabledMethods}
                onToggle={(method) => toggleInList('paymentMethods', method)}
              />
              {errors.paymentMethods ? (
                <p className="mt-1 text-xs text-destructive">{errors.paymentMethods}</p>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Disabled methods are rejected on admission deposits and patient deposits.
                </p>
              )}
            </div>

            <Field
              label="Default Payment Method"
              htmlFor="default-method"
              error={errors.defaultPaymentMethod}
              hint="Pre-selected in deposit forms."
            >
              <select
                id="default-method"
                className={selectClass}
                value={form.defaultPaymentMethod}
                onChange={setInput('defaultPaymentMethod')}
              >
                {(enabledMethods.length ? enabledMethods : PAYMENT_METHOD_OPTIONS).map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </Field>

            <div>
              <Label>Reference Number Required For</Label>
              <MethodChecklist
                name="referenceRequiredMethods"
                options={PAYMENT_METHOD_OPTIONS}
                selected={form.referenceRequiredMethods || []}
                onToggle={(method) => toggleInList('referenceRequiredMethods', method)}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                A deposit using one of these methods cannot be saved without a unique reference.
              </p>
            </div>

            <Field
              label={`Daily Doctor Visit Fee (${form.currency || 'ETB'})`}
              htmlFor="visit-fee"
              error={errors.dailyDoctorVisitFee}
              hint="Fallback for the automatic daily charge. Per-doctor prices live in Doctors; service, room, and medicine prices stay in their own catalogs."
            >
              <Input id="visit-fee" type="number" min="0" value={form.dailyDoctorVisitFee} onChange={setInput('dailyDoctorVisitFee')} />
            </Field>
            <Field label="Daily Doctor Visit Name" htmlFor="visit-name">
              <Input id="visit-name" value={form.dailyDoctorVisitName} onChange={setInput('dailyDoctorVisitName')} />
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Receipt &amp; Invoice</CardTitle>
          <CardDescription>
            What the printed deposit receipt and patient invoice show. Changes apply the next time a document is
            previewed or printed.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Deposit Receipt</h3>
            <Field label="Header" htmlFor="receipt-header" hint="Optional line under the hospital name.">
              <Input id="receipt-header" value={form.receiptHeader} onChange={setInput('receiptHeader')} />
            </Field>
            <Field label="Footer" htmlFor="receipt-footer">
              <textarea
                id="receipt-footer"
                className={textareaClass}
                value={form.receiptFooter}
                onChange={setInput('receiptFooter')}
              />
            </Field>
            <Field
              label="Receipt Number Prefix"
              htmlFor="receipt-prefix"
              hint="Applied to the existing deposit receipt number, for example DEP-1042."
            >
              <Input id="receipt-prefix" value={form.receiptPrefix} onChange={setInput('receiptPrefix')} />
            </Field>
            <ToggleRow
              id="receipt-logo"
              label="Show logo"
              checked={form.receiptShowLogo}
              onCheckedChange={set('receiptShowLogo')}
            />
            <ToggleRow
              id="receipt-address"
              label="Show hospital address"
              checked={form.receiptShowAddress}
              onCheckedChange={set('receiptShowAddress')}
            />
            <ToggleRow
              id="receipt-phone"
              label="Show hospital phone"
              hint="Needs a phone number in Hospital Information."
              checked={form.receiptShowPhone}
              onCheckedChange={set('receiptShowPhone')}
            />
            <ToggleRow
              id="receipt-tin"
              label="Show VAT / TIN"
              checked={form.receiptShowTin}
              onCheckedChange={set('receiptShowTin')}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Patient Invoice</h3>
            <Field label="Header" htmlFor="invoice-header" hint="Optional line under the hospital name.">
              <Input id="invoice-header" value={form.invoiceHeader} onChange={setInput('invoiceHeader')} />
            </Field>
            <Field label="Footer" htmlFor="invoice-footer" hint="Leave empty to reuse the receipt footer.">
              <textarea
                id="invoice-footer"
                className={textareaClass}
                value={form.invoiceFooter}
                onChange={setInput('invoiceFooter')}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              Invoices are printed per patient and are not numbered, so there is no invoice number format to configure.
            </p>
            <ToggleRow
              id="invoice-logo"
              label="Show logo"
              checked={form.invoiceShowLogo}
              onCheckedChange={set('invoiceShowLogo')}
            />
            <ToggleRow
              id="invoice-address"
              label="Show hospital address"
              checked={form.invoiceShowAddress}
              onCheckedChange={set('invoiceShowAddress')}
            />
            <ToggleRow
              id="invoice-phone"
              label="Show hospital phone"
              hint="Needs a phone number in Hospital Information."
              checked={form.invoiceShowPhone}
              onCheckedChange={set('invoiceShowPhone')}
            />
            <ToggleRow
              id="invoice-tin"
              label="Show VAT / TIN"
              checked={form.invoiceShowTin}
              onCheckedChange={set('invoiceShowTin')}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Category Billing Types</CardTitle>
          <CardDescription>
            Configure how each service category is entered. Changes apply immediately to charge entry screens.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-xl border">
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
                    <td className="max-w-xs px-4 py-3 text-xs text-muted-foreground">{cat.description}</td>
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
          <p className="mt-3 text-xs text-muted-foreground">
            Current doctor visit fee: {formatCurrency(Number(form.dailyDoctorVisitFee) || 0)} / day · Room rates follow bed type assignment.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Financial Rules</CardTitle>
            <CardDescription>Deposit, credit, and discharge rules enforced by the backend</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label={`Low Balance Threshold (${form.currency || 'ETB'})`}
              htmlFor="low-balance"
              error={errors.lowBalanceThreshold}
              hint="Balances below this are flagged as low. The Manager dashboard keeps its wider 2× attention band on top of this value."
            >
              <Input id="low-balance" type="number" min="0" value={form.lowBalanceThreshold} onChange={setInput('lowBalanceThreshold')} />
            </Field>
            <Field
              label={`Minimum Initial Deposit (${form.currency || 'ETB'})`}
              htmlFor="min-deposit"
              error={errors.minimumInitialDeposit}
              hint="Required to admit a paid patient. Already-admitted patients keep the amount recorded at their admission."
            >
              <Input id="min-deposit" type="number" min="0" value={form.minimumInitialDeposit} onChange={setInput('minimumInitialDeposit')} />
            </Field>
            <ToggleRow
              id="credit-admissions"
              label="Allow credit admissions"
              hint="When off, admissions with payment mode Credit are rejected. Existing credit patients are unaffected."
              checked={form.creditAdmissionsEnabled}
              onCheckedChange={set('creditAdmissionsEnabled')}
            />
            <ToggleRow
              id="discharge-outstanding"
              label="Allow discharge with outstanding balance"
              hint="When off, discharge approval is blocked until approved charges are covered by deposits."
              checked={form.allowDischargeWithOutstandingBalance}
              onCheckedChange={set('allowDischargeWithOutstandingBalance')}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System / General Settings</CardTitle>
            <CardDescription>How dates, times, and lists are displayed across the app</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field
              label="Timezone"
              htmlFor="timezone"
              error={errors.timezone}
              hint="IANA name, for example Africa/Addis_Ababa. Used when rendering timestamps. Calendar-day records (deposits, charges, admissions) are already stored as hospital-local days by the server."
            >
              <Input id="timezone" placeholder="Africa/Addis_Ababa" value={form.timezone} onChange={setInput('timezone')} />
            </Field>
            <Field label="Date Format" htmlFor="date-format" error={errors.dateFormat}>
              <select id="date-format" className={selectClass} value={form.dateFormat} onChange={setInput('dateFormat')}>
                {DATE_FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Time Format" htmlFor="time-format" error={errors.timeFormat}>
              <select id="time-format" className={selectClass} value={form.timeFormat} onChange={setInput('timeFormat')}>
                {TIME_FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Rows Per Page"
              htmlFor="page-size"
              error={errors.listPageSize}
              hint="Default page size for patient and record lists. Applies as each list is reopened."
            >
              <Input id="page-size" type="number" min="5" max="100" value={form.listPageSize} onChange={setInput('listPageSize')} />
            </Field>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
