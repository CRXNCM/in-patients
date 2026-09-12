import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Phone, Calendar, Bed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/CommonComponents'
import { ServiceRecordBuilder } from '@/components/shared/ServiceRecordBuilder'
import { RecordTimeline } from '@/components/shared/RecordTimeline'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { formatDate } from '@/lib/utils'

export default function PatientServiceEntry() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { getPatient } = usePatients()
  const { getPatientRecords, CURRENT_NURSE } = useServiceEntries()

  const patient = getPatient(patientId)

  if (!patient) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground mb-4">Patient not found</p>
        <Button onClick={() => navigate('/nurse')}>Back to Dashboard</Button>
      </div>
    )
  }

  const records = getPatientRecords(patientId)

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate('/nurse')} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
      </Button>

      <PageHeader
        title={patient.name}
        description="Build today's record across all categories, then click Done. Edit anytime before reception approves."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" />{patient.name}</CardTitle>
          <CardDescription>ID: {patient.id}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div><p className="text-xs text-muted-foreground">Age / Gender</p><p className="font-medium">{patient.age} years · {patient.gender}</p></div>
            <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</p><p className="font-medium">{patient.phone}</p></div>
            <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Admitted</p><p className="font-medium">{formatDate(patient.admissionDate)}</p></div>
            <div><p className="text-xs text-muted-foreground flex items-center gap-1"><Bed className="h-3 w-3" /> Room / Bed</p><p className="font-medium">{patient.room} · {patient.bed}</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="mb-8">
        <ServiceRecordBuilder
          patientId={patientId}
          patientName={patient.name}
          source="nurse"
          recordedBy={CURRENT_NURSE}
          hideMoney
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record History — {patient.name}</CardTitle>
          <CardDescription>All submitted daily records and pharmacy returns</CardDescription>
        </CardHeader>
        <CardContent>
          <RecordTimeline records={records} hideMoney />
        </CardContent>
      </Card>
    </div>
  )
}
