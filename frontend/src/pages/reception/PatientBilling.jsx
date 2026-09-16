import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, AlertTriangle, Plus, Printer, User, Phone, Calendar,
  Bed, Wallet, Receipt, History, CheckCircle2, XCircle, Clock, ArrowRightLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import { FormField } from '@/components/ui/form-field'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { StatCard, DataTable, StatusBadge, Pagination, usePagedItems } from '@/components/shared/CommonComponents'
import { ServiceRecordBuilder } from '@/components/shared/ServiceRecordBuilder'
import { RecordTimeline } from '@/components/shared/RecordTimeline'
import { RecordDetailView } from '@/components/shared/RecordTimeline'
import { DepositReceipt } from '@/components/shared/DepositReceipt'
import { InvoicePreview } from '@/components/shared/InvoicePreview'
import { PrintPortal } from '@/components/shared/PrintPortal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RoomHistoryTable, RoomTransferPanel } from '@/components/shared/RoomTransferPanel'
import { DischargeReviewPanel } from '@/components/shared/DischargeWorkflow'
import { AssignedDoctorsPanel } from '@/components/shared/AssignedDoctorsPanel'
import { CreditBadge, CreditSummary } from '@/components/shared/CreditBadge'
import { MaternityAdmissionPanel } from '@/components/shared/MaternityAdmissionPanel'
import { isMaternityAdmission, subjectLabel } from '@/lib/maternity'
import { api, USE_API } from '@/api/client'
import { hospitalSettings, depositTypes } from '@/data/mockData'
import { useBillingConfig } from '@/context/BillingConfigContext'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { computeRecordTotal } from '@/context/ServiceEntriesContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'
import { cn } from '@/lib/utils'
import { validateDeposit, firstError, trimText, NON_CASH_PAYMENT_METHODS } from '@/lib/validation'
import { MotionPage, MotionReveal } from '@/lib/motion'

function PagedDoctorVisitGrid({ dates, disabledMap, onToggle }) {
  const { page, setPage, pageCount, slice, total, pageSize } = usePagedItems(dates)
  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {slice.map((date) => {
          const disabled = disabledMap?.[date]
          return (
            <label
              key={date}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors',
                disabled ? 'border-warning/40 bg-warning/5' : 'hover:bg-muted/50'
              )}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={!!disabled}
                onChange={(e) => onToggle(date, e.target.checked)}
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
      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} total={total} pageSize={pageSize} />
    </div>
  )
}

export default function PatientBilling() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { getPatient, getPatientDeposits, addDeposit, setDoctorVisitDisabled, getRoomAssignments, rooms, loading, applyPatientUpdate } = usePatients()
  const {
    getPatientRecords,
    getPatientBalance,
    getApprovedLineItems,
    approveRecord,
    rejectRecord,
    ensureAutomaticDailyCharges,
    CURRENT_RECEPTIONIST,
  } = useServiceEntries()

  const { settings: hospitalConfig } = useBillingConfig()
  const paymentMethods = hospitalConfig.paymentMethods?.length ? hospitalConfig.paymentMethods : depositTypes
  const referenceRequiredMethods = Array.isArray(hospitalConfig.referenceRequiredMethods)
    ? hospitalConfig.referenceRequiredMethods
    : NON_CASH_PAYMENT_METHODS
  const lowBalanceThreshold = Number(hospitalConfig.lowBalanceThreshold ?? hospitalSettings.lowBalanceThreshold)
  const defaultPaymentMethod = paymentMethods.includes(hospitalConfig.defaultPaymentMethod)
    ? hospitalConfig.defaultPaymentMethod
    : paymentMethods[0]

  const listedPatient = getPatient(patientId)
  const [remotePatient, setRemotePatient] = useState(null)
  const [showDepositDialog, setShowDepositDialog] = useState(false)
  const [newDeposit, setNewDeposit] = useState({ amount: '', method: 'Cash', referenceNumber: '' })
  const [depositErrors, setDepositErrors] = useState({})
  const [depositSubmitting, setDepositSubmitting] = useState(false)
  const [rejectRecordId, setRejectRecordId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [detailRecord, setDetailRecord] = useState(null)
  const [printDeposit, setPrintDeposit] = useState(null)
  const [pendingPrint, setPendingPrint] = useState(null)
  const [invoiceVariant, setInvoiceVariant] = useState('summary')

  useEffect(() => {
    if (listedPatient || !USE_API || !patientId) {
      setRemotePatient(null)
      return undefined
    }
    let cancelled = false
    api.getPatient(patientId)
      .then((data) => {
        if (!cancelled) setRemotePatient(data.patient)
      })
      .catch(() => {
        if (!cancelled) setRemotePatient(null)
      })
    return () => {
      cancelled = true
    }
  }, [listedPatient, patientId])

  const patient = listedPatient || remotePatient

  useEffect(() => {
    if (patientId && patient?.status !== 'discharged') ensureAutomaticDailyCharges(patientId)
  }, [patientId, patient?.status, ensureAutomaticDailyCharges])

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
    if (mode !== 'deposit') setPrintDeposit(null)
    setPendingPrint(mode)
  }

  const printInvoice = (variant) => {
    setInvoiceVariant(variant)
    queuePrint(variant === 'summary' ? 'invoice-summary' : 'invoice-detailed')
  }

  const maternity = isMaternityAdmission(patient)
  const allRecords = getPatientRecords(patientId)
  const motherRecords = allRecords.filter((r) => (r.subjectType || 'mother') !== 'baby')
  const babyRecords = allRecords.filter((r) => r.subjectType === 'baby')
  const pendingRecords = allRecords.filter((r) => r.status === 'pending')
  const deposits = getPatientDeposits(patientId)
  const pendingPaged = usePagedItems(pendingRecords)
  const depositPaged = usePagedItems(deposits)

  if (loading) {
    return <LoadingState message="Loading patient…" />
  }

  if (!patient) {
    return (
      <div className="py-20 text-center">
        <ErrorState title="Patient not found" message="This stay could not be loaded." />
        <Button className="mt-4" onClick={() => navigate('/reception')}>Back to Dashboard</Button>
      </div>
    )
  }

  const balance = getPatientBalance(patient)
  const { totalCharges, remainingBalance, pendingCharges } = balance
  const vatPercent = Number(hospitalConfig.vatPercent) || 0
  const vatAmount = vatPercent > 0 ? totalCharges * (vatPercent / 100) : 0
  const isLowBalance = remainingBalance < lowBalanceThreshold
  const approvedBillItems = getApprovedLineItems(patientId)
  const roomAssignments = getRoomAssignments(patientId)
  const isDischarged = patient.status === 'discharged'
  const canTransfer = patient.status === 'admitted'
  const canAddCharges = patient.status !== 'discharged'

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
    const errors = validateDeposit(form, deposits, { referenceRequiredMethods, paymentMethods })
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
      setNewDeposit({ amount: '', method: defaultPaymentMethod, referenceNumber: '' })
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
        <span className={row.total < 0 ? 'font-semibold tabular-nums text-success' : 'tabular-nums'}>
          {row.total < 0 ? '-' : ''}{formatCurrency(Math.abs(row.total))}
        </span>
      ),
    },
    { key: 'recordName', header: 'Record', render: (row) => <span className="text-xs">{row.recordName}</span> },
    ...(isMaternityAdmission(patient)
      ? [{ key: 'subjectType', header: 'Subject', render: (row) => subjectLabel(row.subjectType) }]
      : []),
  ]

  let running = 0
  const itemsWithRunning = approvedBillItems.map((item) => {
    running += item.total
    return { ...item, runningTotal: running }
  })

  return (
    <>
      <MotionPage className="no-print">
        <Button variant="ghost" onClick={() => navigate('/reception')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>

        <DischargeReviewPanel patient={patient} />

        {isLowBalance && !isDischarged && (
          <MotionReveal className="mb-6 flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 shadow-sm">
            <AlertTriangle className="h-6 w-6 shrink-0 text-destructive" />
            <div>
              <p className="font-semibold text-destructive">Critical Balance Warning</p>
              <p className="text-sm text-muted-foreground">
                Remaining balance is {formatCurrency(remainingBalance)} — below {formatCurrency(lowBalanceThreshold)} threshold.
                {pendingCharges > 0 && ` (${formatCurrency(pendingCharges)} pending not yet applied.)`}
              </p>
            </div>
          </MotionReveal>
        )}

        {pendingRecords.length > 0 && (
          <MotionReveal className="mb-6 rounded-lg border border-warning/40 bg-warning/5 p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-warning" />
              <h3 className="font-semibold text-warning">Pending Records ({pendingRecords.length})</h3>
            </div>
            <div className="space-y-2">
              {pendingPaged.slice.map((record) => {
                const total = computeRecordTotal(record)
                const count = record.type === 'pharmacy_return' ? record.returnItems?.length : record.services?.length
                return (
                  <div key={record.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3 shadow-sm transition-colors duration-140 ease-out-soft hover:bg-muted/30">
                    <div>
                      <p className="font-semibold text-sm">{record.recordName}</p>
                      <p className="text-xs text-muted-foreground">
                        {isMaternityAdmission(patient) ? `${subjectLabel(record.subjectType)} · ` : ''}
                        {record.type === 'pharmacy_return' ? 'Pharmacy Return' : 'Daily Services'} · {count} item(s) · <span className="tabular-nums">{formatCurrency(Math.abs(total))}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDetailRecord(record)}>Details</Button>
                      <StatusBadge status="pending" />
                      <Button size="sm" variant="outline" className="text-success" onClick={() => handleApprove(record)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRejectRecordId(record.id)}>
                        <XCircle className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
            <Pagination
              page={pendingPaged.page}
              pageCount={pendingPaged.pageCount}
              onPageChange={pendingPaged.setPage}
              total={pendingPaged.total}
              pageSize={pendingPaged.pageSize}
            />
          </MotionReveal>
        )}

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Inpatient stay</p>
              <CardTitle className="mt-1 flex flex-wrap items-center gap-2 text-xl">
                <User className="h-5 w-5 text-primary" />
                {patient.name}
                <CreditBadge patient={patient} />
              </CardTitle>
              <CardDescription className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-medium text-primary">{patient.id}</span>
                <StatusBadge status={patient.status} />
              </CardDescription>
            </div>
            {canTransfer && (
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
            <div className="mt-4">
              <CreditSummary patient={patient} />
            </div>
          </CardContent>
        </Card>

        <MaternityAdmissionPanel patient={patient} canEdit={canAddCharges} />

        <AssignedDoctorsPanel
          patient={patient}
          canAdd
          onChanged={(res) => {
            if (res?.patient) applyPatientUpdate(res.patient)
          }}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard title="Total Deposit" value={formatCurrency(patient.deposit)} icon={Wallet} iconClassName="bg-success/15 text-success" />
          <StatCard
            title="Approved Charges"
            value={formatCurrency(totalCharges)}
            subtitle={vatPercent > 0 ? `VAT ${vatPercent}% · ${formatCurrency(vatAmount)}` : undefined}
            icon={Receipt}
            iconClassName="bg-primary/10 text-primary"
          />
          <StatCard
            title="Remaining Balance"
            value={formatCurrency(remainingBalance)}
            icon={Wallet}
            iconClassName={remainingBalance >= 0 ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}
          />
          <StatCard title="Pending Charges" value={formatCurrency(pendingCharges)} subtitle="Not yet on bill" icon={Clock} iconClassName="bg-warning/15 text-warning" />
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

        {canAddCharges && (
        <div className="mb-8">
          <ServiceRecordBuilder
            patientId={patientId}
            patientName={patient.name}
            patient={patient}
            source="reception"
            recordedBy={CURRENT_RECEPTIONIST}
            hideMoney={false}
            autoApprove
          />
        </div>
        )}

        {canAddCharges && (
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
            <PagedDoctorVisitGrid
              dates={doctorVisitDates}
              disabledMap={patient.disabledDoctorVisits}
              onToggle={handleDoctorVisitToggle}
            />
          </CardContent>
        </Card>
        )}

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
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">History</p>
            <CardTitle className="mt-1 text-lg">Record History — {patient.name}</CardTitle>
            <CardDescription>
              {maternity
                ? 'Mother and baby records stay on this same maternity admission.'
                : 'All daily records, pharmacy returns, and audit trail'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {maternity ? (
              <>
                <div>
                  <h4 className="text-sm font-semibold mb-3">Mother records</h4>
                  <RecordTimeline records={motherRecords} showSubject />
                </div>
                <div>
                  <h4 className="text-sm font-semibold mb-3">Baby records</h4>
                  <RecordTimeline records={babyRecords} showSubject />
                </div>
              </>
            ) : (
              <RecordTimeline records={allRecords} />
            )}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><History className="h-5 w-5" /> Deposit History</CardTitle>
            {!isDischarged && (
              <Button
                onClick={() => {
                  setNewDeposit({ amount: '', method: defaultPaymentMethod, referenceNumber: '' })
                  setDepositErrors({})
                  setShowDepositDialog(true)
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Deposit
              </Button>
            )}
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
                    {depositPaged.slice.map((d) => (
                      <tr key={d.id} className="border-b transition-colors duration-140 ease-out-soft hover:bg-muted/40">
                        <td className="px-4 py-3">{formatDate(d.date)}</td>
                        <td className="px-4 py-3 font-semibold tabular-nums text-success">{formatCurrency(d.amount)}</td>
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
                <Pagination
                  page={depositPaged.page}
                  pageCount={depositPaged.pageCount}
                  onPageChange={depositPaged.setPage}
                  total={depositPaged.total}
                  pageSize={depositPaged.pageSize}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap justify-end gap-3 mb-8">
          <Button size="lg" variant="outline" onClick={() => printInvoice('summary')}>
            <Printer className="h-4 w-4 mr-2" /> Print Summary Invoice
          </Button>
          <Button size="lg" onClick={() => printInvoice('detailed')}>
            <Printer className="h-4 w-4 mr-2" /> Print Detailed Invoice
          </Button>
        </div>

      <Tabs value={invoiceVariant} onValueChange={setInvoiceVariant}>
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Invoice Preview
                </p>
                <CardTitle className="mt-1.5">{patient.name}</CardTitle>
                <CardDescription className="mt-1">
                  Summary shows one total per category. Detailed lists every approved service under its category.
                </CardDescription>
              </div>
              <TabsList className="self-start">
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="detailed">Detailed</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent className="bg-muted/20 p-5 sm:p-8">
            <TabsContent value="summary" className="mt-0">
              <InvoicePreview
                variant="summary"
                patient={patient}
                items={approvedBillItems}
                deposit={patient.deposit}
                totalCharges={totalCharges}
                remainingBalance={remainingBalance}
              />
            </TabsContent>
            <TabsContent value="detailed" className="mt-0">
              <InvoicePreview
                variant="detailed"
                patient={patient}
                items={approvedBillItems}
                deposit={patient.deposit}
                totalCharges={totalCharges}
                remainingBalance={remainingBalance}
              />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>

      <Dialog open={showDepositDialog} onOpenChange={setShowDepositDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Deposit</DialogTitle>
            <DialogDescription>Record deposit for {patient.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <FormField label={`Amount (${hospitalConfig.currency || 'ETB'})`} required error={depositErrors.amount}>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                className="tabular-nums"
                value={newDeposit.amount}
                onChange={(e) => {
                  setNewDeposit((p) => ({ ...p, amount: e.target.value }))
                  setDepositErrors((er) => ({ ...er, amount: undefined }))
                }}
              />
            </FormField>
            <FormField label="Payment Method" required error={depositErrors.method}>
              <NativeSelect
                value={newDeposit.method}
                onChange={(e) => {
                  setNewDeposit((p) => ({ ...p, method: e.target.value }))
                  setDepositErrors((er) => ({ ...er, method: undefined }))
                }}
              >
                {paymentMethods.map((t) => <option key={t} value={t}>{t}</option>)}
              </NativeSelect>
            </FormField>
            {referenceRequiredMethods.includes(newDeposit.method) && (
              <FormField label="Payment Reference" required error={depositErrors.referenceNumber}>
                <Input
                  value={newDeposit.referenceNumber}
                  onChange={(e) => {
                    setNewDeposit((p) => ({ ...p, referenceNumber: e.target.value }))
                    setDepositErrors((er) => ({ ...er, referenceNumber: undefined }))
                  }}
                  placeholder="Transaction / reference number"
                />
              </FormField>
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
          <div className="py-2">
            <FormField label="Reason">
              <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            </FormField>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Reject</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </MotionPage>

      <PrintPortal className="print-invoice">
        <InvoicePreview
          variant={pendingPrint === 'invoice-summary' ? 'summary' : 'detailed'}
          patient={patient}
          items={approvedBillItems}
          deposit={patient.deposit}
          totalCharges={totalCharges}
          remainingBalance={remainingBalance}
        />
      </PrintPortal>

      {printDeposit && (
        <PrintPortal className="print-deposit">
          <DepositReceipt patient={patient} deposit={printDeposit} />
        </PrintPortal>
      )}
    </>
  )
}
