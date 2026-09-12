import { useNavigate } from 'react-router-dom'
import { Users, ClipboardList, Clock, Activity, ArrowRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard, StatusBadge, PageHeader, DataTable } from '@/components/shared/CommonComponents'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { formatDate } from '@/lib/utils'

export default function NurseDashboard() {
  const navigate = useNavigate()
  const { patients } = usePatients()
  const { getPendingCount, getRecentRecords, getPatientRecords, CURRENT_NURSE } = useServiceEntries()

  const pendingCount = getPendingCount()
  const myPending = getRecentRecords(30).filter((r) => r.recordedBy === CURRENT_NURSE && r.status === 'pending').length
  const recentRecords = getRecentRecords(6)

  const columns = [
    { key: 'id', header: 'Patient ID', render: (row) => <span className="font-mono text-xs font-medium text-primary">{row.id}</span> },
    { key: 'name', header: 'Patient Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'room', header: 'Room/Bed', render: (row) => `${row.room} / ${row.bed}` },
    { key: 'admissionDate', header: 'Admission', render: (row) => formatDate(row.admissionDate) },
    {
      key: 'records',
      header: 'Records',
      render: (row) => {
        const recs = getPatientRecords(row.id)
        const pending = recs.filter((r) => r.status === 'pending').length
        return <span className="text-sm">{recs.length} total{pending > 0 && <span className="text-amber-600 ml-1">({pending} pending)</span>}</span>
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <Button size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/nurse/patient/${row.id}`) }}>
          <Plus className="h-4 w-4 mr-1" /> Record Services
        </Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Nurse Dashboard"
        description="Record daily patient services — no billing or payment access"
        action={<Button onClick={() => navigate('/nurse/patients')}>View All Patients <ArrowRight className="h-4 w-4 ml-2" /></Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard title="Admitted Patients" value={patients.length} subtitle="Under your care" icon={Users} iconClassName="bg-blue-100 text-blue-600" />
        <StatCard title="My Pending Records" value={myPending} subtitle="Awaiting reception" icon={Clock} iconClassName="bg-amber-100 text-amber-600" />
        <StatCard title="Hospital Pending Queue" value={pendingCount} subtitle="All pending records" icon={ClipboardList} iconClassName="bg-orange-100 text-orange-600" />
        <StatCard title="Recent Activity" value={recentRecords.length} subtitle="Latest records" icon={Activity} iconClassName="bg-emerald-100 text-emerald-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Admitted Patients</CardTitle>
            <Button variant="outline" size="sm" onClick={() => navigate('/nurse/patients')}>View All</Button>
          </CardHeader>
          <CardContent className="p-0">
            <DataTable columns={columns} data={patients.slice(0, 5)} onRowClick={(row) => navigate(`/nurse/patient/${row.id}`)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Recent Records</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentRecords.map((rec) => (
                <div key={rec.id} className="flex items-start justify-between gap-2 pb-3 border-b last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{rec.recordName}</p>
                    <p className="text-xs text-muted-foreground">{rec.type === 'pharmacy_return' ? 'Pharmacy Return' : 'Daily Services'} · {rec.services?.length || rec.returnItems?.length} item(s)</p>
                  </div>
                  <StatusBadge status={rec.status} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
