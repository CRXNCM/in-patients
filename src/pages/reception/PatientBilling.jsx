import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, AlertTriangle, Plus, Printer, User, Phone, Calendar,
  Bed, Wallet, Receipt, History, CheckCircle2, XCircle, Clock, ArrowRightLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { StatCard, DataTable, StatusBadge } from '@/components/shared/CommonComponents'
import { ServiceRecordBuilder } from '@/components/shared/ServiceRecordBuilder'
import { RecordTimeline } from '@/components/shared/RecordTimeline'
import { RecordDetailView } from '@/components/shared/RecordTimeline'
import { DepositReceipt } from '@/components/shared/DepositReceipt'
import { RoomHistoryTable, RoomTransferPanel } from '@/components/shared/RoomTransferPanel'
import { hospitalSettings, depositTypes } from '@/data/mockData'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { computeRecordTotal } from '@/context/ServiceEntriesContext'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'
import { cn } from '@/lib/utils'
import { validateDeposit, firstError, trimText, NON_CASH_PAYMENT_METHODS } from '@/lib/validation'

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-destructive mt-1">{message}</p>
}

export default function PatientBilling() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { getPatient, getPatientDeposits, addDeposit, setDoctorVisitDisabled, getRoomAssignments, rooms, loading } = usePatients()
  const {
    getPatientRecords,
    getPatientBalance,
    getApprovedLineItems,
    approveRecord,
    rejectRecord,
    ensureAutomaticDailyCharges,
    CURRENT_RECEPTIONIST,
  } = useServiceEntries()

  const patient = getPatient(patientId)
  const [showDepositDialog, setShowDepositDialog] = useState(false)
  const [newDeposit, setNewDeposit] = useState({ amount: '', method: 'Cash', referenceNumber: '' })
  const [depositErrors, setDepositErrors] = useState({})
  const [depositSubmitting, setDepositSubmitting] = useState(false)
  const [rejectRecordId, setRejectRecordId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [detailRecord, setDetailRecord] = useState(null)
  const [printDeposit, setPrintDeposit] = useState(null)
  const [pendingPrint, setPendingPrint] = useState(null)

  useEffect(() => {
    if (patientId) ensureAutomaticDailyCharges(patientId)
  }, [patientId, ensureAutomaticDailyCharges])

  useEffect(() => {
    const onAfterPrint = () => {
      setPendingPrint(null)
      setPrintDeposit(null)
      document.body.classList.remove('print-invoice-mode', 'print-deposit-mode')
    }
    window.addEventListener('afterprint', onAfterPrint)
    return () => window.removeEventListener('afterprint', onAfterPrint)
  }, [])

  useEffect(() => {
    if (!pendingPrint) return undefined
    if (pendingPrint === 'deposit' && !printDeposit) return undefined

    document.body.classList.remove('print-invoice-mode', 'print-deposit-mode')
    document.body.classList.add(pendingPrint === 'deposit' ? 'print-deposit-mode' : 'print-invoice-mode')

    const timer = window.setTimeout(() => window.print(), 200)
    return () => window.clearTimeout(timer)
  }, [pendingPrint, printDeposit])

  const queuePrint = (mode) => {
    if (mode === 'invoice') setPrintDeposit(null)
    setPendingPrint(mode)
  }

  if (loading) {
    return <div className="text-center py-20 text-muted-foreground">Loading patient...</div>
  }

  if (!patient) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground mb-4">Patient not found</p>
        <Button onClick={() => navigate('/reception')}>Back to Dashboard</Button>
      </div>
    )
  }

  const allRecords = getPatientRecords(patientId)
  const pendingRecords = allRecords.filter((r) => r.status === 'pending')
  const deposits = getPatientDeposits(patientId)
  const balance = getPatientBalance(patient)
  const { totalCharges, remainingBalance, pendingCharges } = balance
  const isLowBalance = remainingBalance < hospitalSettings.lowBalanceThreshold
  const approvedBillItems = getApprovedLineItems(patientId)
  const roomAssignments = getRoomAssignments(patientId)

  const today = new Date().toISOString().split('T')[0]
  const doctorVisitDates = (() => {
    const dates = []
    const cur = new Date(patient.admissionDate + 'T00:00:00')
    const last = new Date(today + 'T00:00:00')
    while (cur <= last) {
      dates.unshift(cur.toISOString().split('T')[0])
      cur.setDate(cur.getDate() + 1)
    }
    return dates.slice(0, 14)
  })()

  const handleAddDeposit = async () => {
    const form = {
      amount: trimText(newDeposit.amount),
      method: newDeposit.method,
      referenceNumber: trimText(newDeposit.referenceNumber),
    }
    const errors = validateDeposit(form, deposits)
    if (Object.keys(errors).length) {
      setDepositErrors(errors)
      toast({ title: 'Please fix the errors', description: firstError(errors), variant: 'destructive' })
      return
    }

    setDepositSubmitting(true)
    try {
      const entry = await addDeposit(patientId, {
        amount: Number(form.amount),
        method: form.method,
        referenceNumber: form.referenceNumber || undefined,
        receivedBy: CURRENT_RECEPTIONIST,
      })
      setNewDeposit({ amount: '', method: 'Cash', referenceNumber: '' })
      setDepositErrors({})
      setShowDepositDialog(false)
      toast({ title: 'Deposit Recorded', description: `${formatCurrency(Number(form.amount))} added`, variant: 'success' })
      setPrintDeposit(entry)
      queuePrint('deposit')
    } catch (err) {
      toast({ title: 'Deposit failed', description: err.message, variant: 'destructive' })
    } finally {
      setDepositSubmitting(false)
    }
  }

  const handlePrintDeposit = (deposit) => {
    setPrintDeposit(deposit)
    queuePrint('deposit')
  }

  const handleDoctorVisitToggle = async (date, disabled) => {
    try {
      await setDoctorVisitDisabled(patientId, date, disabled)
      await ensureAutomaticDailyCharges(patientId)
      toast({
        title: disabled ? 'Doctor visit disabled' : 'Doctor visit enabled',
        description: `${formatDate(date)} — automatic charge ${disabled ? 'removed' : 'restored'}`,
        variant: 'success',
      })
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' })
    }
  }

  const handleApprove = async (record) => {
    try {
      await approveRecord(record.id)
      toast({ title: 'Approved', description: `Record for ${record.recordName} approved`, variant: 'success' })
    } catch (err) {
      toast({ title: 'Approve failed', description: err.message, variant: 'destructive' })
    }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast({ title: 'Provide a rejection reason', variant: 'destructive' })
      return
    }
    try {
      await rejectRecord(rejectRecordId, rejectReason)
      toast({ title: 'Rejected', variant: 'success' })
      setRejectRecordId(null)
      setRejectReason('')
    } catch (err) {
      toast({ title: 'Reject failed', description: err.message, variant: 'destructive' })
    }
  }

  const billingTableColumns = [
    { key: 'date', header: 'Date', render: (row) => formatDate(row.date) },
    { key: 'department', header: 'Category' },
    { key: 'item', header: 'Service' },
    { key: 'quantity', header: 'Qty' },
    { key: 'price', header: 'Price', render: (row) => formatCurrency(row.price) },
    {
      key: 'total',
      header: 'Total',
      render: (row) => (
        <span className={row.total < 0 ? 'text-emerald-600 font-semibold' : ''}>
          {row.total < 0 ? '-' : ''}{formatCurrency(Math.abs(row.total))}
        </span>
      ),
    },
    { key: 'recordName', header: 'Record', render: (row) => <span className="text-xs">{row.recordName}</span> },
  ]

  let running = 0
  const itemsWithRunning = approvedBillItems.map((item) => {
    running += item.total
    return { ...item, runningTotal: running }
  })

  return (
    <>
      <div className="no-print">
        <Button variant="ghost" onClick={() => navigate('/reception')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>

        {isLowBalance && (
          <div className="flex items-center gap-3 rounded-xl border-2 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 p-4 mb-6">
            <AlertTriangle className="h-6 w-6 text-red-600 shrink-0" />
            <div>
              <p className="font-semibold text-red-700 dark:text-red-400">Critical Balance Warning</p>
              <p className="text-sm text-red-600 dark:text-red-300">
                Remaining balance is {formatCurrency(remainingBalance)} — below {formatCurrency(hospitalSettings.lowBalanceThreshold)} threshold.
                {pendingCharges > 0 && ` (${formatCurrency(pendingCharges)} pending not yet applied.)`}
              </p>
            </div>
          </div>
        )}

        {pendingRecords.length > 0 && (
          <div className="rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-amber-800 dark:text-amber-300">Pending Records ({pendingRecords.length})</h3>
            </div>
            <div className="space-y-2">
              {pendingRecords.map((record) => {
                const total = computeRecordTotal(record)
                const count = record.type === 'pharmacy_return' ? record.returnItems?.length : record.services?.length
                return (
                  <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
                    <div>
                      <p className="font-semibold text-sm">{record.recordName}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.type === 'pharmacy_return' ? 'Pharmacy Return' : 'Daily Services'} · {count} item(s) · {formatCurrency(Math.abs(total))}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDetailRecord(record)}>Details</Button>
                      <StatusBadge status="pending" />
                      <Button size="sm" variant="outline" className="text-emerald-600" onClick={() => handleApprove(record)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600" onClick={() => setRejectRecordId(record.id)}>
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" />{patient.name}</CardTitle>
              <CardDescription>Patient ID: {patient.id}</CardDescription>
            </div>
            {patient.status === 'admitted' && (
              <RoomTransferPanel
                patientId={patientId}
                assignedBy={CURRENT_RECEPTIONIST}
                compact
                onTransferred={() => ensureAutomaticDailyCharges(patientId)}
              />
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div><p className="text-xs text-muted-foreground">Age / Gender</p><p className="font-medium">{patient.age} years · {patient.gender}</p></div>
              <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</p><p className="font-medium">{patient.phone}</p></div>
              <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Admission</p><p className="font-medium">{formatDate(patient.admissionDate)}</p></div>
              <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Bed className="h-3 w-3" /> Room / Bed</p><p className="font-medium">{patient.room} · {patient.bed}</p></div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard title="Total Deposit" value={formatCurrency(patient.deposit)} icon={Wallet} iconClassName="bg-emerald-100 text-emerald-600" />
          <StatCard title="Approved Charges" value={formatCurrency(totalCharges)} icon={Receipt} iconClassName="bg-blue-100 text-blue-600" />
          <StatCard
            title="Remaining Balance"
            value={formatCurrency(remainingBalance)}
            icon={Wallet}
            iconClassName={remainingBalance >= 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'}
          />
          <StatCard title="Pending Charges" value={formatCurrency(pendingCharges)} subtitle="Not yet on bill" icon={Clock} iconClassName="bg-amber-100 text-amber-600" />
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Room History
            </CardTitle>
            <CardDescription>
              All room assignments for this admission. Charges on the invoice use each period&apos;s stored daily rate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RoomHistoryTable assignments={roomAssignments} rooms={rooms} />
          </CardContent>
        </Card>

        <div className="mb-8">
          <ServiceRecordBuilder
            patientId={patientId}
            patientName={patient.name}
            source="reception"
            recordedBy={CURRENT_RECEPTIONIST}
            hideMoney={false}
            autoApprove
          />
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Automatic Doctor Visits
            </CardTitle>
            <CardDescription>
              Doctor visit charges are generated automatically each admission day. Disable a day if the doctor did not visit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {doctorVisitDates.map((date) => {
                const disabled = patient.disabledDoctorVisits?.[date]
                return (
                  <label
                    key={date}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                      disabled ? 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20' : 'hover:bg-muted/50'
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={!!disabled}
                      onChange={(e) => handleDoctorVisitToggle(date, e.target.checked)}
                    />
                    <span className="text-sm">
                      <span className="font-medium">{formatDate(date)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {disabled ? 'No visit — charge disabled' : 'Doctor visit billed'}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">Approved Billing — {patient.name}</h3>
          <DataTable
            columns={[...billingTableColumns, {
              key: 'runningTotal',
              header: 'Running Total',
              render: (row) => formatCurrency(itemsWithRunning.find((i) => i.id === row.id)?.runningTotal || 0),
            }]}
            data={approvedBillItems}
          />
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Record History — {patient.name}</CardTitle>
            <CardDescription>All daily records, pharmacy returns, and audit trail</CardDescription>
          </CardHeader>
          <CardContent>
            <RecordTimeline records={allRecords} />
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Deposit History</CardTitle>
            <Button onClick={() => setShowDepositDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Deposit</Button>
          </CardHeader>
          <CardContent>
            {deposits.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No deposits recorded</p>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Amount</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Type</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Received By</th>
                      <th className="px-4 py-3 text-right font-semibold text-muted-foreground">Receipt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map((d) => (
                      <tr key={d.id} className="border-b">
                        <td className="px-4 py-3">{formatDate(d.date)}</td>
                        <td className="px-4 py-3 font-semibold text-emerald-600">{formatCurrency(d.amount)}</td>
                        <td className="px-4 py-3">{d.method}</td>
                        <td className="px-4 py-3">{d.receivedBy}</td>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => handlePrintDeposit(d)}>
                            <Printer className="h-3.5 w-3.5 mr-1" /> Print
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end mb-8">
          <Button size="lg" onClick={() => queuePrint('invoice')}>
            <Printer className="h-4 w-4 mr-2" /> Print Invoice
          </Button>
        </div>

      <Card>
        <CardHeader><CardTitle>Invoice Preview — {patient.name}</CardTitle></CardHeader>
        <CardContent>
          <InvoicePreview patient={patient} items={approvedBillItems} deposit={patient.deposit} totalCharges={totalCharges} remainingBalance={remainingBalance} />
        </CardContent>
      </Card>

      <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Deposit</DialogTitle>
            <DialogDescription>Record deposit for {patient.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Amount (ETB) *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={newDeposit.amount}
                onChange={(e) => {
                  setNewDeposit((p) => ({ ...p, amount: e.target.value }))
                  setDepositErrors((er) => ({ ...er, amount: undefined }))
                }}
              />
              <FieldError message={depositErrors.amount} />
            </div>
            <div>
              <Label>Payment Method *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newDeposit.method}
                onChange={(e) => {
                  setNewDeposit((p) => ({ ...p, method: e.target.value }))
                  setDepositErrors((er) => ({ ...er, method: undefined }))
                }}
              >
                {depositTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <FieldError message={depositErrors.method} />
            </div>
            {NON_CASH_PAYMENT_METHODS.includes(newDeposit.method) && (
              <div>
                <Label>Payment Reference *</Label>
                <Input
                  value={newDeposit.referenceNumber}
                  onChange={(e) => {
                    setNewDeposit((p) => ({ ...p, referenceNumber: e.target.value }))
                    setDepositErrors((er) => ({ ...er, referenceNumber: undefined }))
                  }}
                  placeholder="Transaction / reference number"
                />
                <FieldError message={depositErrors.referenceNumber} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDepositDialog(false)} disabled={depositSubmitting}>Cancel</Button>
            <Button onClick={handleAddDeposit} disabled={depositSubmitting}>
              {depositSubmitting ? 'Recording...' : 'Record Deposit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailRecord} onOpenChange={() => setDetailRecord(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Service Entry Details — {detailRecord?.recordName}</DialogTitle>
            <DialogDescription>Full breakdown of all services in this record</DialogDescription>
          </DialogHeader>
          {detailRecord && <RecordDetailView record={detailRecord} showMoney />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailRecord(null)}>Close</Button>
            {detailRecord?.status === 'pending' && (
              <>
                <Button variant="destructive" onClick={() => { setRejectRecordId(detailRecord.id); setDetailRecord(null) }}>Reject</Button>
                <Button onClick={() => { handleApprove(detailRecord); setDetailRecord(null) }}>Approve</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rejectRecordId} onOpenChange={() => setRejectRecordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Record?</AlertDialogTitle>
            <AlertDialogDescription>This will be logged in the audit trail.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2"><Label>Reason</Label><Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} /></div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>

      <div className="print-only print-invoice">
        <InvoicePreview patient={patient} items={approvedBillItems} deposit={patient.deposit} totalCharges={totalCharges} remainingBalance={remainingBalance} />
      </div>

      {printDeposit && (
        <div className="print-only print-deposit">
          <DepositReceipt patient={patient} deposit={printDeposit} />
        </div>
      )}
    </>
  )
}

function InvoicePreview({ patient, items, deposit, totalCharges, remainingBalance }) {
  const vatAmount = hospitalSettings.vatPercent > 0 ? totalCharges * (hospitalSettings.vatPercent / 100) : 0
  const grandTotal = totalCharges + vatAmount
  const balancePositive = remainingBalance >= 0

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
          <p className="text-lg font-bold text-blue-700">INVOICE</p>
          <p className="text-sm text-gray-600">Date: {formatDateTime(new Date().toISOString())}</p>
          <p className="text-sm text-gray-600">Patient: {patient.name}</p>
        </div>
      </div>
      <table className="w-full text-sm mb-6">
        <thead>
          <tr className="border-b-2 border-blue-200">
            <th className="py-2 text-left">#</th>
            <th className="py-2 text-left">Category</th>
            <th className="py-2 text-left">Service</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Price</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id} className="border-b border-gray-100">
              <td className="py-2">{idx + 1}</td>
              <td className="py-2">{item.department}</td>
              <td className="py-2">{item.item}</td>
              <td className="py-2 text-right">{item.quantity}</td>
              <td className="py-2 text-right">{formatCurrency(item.price)}</td>
              <td className={cn('py-2 text-right', item.total < 0 && 'text-emerald-700')}>
                {item.total < 0 ? '-' : ''}{formatCurrency(Math.abs(item.total))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
