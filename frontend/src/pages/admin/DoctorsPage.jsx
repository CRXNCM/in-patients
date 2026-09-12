import { PageHeader, DataTable, StatusBadge } from '@/components/shared/CommonComponents'
import { doctors } from '@/data/mockData'

export default function DoctorsPage() {
  const columns = [
    { key: 'name', header: 'Doctor Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'specialty', header: 'Specialty' },
    { key: 'department', header: 'Department' },
    { key: 'phone', header: 'Phone' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ]

  return (
    <div>
      <PageHeader title="Doctors" description="Medical staff directory" />
      <DataTable columns={columns} data={doctors} />
    </div>
  )
}
