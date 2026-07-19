import { Bed } from 'lucide-react'
import { PageHeader, DataTable } from '@/components/shared/CommonComponents'
import { roomCharges } from '@/data/mockData'
import { formatCurrency } from '@/lib/utils'

export default function RoomChargesPage() {
  const columns = [
    { key: 'roomType', header: 'Room Type', render: (row) => <span className="font-medium">{row.roomType}</span> },
    { key: 'dailyRate', header: 'Daily Rate', render: (row) => formatCurrency(row.dailyRate) },
    { key: 'beds', header: 'Total Beds' },
    { key: 'occupied', header: 'Occupied' },
    {
      key: 'occupancy',
      header: 'Occupancy Rate',
      render: (row) => {
        const rate = Math.round((row.occupied / row.beds) * 100)
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden max-w-[100px]">
              <div className="h-full bg-primary rounded-full" style={{ width: `${rate}%` }} />
            </div>
            <span className="text-sm font-medium">{rate}%</span>
          </div>
        )
      },
    },
  ]

  return (
    <div>
      <PageHeader title="Room Charges" description="Room types and daily rate configuration" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {roomCharges.map((room) => (
          <div key={room.id} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
                <Bed className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-semibold text-sm">{room.roomType}</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(room.dailyRate)}/day</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{room.occupied}/{room.beds} beds occupied</p>
          </div>
        ))}
      </div>
      <DataTable columns={columns} data={roomCharges} />
    </div>
  )
}
