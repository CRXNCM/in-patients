import { useState } from 'react'
import { ArrowRightLeft, Bed, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { usePatients } from '@/context/PatientsContext'
import { useServiceEntries } from '@/context/ServiceEntriesContext'
import { useToast } from '@/context/ToastContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { hospitalRooms } from '@/data/mockData'

export function RoomHistoryTable({ assignments, rooms = hospitalRooms }) {
  if (!assignments?.length) {
    return <p className="text-sm text-muted-foreground text-center py-6">No room assignments recorded</p>
  }

  const sorted = [...assignments].sort((a, b) => new Date(b.start_date) - new Date(a.start_date))

  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Room / Bed</th>
            <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Daily Rate</th>
            <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Start</th>
            <th className="px-4 py-3 text-left font-semibold text-muted-foreground">End</th>
            <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Reason</th>
            <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Assigned By</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((a) => {
            const room = rooms.find((r) => r.id === a.room_id)
            const bed = room?.beds.find((b) => b.id === a.bed_id)
            const isCurrent = a.end_date === null
            return (
              <tr key={a.id} className="border-b">
                <td className="px-4 py-3">
                  <span className="font-medium">{room?.roomType || '—'}</span>
                  <span className="text-muted-foreground"> · {bed?.label || a.bed_id}</span>
                  {isCurrent && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
                      Current
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{formatCurrency(a.daily_rate)}</td>
                <td className="px-4 py-3">{formatDate(a.start_date)}</td>
                <td className="px-4 py-3">{a.end_date ? formatDate(a.end_date) : '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.transfer_reason || '—'}</td>
                <td className="px-4 py-3">{a.assigned_by}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function RoomTransferPanel({
  patientId,
  assignedBy = 'Sara Bekele',
  compact = false,
  onTransferred,
}) {
  const { toast } = useToast()
  const { getPatient, getRoomAssignments, transferPatientRoom, rooms } = usePatients()
  const { ensureAutomaticDailyCharges } = useServiceEntries()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    roomId: '',
    bedId: '',
    transferDate: new Date().toISOString().split('T')[0],
    transferReason: '',
  })

  const patient = getPatient(patientId)
  const assignments = getRoomAssignments(patientId)
  const availableBeds = rooms.flatMap((room) =>
    room.beds
      .filter((b) => b.status === 'available')
      .map((bed) => ({ room, bed }))
  )

  const selectedRoom = rooms.find((r) => r.id === form.roomId)
  const availableBedsInRoom = selectedRoom?.beds.filter((b) => b.status === 'available') || []

  const handleTransfer = async () => {
    if (!form.roomId || !form.bedId) {
      toast({ title: 'Select room and bed', variant: 'destructive' })
      return
    }
    if (!form.transferReason.trim()) {
      toast({ title: 'Transfer reason required', variant: 'destructive' })
      return
    }

    try {
      const result = await transferPatientRoom(patientId, {
        roomId: form.roomId,
        bedId: form.bedId,
        transferDate: form.transferDate,
        transferReason: form.transferReason.trim(),
        assignedBy,
      })

      if (!result) {
        toast({ title: 'Transfer failed', description: 'Bed may no longer be available', variant: 'destructive' })
        return
      }

      await ensureAutomaticDailyCharges(patientId)
      setOpen(false)
      setForm({
        roomId: '',
        bedId: '',
        transferDate: new Date().toISOString().split('T')[0],
        transferReason: '',
      })
      toast({
        title: 'Room Transfer Complete',
        description: `${patient?.name} moved to ${result.roomType} · ${result.bedLabel}`,
        variant: 'success',
      })
      onTransferred?.(result)
    } catch (err) {
      toast({ title: 'Transfer failed', description: err.message, variant: 'destructive' })
    }
  }

  if (!patient || patient.status === 'discharged') return null

  if (compact) {
    return (
      <>
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <ArrowRightLeft className="h-4 w-4 mr-1" /> Transfer Room
        </Button>
        <TransferDialog
          open={open}
          onOpenChange={setOpen}
          patient={patient}
          form={form}
          setForm={setForm}
          rooms={rooms}
          availableBedsInRoom={availableBedsInRoom}
          availableCount={availableBeds.length}
          onTransfer={handleTransfer}
        />
      </>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium flex items-center gap-2">
            <Bed className="h-4 w-4 text-primary" />
            Current: {patient.room} · {patient.bed}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Room charges use each assignment&apos;s stored daily rate from transfer history.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer Room
        </Button>
      </div>

      <div>
        <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <History className="h-4 w-4" /> Room Assignment History
        </h4>
        <RoomHistoryTable assignments={assignments} rooms={rooms} />
      </div>

      <TransferDialog
        open={open}
        onOpenChange={setOpen}
        patient={patient}
        form={form}
        setForm={setForm}
        rooms={rooms}
        availableBedsInRoom={availableBedsInRoom}
        availableCount={availableBeds.length}
        onTransfer={handleTransfer}
      />
    </div>
  )
}

function TransferDialog({
  open,
  onOpenChange,
  patient,
  form,
  setForm,
  rooms,
  availableBedsInRoom,
  availableCount,
  onTransfer,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Room — {patient?.name}</DialogTitle>
          <DialogDescription>
            Current: {patient?.room} · {patient?.bed}. Previous assignment will be closed and the old bed marked available.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Transfer Date</Label>
            <Input
              type="date"
              min={patient?.admissionDate}
              value={form.transferDate}
              onChange={(e) => setForm((p) => ({ ...p, transferDate: e.target.value }))}
            />
          </div>
          <div>
            <Label>New Room Type</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.roomId}
              onChange={(e) => setForm((p) => ({ ...p, roomId: e.target.value, bedId: '' }))}
            >
              <option value="">Select room type...</option>
              {rooms.map((room) => {
                const avail = room.beds.filter((b) => b.status === 'available').length
                return (
                  <option key={room.id} value={room.id} disabled={avail === 0}>
                    {room.roomType} — {formatCurrency(room.dailyRate)}/day ({avail} bed{avail !== 1 ? 's' : ''} free)
                  </option>
                )
              })}
            </select>
          </div>
          <div>
            <Label>Available Bed</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.bedId}
              onChange={(e) => setForm((p) => ({ ...p, bedId: e.target.value }))}
              disabled={!form.roomId}
            >
              <option value="">Select bed...</option>
              {availableBedsInRoom.map((bed) => (
                <option key={bed.id} value={bed.id}>{bed.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Transfer Reason *</Label>
            <Input
              placeholder="Clinical need, upgrade, isolation..."
              value={form.transferReason}
              onChange={(e) => setForm((p) => ({ ...p, transferReason: e.target.value }))}
            />
          </div>
          {availableCount === 0 && (
            <p className="text-sm text-amber-600">No available beds in the hospital right now.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onTransfer} disabled={availableCount === 0}>
            Confirm Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
