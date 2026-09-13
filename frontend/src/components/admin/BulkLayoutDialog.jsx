import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/api/client'
import { useToast } from '@/context/ToastContext'

const ROOM_TYPES = ['General Ward', 'Private Room', 'ICU', 'Operation', 'Delivery Room']
const BED_STATUSES = [
  { value: 'available', label: 'Available' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'out_of_service', label: 'Out of service' },
]

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-destructive mt-1">{message}</p>
}

const emptyRooms = {
  wardId: '',
  roomType: 'General Ward',
  roomCount: '40',
  bedsPerRoom: '2',
  roomPrefix: 'GW',
  roomPattern: '{prefix}-{number}',
  bedPattern: '{room}-B{number}',
  startNumber: '1',
  padWidth: '2',
  status: 'available',
}

const emptyBeds = {
  roomId: '',
  bedCount: '4',
  bedPattern: '{room}-B{number}',
  startNumber: '1',
  padWidth: '2',
  status: 'available',
}

export function BulkLayoutDialog({
  open,
  onOpenChange,
  mode,
  wards = [],
  rooms = [],
  onCreated,
}) {
  const { toast } = useToast()
  const isRooms = mode === 'rooms'
  const [form, setForm] = useState(isRooms ? emptyRooms : emptyBeds)
  const [errors, setErrors] = useState({})
  const [preview, setPreview] = useState(null)
  const [previewErrors, setPreviewErrors] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    if (isRooms) {
      setForm({ ...emptyRooms, wardId: wards.find((ward) => ward.active)?.id || '' })
    } else {
      setForm({ ...emptyBeds, roomId: rooms.find((room) => room.active)?.id || '' })
    }
    setPreview(null)
    setPreviewErrors([])
    setErrors({})
  }, [open, isRooms])

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setPreview(null)
    setPreviewErrors([])
  }

  const body = useMemo(() => {
    if (isRooms) {
      return {
        wardId: form.wardId,
        roomType: form.roomType,
        roomCount: Number(form.roomCount),
        bedsPerRoom: Number(form.bedsPerRoom),
        roomPrefix: form.roomPrefix,
        roomPattern: form.roomPattern,
        bedPattern: form.bedPattern,
        startNumber: Number(form.startNumber),
        padWidth: Number(form.padWidth),
        status: form.status,
      }
    }
    return {
      roomId: form.roomId,
      bedCount: Number(form.bedCount),
      bedPattern: form.bedPattern,
      startNumber: Number(form.startNumber),
      padWidth: Number(form.padWidth),
      status: form.status,
    }
  }, [form, isRooms])

  const handlePreview = async () => {
    const next = {}
    if (isRooms && !form.wardId) next.wardId = 'Ward is required.'
    if (!isRooms && !form.roomId) next.roomId = 'Room is required.'
    setErrors(next)
    if (Object.keys(next).length) return
    setLoading(true)
    try {
      const result = isRooms ? await api.previewBulkRooms(body) : await api.previewBulkBeds(body)
      setPreview(result.plan)
      setPreviewErrors([])
    } catch (err) {
      setPreview(null)
      setPreviewErrors(err.errors || [err.message])
      toast({ title: 'Preview failed', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!preview) {
      toast({ title: 'Preview first', description: 'Review the generated names before creating.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const result = isRooms ? await api.bulkCreateRooms(body) : await api.bulkCreateBeds(body)
      toast({
        title: isRooms ? 'Rooms and beds created' : 'Beds created',
        description: `${result.roomCount || 0} room(s), ${result.bedCount || 0} bed(s).`,
        variant: 'success',
      })
      setPreview(null)
      onOpenChange(false)
      onCreated?.()
    } catch (err) {
      toast({ title: 'Bulk create failed', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setPreview(null)
          setPreviewErrors([])
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isRooms ? 'Bulk create rooms and beds' : 'Bulk create beds'}</DialogTitle>
          <DialogDescription>
            Preview the generated names first. Nothing is saved until you confirm. Occupied beds are never changed.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {isRooms ? (
            <>
              <div className="sm:col-span-2">
                <Label>Ward</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.wardId} onChange={(e) => set('wardId', e.target.value)}>
                  <option value="">Select a ward</option>
                  {wards.filter((ward) => ward.active).map((ward) => (
                    <option key={ward.id} value={ward.id}>{ward.name} — {ward.departmentName}</option>
                  ))}
                </select>
                <FieldError message={errors.wardId} />
              </div>
              <div>
                <Label>Room type</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.roomType} onChange={(e) => set('roomType', e.target.value)}>
                  {ROOM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div>
                <Label>Room prefix</Label>
                <Input value={form.roomPrefix} onChange={(e) => set('roomPrefix', e.target.value)} placeholder="GW" />
              </div>
              <div>
                <Label>Number of rooms</Label>
                <Input type="number" min="1" value={form.roomCount} onChange={(e) => set('roomCount', e.target.value)} />
              </div>
              <div>
                <Label>Beds per room</Label>
                <Input type="number" min="1" value={form.bedsPerRoom} onChange={(e) => set('bedsPerRoom', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>Room naming pattern</Label>
                <Input value={form.roomPattern} onChange={(e) => set('roomPattern', e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">Tokens: {'{prefix}'} {'{number}'} {'{room}'}</p>
              </div>
            </>
          ) : (
            <>
              <div className="sm:col-span-2">
                <Label>Room</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.roomId} onChange={(e) => set('roomId', e.target.value)}>
                  <option value="">Select a room</option>
                  {rooms.filter((room) => room.active).map((room) => (
                    <option key={room.id} value={room.id}>{room.name} — {room.wardName} ({room.bedCount || 0}/{room.capacity} beds)</option>
                  ))}
                </select>
                <FieldError message={errors.roomId} />
              </div>
              <div>
                <Label>Number of beds</Label>
                <Input type="number" min="1" value={form.bedCount} onChange={(e) => set('bedCount', e.target.value)} />
              </div>
            </>
          )}
          <div className={isRooms ? 'sm:col-span-2' : ''}>
            <Label>Bed naming pattern</Label>
            <Input value={form.bedPattern} onChange={(e) => set('bedPattern', e.target.value)} />
          </div>
          <div>
            <Label>Starting number</Label>
            <Input type="number" min="1" value={form.startNumber} onChange={(e) => set('startNumber', e.target.value)} />
          </div>
          <div>
            <Label>Number padding</Label>
            <Input type="number" min="1" max="4" value={form.padWidth} onChange={(e) => set('padWidth', e.target.value)} />
          </div>
          <div>
            <Label>Initial bed status</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={(e) => set('status', e.target.value)}>
              {BED_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
        </div>

        {previewErrors.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {previewErrors.map((item) => <p key={item}>{item}</p>)}
          </div>
        )}

        {preview && (
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-sm font-medium">
              Preview: {preview.roomCount || 0} room(s), {preview.bedCount || 0} bed(s)
              {preview.status ? ` · initial status ${preview.status}` : ''}
            </p>
            <div className="max-h-56 overflow-auto text-sm space-y-2">
              {preview.rooms.map((room) => (
                <div key={room.name}>
                  <p className="font-medium">{room.name}</p>
                  <ul className="pl-4 text-muted-foreground">
                    {room.beds.map((bed) => <li key={bed.name}>└ {bed.name}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="secondary" onClick={handlePreview} disabled={loading}>{loading ? 'Previewing…' : 'Preview'}</Button>
          <Button onClick={handleCreate} disabled={!preview || saving}>{saving ? 'Creating…' : 'Confirm create'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
