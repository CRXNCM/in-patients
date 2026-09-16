import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Phone, Calendar, Bed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader, StatusBadge } from '@/components/shared/CommonComponents'
import { RequestDischargeButton } from '@/components/shared/DischargeWorkflow'
import { AssignedDoctorsPanel } from '@/components/shared/AssignedDoctorsPanel'
import { CreditBadge } from '@/components/shared/CreditBadge'
import { ServiceRecordBuilder } from '@/components/shared/ServiceRecordBuilder'
import { RecordTimeline } from '@/components/shared/RecordTimeline'
import { MaternityAdmissionPanel } from '@/components/shared/MaternityAdmissionPanel'
import { isMaternityAdmission } from '@/lib/maternity'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { formatDate } from '@/lib/utils'
import { MotionPage, MotionReveal } from '@/lib/motion'

export default function PatientServiceEntry() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { getPatient, applyPatientUpdate } = usePatients()
  const { getPatientRecords, CURRENT_NURSE } = useServiceEntries()
  const [historyEdit, setHistoryEdit] = useState(null)

  const patient = getPatient(patientId)

  if (!patient) {
    return (
      <div className="text-center py-20">
        <p className="mb-4 text-muted-foreground">Patient not found</p>
        <Button onClick={() => navigate('/nurse')}>Back to Dashboard</Button>
      </div>
    )
  }

  const records = getPatientRecords(patientId)
  const maternity = isMaternityAdmission(patient)
  const motherRecords = records.filter((r) => (r.subjectType || 'mother') !== 'baby')
  const babyRecords = records.filter((r) => r.subjectType === 'baby')

  return (
    <MotionPage>
      <Button variant="ghost" onClick={() => navigate('/nurse')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
      </Button>

      <PageHeader
        title={patient.name}
        description="Build today's record across all categories, then click Done. Edit anytime before reception approves."
        action={<RequestDischargeButton patient={patient} />}
      />

      <Card className="mb-6">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Inpatient stay</p>
              <p className="mt-1 font-mono text-xs font-medium text-primary">{patient.id}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={patient.status} />
                <CreditBadge patient={patient} />
              </div>
            </div>
          </div>
          <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-xs text-muted-foreground">Age / Gender</p><p className="font-medium">{patient.age} years · {patient.gender}</p></div>
            <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</p><p className="font-medium">{patient.phone}</p></div>
            <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Admitted</p><p className="font-medium">{formatDate(patient.admissionDate)}</p></div>
            <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Bed className="h-3 w-3" /> Room / Bed</p><p className="font-medium">{patient.room} · {patient.bed}</p></div>
          </div>
        </CardContent>
      </Card>

      <MaternityAdmissionPanel patient={patient} canEdit={patient.status !== 'discharged'} />

      <AssignedDoctorsPanel
        patient={patient}
        canAdd={patient.status !== 'discharged'}
        onChanged={(res) => {
          if (res?.patient) applyPatientUpdate(res.patient)
        }}
      />

      {patient.status === 'pending-discharge' && (
        <MotionReveal className="mb-6 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm shadow-sm">
          Discharge request is pending reception review. The patient still occupies {patient.room} / {patient.bed}.
        </MotionReveal>
      )}

      {patient.status !== 'discharged' ? (
        <div className="mb-8">
          <ServiceRecordBuilder
            patientId={patientId}
            patientName={patient.name}
            patient={patient}
            source="nurse"
            recordedBy={CURRENT_NURSE}
            hideMoney
            editRecord={historyEdit}
            onDone={() => setHistoryEdit(null)}
          />
        </div>
      ) : (
        <p className="mb-8 text-sm text-muted-foreground">This patient is discharged. New inpatient services cannot be recorded.</p>
      )}

      <Card>
        <CardHeader>
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">History</p>
          <CardTitle className="mt-1 text-lg">Record History — {patient.name}</CardTitle>
          <CardDescription>
            {maternity ? 'Mother and baby records stay on this same maternity admission.' : 'All submitted daily records and pharmacy returns'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {maternity ? (
            <>
              <div>
                <h4 className="text-sm font-semibold mb-3">Mother records</h4>
                <RecordTimeline records={motherRecords} hideMoney showSubject onEdit={setHistoryEdit} />
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-3">Baby records</h4>
                <RecordTimeline records={babyRecords} hideMoney showSubject onEdit={setHistoryEdit} />
              </div>
            </>
          ) : (
            <RecordTimeline records={records} hideMoney onEdit={setHistoryEdit} />
          )}
        </CardContent>
      </Card>
    </MotionPage>
  )
}
