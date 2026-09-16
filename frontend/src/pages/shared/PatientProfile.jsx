import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Baby,
  BedDouble,
  CreditCard,
  FileText,
  Plus,
  Receipt,
  Stethoscope,
  User,
  Wallet,
} from 'lucide-react'
import { DataTable, EmptyState, StatusBadge } from '@/components/shared/CommonComponents'
import { MetricTile } from '@/components/shared/MetricTile'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Forbidden } from '@/components/auth/Forbidden'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { MotionPage, MotionReveal } from '@/lib/motion'
import { cn, formatCurrency, formatDate, formatDateTime, stayDurationDays } from '@/lib/utils'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { useToast } from '@/context/ToastContext'
import { CreditBadge } from '@/components/shared/CreditBadge'
import { ServiceRecordBuilder } from '@/components/shared/ServiceRecordBuilder'
import { RecordTimeline } from '@/components/shared/RecordTimeline'
import { RequestDischargeButton, DischargeReviewPanel } from '@/components/shared/DischargeWorkflow'
import { RoomTransferPanel } from '@/components/shared/RoomTransferPanel'
import { AssignedDoctorsPanel } from '@/components/shared/AssignedDoctorsPanel'
import { MaternityAdmissionPanel } from '@/components/shared/MaternityAdmissionPanel'
import { isMaternityAdmission } from '@/lib/maternity'

function display(value) {
  if (value === 0) return '0'
  if (value == null || value === '') return 'Not provided'
  return value
}

function initials(name) {
  return String(name || '')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'PT'
}

function Field({ label, value, mono }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-sm font-medium', mono && 'font-mono text-primary')}>{display(value)}</p>
    </div>
  )
}

function SectionHead({ icon: Icon, kicker, title, description, action }) {
  return (
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {kicker ? <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{kicker}</p> : null}
        <CardTitle className={cn('flex items-center gap-2 text-base', kicker && 'mt-1')}>
          {Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null}
          {title}
        </CardTitle>
        {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </CardHeader>
  )
}

export default function PatientProfile() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { user, hasPermission } = useAuth()
  const { getPatient, applyPatientUpdate } = usePatients()
  const { getPatientRecords, approveRecord, rejectRecord, CURRENT_NURSE, CURRENT_RECEPTIONIST } = useServiceEntries()
  const listed = getPatient(patientId)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [showBuilder, setShowBuilder] = useState(false)
  const [historyEdit, setHistoryEdit] = useState(null)
  const [rejectRecordId, setRejectRecordId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    setData(null)
    setLoading(true)
    setError(null)
  }, [patientId])

  useEffect(() => {
    let cancelled = false
    api
      .getPatientProfile(patientId)
      .then((payload) => {
        if (cancelled) return
        setData(payload)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setData(null)
        setError(err.message || 'Failed to load patient profile')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [patientId, reloadToken])

  const handleBack = () => {
    const from = location.state?.from
    if (from && from !== location.pathname) navigate(from)
    else if (window.history.length > 1) navigate(-1)
    else navigate(user?.dashboardPath || '/')
  }

  const canViewPayments = hasPermission('payments.view')
  const canCreatePayments = hasPermission('payments.create')
  const canViewCredit = hasPermission('credit.view')
  const canEditPatient = hasPermission('patients.edit')
  const canAssignBeds = hasPermission('rooms.assign_beds')
  const canViewDoctors = hasPermission('doctors.view')
  const canAssignDoctors = hasPermission('doctors.assign')
  const canReviewRecords = hasPermission('admissions.edit')
  const canCompleteDischarge = hasPermission('admissions.discharge')
  const canRequestDischarge = user?.roleKey === 'nurse' && canEditPatient
  const canOpenBilling = user?.roleKey === 'reception' && hasPermission('patients.view')

  const liveRecords = listed ? getPatientRecords(patientId) : data?.records || []
  const pendingRecords = liveRecords.filter((row) => row.status === 'pending')
  const includeMoney = Boolean(canViewPayments && (data?.permissions?.payments || data?.finance))
  const showCredit = Boolean(canViewCredit && (data?.permissions?.credit || data?.credit || listed))
  const activeStay = listed?.status === 'admitted' || data?.patient?.status === 'admitted'
  const pendingStay = listed?.status === 'pending-discharge' || data?.patient?.status === 'pending-discharge'
  const discharged = listed?.status === 'discharged' || data?.patient?.status === 'discharged'
  const canAddRecords = (canEditPatient || canAssignDoctors) && !discharged && Boolean(listed)
  const hideMoney = !includeMoney

  const handleApprove = async (record) => {
    try {
      await approveRecord(record.id)
      toast({ title: 'Approved', description: `${record.recordName} approved`, variant: 'success' })
      reload()
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
      reload()
    } catch (err) {
      toast({ title: 'Reject failed', description: err.message, variant: 'destructive' })
    }
  }

  if (loading && !data) {
    return (
      <MotionPage>
        <Card>
          <CardContent className="p-0">
            <LoadingState message="Loading patient profile…" />
          </CardContent>
        </Card>
      </MotionPage>
    )
  }

  if (/forbidden/i.test(error || '')) return <Forbidden />

  if (/not found/i.test(error || '')) {
    return (
      <MotionPage>
        <Card>
          <CardContent className="p-6">
            <EmptyState
              icon={User}
              title="Patient not found"
              description="This patient record could not be loaded."
            />
            <Button className="mt-4" variant="outline" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </CardContent>
        </Card>
      </MotionPage>
    )
  }

  if (error || !data) {
    return (
      <MotionPage>
        <Card>
          <CardContent className="p-6">
            <ErrorState title="Patient profile could not be loaded." message={error} onRetry={reload} />
          </CardContent>
        </Card>
      </MotionPage>
    )
  }

  const { patient, finance, credit, deposits, doctors, baby, roomAssignments } = data
  const stay = data.admission || {
    status: patient.status,
    admissionDate: patient.admissionDate,
    admissionType: patient.admissionType,
    admissionReason: patient.admissionReason,
    room: patient.room,
    bed: patient.bed,
  }
  const stayDays = stayDurationDays(stay.admissionDate, patient.discharge?.completedAt?.slice?.(0, 10))
  const remaining = finance?.remaining ?? 0
  const maternity = isMaternityAdmission(listed || patient)
  const motherRecords = liveRecords.filter((row) => (row.subjectType || 'mother') !== 'baby')
  const babyRecords = liveRecords.filter((row) => row.subjectType === 'baby')

  const roomColumns = [
    { key: 'room', header: 'Room', render: (row) => row.room || '—' },
    { key: 'bed', header: 'Bed', render: (row) => row.bed || '—' },
    { key: 'startDate', header: 'From', render: (row) => <span className="tabular-nums">{formatDate(row.startDate)}</span> },
    {
      key: 'endDate',
      header: 'To',
      render: (row) => (row.endDate ? <span className="tabular-nums">{formatDate(row.endDate)}</span> : 'Current'),
    },
    { key: 'status', header: 'Status', render: (row) => row.status || '—' },
  ]
  if (includeMoney && roomAssignments?.some((row) => row.dailyRate != null)) {
    roomColumns.splice(2, 0, {
      key: 'dailyRate',
      header: 'Daily Rate',
      render: (row) => <span className="tabular-nums">{row.dailyRate != null ? formatCurrency(row.dailyRate) : '—'}</span>,
    })
  }

  const depositColumns = [
    { key: 'date', header: 'Date', render: (row) => <span className="tabular-nums">{formatDate(row.date)}</span> },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => <span className="tabular-nums font-medium">{formatCurrency(row.amount)}</span>,
    },
    { key: 'method', header: 'Payment Method', render: (row) => row.method || '—' },
    { key: 'receivedBy', header: 'Recorded By', render: (row) => row.receivedBy || '—' },
  ]

  const admissionRows = [
    {
      id: patient.patientId,
      admissionDate: stay.admissionDate,
      dischargedAt: patient.discharge?.completedAt || null,
      room: stay.room,
      bed: stay.bed,
      status: stay.status,
      admissionType: stay.admissionType,
      current: !discharged,
    },
  ]

  const admissionColumns = [
    {
      key: 'stay',
      header: 'Stay',
      render: (row) => (
        <span className={cn('text-xs font-medium', row.current ? 'text-primary' : 'text-muted-foreground')}>
          {row.current ? 'Current stay' : 'Completed stay'}
        </span>
      ),
    },
    { key: 'admissionDate', header: 'Admission Date', render: (row) => <span className="tabular-nums">{formatDate(row.admissionDate)}</span> },
    {
      key: 'dischargedAt',
      header: 'Discharge Date',
      render: (row) => <span className="tabular-nums">{row.dischargedAt ? formatDateTime(row.dischargedAt) : '—'}</span>,
    },
    { key: 'location', header: 'Room / Bed', render: (row) => (row.room || row.bed ? `${row.room || '—'} · ${row.bed || '—'}` : '—') },
    { key: 'type', header: 'Admission Type', render: (row) => (row.admissionType === 'maternity' ? 'Maternity' : 'Normal') },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ]

  const identityLine = [patient.gender, patient.age != null ? `${patient.age} years` : null, patient.address].filter(Boolean).join(' · ')

  return (
    <MotionPage>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={handleBack}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <MotionReveal>
        <Card className="mb-6">
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex min-w-0 items-start gap-4">
                <Avatar className="h-14 w-14 rounded-xl">
                  <AvatarFallback className="rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                    {initials(patient.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-semibold tracking-tight">{patient.name || 'Patient'}</h1>
                    <StatusBadge status={patient.status} />
                    {showCredit && listed ? <CreditBadge patient={listed} /> : null}
                    {showCredit && !listed && credit?.isCreditPatient ? (
                      <span className="inline-flex items-center rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                        Credit Patient
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-sm font-medium text-primary">{patient.patientId}</p>
                  {identityLine ? <p className="mt-1 text-sm text-muted-foreground">{identityLine}</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {canOpenBilling && (
                  <Button variant="outline" size="sm" onClick={() => navigate(`/reception/patient/${patient.patientId}`)}>
                    <Receipt className="h-4 w-4" /> View Billing
                  </Button>
                )}
                {canOpenBilling && canCreatePayments && !discharged && (
                  <Button variant="outline" size="sm" onClick={() => navigate(`/reception/patient/${patient.patientId}`)}>
                    <Wallet className="h-4 w-4" /> Add Deposit
                  </Button>
                )}
                {canRequestDischarge && listed && <RequestDischargeButton patient={listed} />}
              </div>
            </div>
          </CardContent>
        </Card>
      </MotionReveal>

      {canReviewRecords && pendingRecords.length > 0 && (
        <MotionReveal className="mb-6">
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-warning">Pending review</p>
                <p className="mt-1 text-sm font-semibold">
                  {pendingRecords.length} record{pendingRecords.length === 1 ? '' : 's'} waiting for approval
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => document.getElementById('service-activity')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                Review records
              </Button>
            </CardContent>
          </Card>
        </MotionReveal>
      )}

      <MotionReveal className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <SectionHead
            icon={BedDouble}
            kicker="Current stay"
            title={stay.admissionType === 'maternity' ? 'Maternity admission' : 'Inpatient stay'}
            description={stay.admissionReason || undefined}
            action={
              canAssignBeds && listed && activeStay ? (
                <RoomTransferPanel patientId={patient.patientId} assignedBy={user?.name} compact onTransferred={() => reload()} />
              ) : null
            }
          />
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</p>
                <div className="mt-1"><StatusBadge status={stay.status} /></div>
              </div>
              <Field label="Admission date" value={stay.admissionDate ? formatDate(stay.admissionDate) : null} />
              <Field label="Room" value={stay.room} />
              <Field label="Bed" value={stay.bed} />
              <Field label="Admission type" value={stay.admissionType === 'maternity' ? 'Maternity' : 'Normal'} />
              <Field label="Stay duration" value={stay.admissionDate ? `${stayDays} day${stayDays === 1 ? '' : 's'}` : null} />
              {patient.discharge?.completedAt ? (
                <Field label="Discharged" value={formatDateTime(patient.discharge.completedAt)} />
              ) : null}
            </div>
              {canCompleteDischarge && listed && pendingStay ? (
                <DischargeReviewPanel patient={listed} />
              ) : null}
          </CardContent>
        </Card>

        {includeMoney && finance ? (
          <Card>
            <SectionHead icon={Wallet} kicker="Financial overview" title="Approved charges and remaining balance" />
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <MetricTile label="Approved Charges" value={formatCurrency(finance.approvedCharges)} />
                <MetricTile label="Deposits" value={formatCurrency(finance.deposits)} tone="success" />
                <MetricTile label="Approved Returns/Credits" value={formatCurrency(finance.approvedReturns)} />
                <MetricTile
                  label="Current Balance"
                  value={formatCurrency(remaining)}
                  tone={remaining < 0 ? 'danger' : remaining > 0 ? 'success' : 'default'}
                />
              </div>
              {showCredit ? (
                <p className="mt-4 text-sm text-muted-foreground">
                  Credit status: {credit?.isCreditPatient || listed?.isCreditPatient ? 'Credit patient' : 'Not on credit'}
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <SectionHead icon={User} kicker="Overview" title="Stay snapshot" />
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <Field label="Admission date" value={stay.admissionDate ? formatDate(stay.admissionDate) : null} />
              <Field label="Room / Bed" value={stay.room || stay.bed ? `${stay.room || '—'} · ${stay.bed || '—'}` : null} />
              <Field label="Stay duration" value={stay.admissionDate ? `${stayDays} day${stayDays === 1 ? '' : 's'}` : null} />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Status</p>
                <div className="mt-1"><StatusBadge status={stay.status} /></div>
              </div>
            </CardContent>
          </Card>
        )}
      </MotionReveal>

      <MotionReveal className="space-y-6">
        <Card>
          <SectionHead icon={User} kicker="Patient information" title="Demographics" />
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Full name" value={patient.name} />
            <Field label="Patient ID" value={patient.patientId} mono />
            <Field label="Gender" value={patient.gender} />
            <Field label="Date of birth" value={patient.dateOfBirth} />
            <Field label="Age" value={patient.age} />
            <Field label="Phone" value={patient.phone} />
            <Field label="Address" value={patient.address} />
            <Field label="Emergency contact" value={patient.emergencyContact} />
            <Field label="Emergency phone" value={patient.emergencyPhone} />
            {patient.mrn ? <Field label="MRN" value={patient.mrn} mono /> : null}
            {patient.nationalId ? <Field label="National ID" value={patient.nationalId} mono /> : null}
            <Field label="Registration date" value={patient.createdAt ? formatDateTime(patient.createdAt) : null} />
          </CardContent>
        </Card>

        {listed && maternity ? (
          <MaternityAdmissionPanel patient={listed} canEdit={canEditPatient && !discharged} />
        ) : baby ? (
          <Card>
            <SectionHead icon={Baby} kicker="Maternity" title="Newborn" description="The baby is recorded under this mother's admission." />
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Name" value={baby.name} />
              <Field label="Sex" value={baby.sex} />
              <Field label="Date of birth" value={baby.dateOfBirth} />
              <Field label="Time of birth" value={baby.timeOfBirth} />
              <Field label="Birth weight (g)" value={baby.birthWeightGrams} />
              <Field label="Delivery type" value={baby.deliveryType} />
              <Field label="Status" value={baby.status} />
              <Field label="Notes" value={baby.notes} />
            </CardContent>
          </Card>
        ) : null}

        {canViewDoctors && listed ? (
          <AssignedDoctorsPanel
            patient={listed}
            canAdd={canAssignDoctors && !discharged}
            hideMoney={!includeMoney}
            onChanged={(res) => {
              if (res?.patient) applyPatientUpdate(res.patient)
              reload()
            }}
          />
        ) : (
          <Card>
            <SectionHead icon={Stethoscope} kicker="Care team" title="Visiting doctors" />
            <CardContent>
              {doctors?.length ? (
                <DataTable
                  columns={[
                    { key: 'doctor', header: 'Visiting Doctor', render: (row) => row.doctorName || '—' },
                    { key: 'specialty', header: 'Specialty', render: (row) => row.specialty || '—' },
                    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
                    { key: 'from', header: 'From', render: (row) => <span className="tabular-nums">{formatDate(row.effectiveFrom)}</span> },
                    { key: 'to', header: 'To', render: (row) => (row.effectiveTo ? <span className="tabular-nums">{formatDate(row.effectiveTo)}</span> : '—') },
                  ]}
                  data={doctors}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No visiting doctors assigned.</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card id="service-activity">
          <SectionHead
            icon={FileText}
            kicker="Service activity"
            title="Service records"
            action={
              canAddRecords ? (
                <Button size="sm" variant={showBuilder || historyEdit ? 'secondary' : 'outline'} onClick={() => { setShowBuilder((open) => !open); setHistoryEdit(null) }}>
                  <Plus className="h-4 w-4" /> Add Record
                </Button>
              ) : null
            }
          />
          <CardContent className="space-y-6">
            {canReviewRecords && pendingRecords.length > 0 && (
              <div className="space-y-3 rounded-lg border border-warning/40 bg-warning/5 p-4">
                <p className="text-sm font-semibold text-warning">Pending records</p>
                {pendingRecords.map((record) => (
                  <div key={record.id} className="flex flex-col gap-2 rounded-md border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">{record.recordName || 'Record'}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(record.recordDate)} · {record.recordedBy || '—'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleApprove(record)}>Approve</Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => setRejectRecordId(record.id)}>Reject</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {(showBuilder || historyEdit) && canAddRecords && (
              <ServiceRecordBuilder
                patientId={patientId}
                patientName={patient.name}
                patient={listed}
                source={canReviewRecords ? 'reception' : 'nurse'}
                recordedBy={user?.name || (canReviewRecords ? CURRENT_RECEPTIONIST : CURRENT_NURSE)}
                hideMoney={hideMoney}
                autoApprove={canReviewRecords}
                editRecord={historyEdit}
                onDone={() => {
                  setHistoryEdit(null)
                  setShowBuilder(false)
                  reload()
                }}
              />
            )}
            {liveRecords.length ? (
              maternity ? (
                <>
                  <div>
                    <h4 className="mb-3 text-sm font-semibold">Mother records</h4>
                    <RecordTimeline
                      records={motherRecords}
                      hideMoney={hideMoney}
                      showSubject
                      onEdit={canEditPatient && !canReviewRecords ? setHistoryEdit : undefined}
                    />
                  </div>
                  <div>
                    <h4 className="mb-3 text-sm font-semibold">Baby records</h4>
                    <RecordTimeline
                      records={babyRecords}
                      hideMoney={hideMoney}
                      showSubject
                      onEdit={canEditPatient && !canReviewRecords ? setHistoryEdit : undefined}
                    />
                  </div>
                </>
              ) : (
                <RecordTimeline
                  records={liveRecords}
                  hideMoney={hideMoney}
                  onEdit={canEditPatient && !canReviewRecords ? setHistoryEdit : undefined}
                />
              )
            ) : (
              <EmptyState icon={FileText} title="No service records" description="There are no service records for this stay." />
            )}
          </CardContent>
        </Card>

        {includeMoney && (
          <Card>
            <SectionHead icon={CreditCard} kicker="Payments" title="Deposits" />
            <CardContent>
              {deposits?.length ? (
                <DataTable columns={depositColumns} data={deposits} />
              ) : (
                <p className="text-sm text-muted-foreground">No deposits recorded.</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <SectionHead icon={BedDouble} kicker="History" title="Admission history" description="This application stores one inpatient stay per patient record." />
          <CardContent>
            <DataTable columns={admissionColumns} data={admissionRows} />
          </CardContent>
        </Card>

        <Card>
          <SectionHead icon={BedDouble} kicker="Location" title="Room / bed history" />
          <CardContent>
            {roomAssignments?.length ? (
              <DataTable columns={roomColumns} data={roomAssignments} />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Room" value={patient.room} />
                <Field label="Bed" value={patient.bed} />
              </div>
            )}
          </CardContent>
        </Card>
      </MotionReveal>

      <AlertDialog open={!!rejectRecordId} onOpenChange={() => setRejectRecordId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject record?</AlertDialogTitle>
            <AlertDialogDescription>Provide a reason. This uses the existing approval workflow.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Rejection reason" />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectReason('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReject} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MotionPage>
  )
}
