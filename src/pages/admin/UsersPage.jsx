import { PageHeader, DataTable, StatusBadge } from '@/components/shared/CommonComponents'
import { users } from '@/data/mockData'

export default function UsersPage() {
  const columns = [
    { key: 'name', header: 'Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'email', header: 'Email' },
    { key: 'role', header: 'Role', render: (row) => (
      <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-semibold">{row.role}</span>
    )},
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ]

  return (
    <div>
      <PageHeader title="Users" description="System user accounts and roles" />
      <DataTable columns={columns} data={users} />
    </div>
  )
}
