import { useEffect, useState } from 'react'
import { Building2, LayoutGrid, Pencil, Plus, Search } from 'lucide-react'
import { BulkLayoutDialog } from '@/components/admin/BulkLayoutDialog'
import { PageHeader, DataTable, StatusBadge, EmptyState } from '@/components/shared/CommonComponents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { api, USE_API } from '@/api/client'
import { formatDate } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'

const emptyDepartment = { name: '', description: '', active: true }
const emptyWard = { name: '', description: '', departmentId: '', active: true }
const emptyRoom = { name: '', wardId: '', roomType: 'General Ward', capacity: 2, dailyRate: '', description: '', active: true }
const emptyBed = { name: '', roomId: '', status: 'available' }
const ROOM_TYPES = ['General Ward', 'Private Room', 'ICU', 'Operation', 'Delivery Room']

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-destructive mt-1">{message}</p>
}

export default function DepartmentsPage() {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const canViewDepartments = hasPermission('departments.view')
  const canCreateDepartment = hasPermission('departments.create')
  const canEditDepartment = hasPermission('departments.edit') || hasPermission('departments.manage')
  const canViewWards = hasPermission('wards.view')
  const canCreateWard = hasPermission('wards.create')
  const canEditWard = hasPermission('wards.edit') || hasPermission('wards.manage')
  const canViewRooms = hasPermission('rooms.view') || hasPermission('rooms.manage_rooms')
  const canCreateRoom = hasPermission('rooms.create') || hasPermission('rooms.manage_rooms')
  const canEditRoom = hasPermission('rooms.edit') || hasPermission('rooms.manage_rooms')
  const canViewBeds = hasPermission('beds.view') || hasPermission('rooms.manage_beds') || hasPermission('rooms.view')
  const canCreateBed = hasPermission('beds.create') || hasPermission('rooms.manage_beds')
  const canEditBed = hasPermission('beds.edit') || hasPermission('beds.manage') || hasPermission('rooms.manage_beds')

  const [tab, setTab] = useState(canViewDepartments ? 'departments' : canViewWards ? 'wards' : canViewRooms ? 'rooms' : 'beds')
  const [departments, setDepartments] = useState([])
  const [wards, setWards] = useState([])
  const [rooms, setRooms] = useState([])
  const [beds, setBeds] = useState([])
  const [loading, setLoading] = useState(true)

  const [deptQuery, setDeptQuery] = useState('')
  const [deptStatus, setDeptStatus] = useState('all')
  const [wardQuery, setWardQuery] = useState('')
  const [wardStatus, setWardStatus] = useState('all')
  const [wardDeptFilter, setWardDeptFilter] = useState('all')

  const [deptOpen, setDeptOpen] = useState(false)
  const [deptMode, setDeptMode] = useState('create')
  const [deptForm, setDeptForm] = useState(emptyDepartment)
  const [deptErrors, setDeptErrors] = useState({})
  const [savingDept, setSavingDept] = useState(false)
  const [deptConfirm, setDeptConfirm] = useState(null)

  const [wardOpen, setWardOpen] = useState(false)
  const [wardMode, setWardMode] = useState('create')
  const [wardForm, setWardForm] = useState(emptyWard)
  const [wardErrors, setWardErrors] = useState({})
  const [savingWard, setSavingWard] = useState(false)
  const [wardConfirm, setWardConfirm] = useState(null)

  const [roomQuery, setRoomQuery] = useState('')
  const [roomStatus, setRoomStatus] = useState('all')
  const [roomDeptFilter, setRoomDeptFilter] = useState('all')
  const [roomWardFilter, setRoomWardFilter] = useState('all')
  const [roomOpen, setRoomOpen] = useState(false)
  const [roomMode, setRoomMode] = useState('create')
  const [roomForm, setRoomForm] = useState(emptyRoom)
  const [roomErrors, setRoomErrors] = useState({})
  const [savingRoom, setSavingRoom] = useState(false)
  const [roomConfirm, setRoomConfirm] = useState(null)

  const [bedQuery, setBedQuery] = useState('')
  const [bedStatus, setBedStatus] = useState('all')
  const [bedWardFilter, setBedWardFilter] = useState('all')
  const [bedOpen, setBedOpen] = useState(false)
  const [bedMode, setBedMode] = useState('create')
  const [bedForm, setBedForm] = useState(emptyBed)
  const [bedErrors, setBedErrors] = useState({})
  const [savingBed, setSavingBed] = useState(false)
  const [bedConfirm, setBedConfirm] = useState(null)
  const [bulkRoomsOpen, setBulkRoomsOpen] = useState(false)
  const [bulkBedsOpen, setBulkBedsOpen] = useState(false)
  const canBulkRooms = canCreateRoom && canCreateBed
  const canBulkBeds = canCreateBed

  const load = async () => {
    if (!USE_API) {
      setLoading(false)
      return
    }
    const [deptRows, wardRows, roomRows, bedRows] = await Promise.all([
      canViewDepartments || canViewRooms ? api.getDepartments().catch(() => []) : Promise.resolve([]),
      canViewWards || canViewRooms || canViewBeds ? api.getWards().catch(() => []) : Promise.resolve([]),
      canViewRooms ? api.getSetupRooms() : Promise.resolve([]),
      canViewBeds ? api.getSetupBeds() : Promise.resolve([]),
    ])
    setDepartments(deptRows)
    setWards(wardRows)
    setRooms(roomRows)
    setBeds(bedRows)
  }

  useEffect(() => {
    setLoading(true)
    load()
      .catch((err) => toast({ title: 'Failed to load hospital setup', description: err.message, variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [])

  const activeDepartments = departments.filter((row) => row.active)
  const filteredDepartments = departments.filter((row) => {
    const q = deptQuery.trim().toLowerCase()
    const matchesQuery = !q || `${row.name} ${row.description}`.toLowerCase().includes(q)
    const matchesStatus = deptStatus === 'all' || row.status === deptStatus
    return matchesQuery && matchesStatus
  })
  const filteredWards = wards.filter((row) => {
    const q = wardQuery.trim().toLowerCase()
    const matchesQuery = !q || `${row.name} ${row.departmentName}`.toLowerCase().includes(q)
    const matchesStatus = wardStatus === 'all' || row.status === wardStatus
    const matchesDept = wardDeptFilter === 'all' || row.departmentId === wardDeptFilter
    return matchesQuery && matchesStatus && matchesDept
  })

  const openCreateDepartment = () => {
    setDeptMode('create')
    setDeptForm(emptyDepartment)
    setDeptErrors({})
    setDeptOpen(true)
  }

  const openEditDepartment = (row) => {
    setDeptMode('edit')
    setDeptForm({ id: row.id, name: row.name, description: row.description || '', active: row.active })
    setDeptErrors({})
    setDeptOpen(true)
  }

  const saveDepartment = async () => {
    const errors = {}
    if (!deptForm.name.trim()) errors.name = 'Department name is required.'
    setDeptErrors(errors)
    if (errors.name) return
    setSavingDept(true)
    try {
      const body = { name: deptForm.name.trim(), description: deptForm.description, active: deptForm.active }
      if (deptMode === 'create') await api.createDepartment(body)
      else await api.updateDepartment(deptForm.id, body)
      await load()
      setDeptOpen(false)
      toast({ title: deptMode === 'create' ? 'Department created' : 'Department updated', variant: 'success' })
    } catch (err) {
      toast({ title: 'Could not save department', description: err.message, variant: 'destructive' })
    } finally {
      setSavingDept(false)
    }
  }

  const toggleDepartment = async (row) => {
    try {
      await api.updateDepartment(row.id, { active: !row.active })
      await load()
      toast({ title: row.active ? 'Department deactivated' : 'Department activated', variant: 'success' })
    } catch (err) {
      toast({ title: 'Status change failed', description: err.message, variant: 'destructive' })
    } finally {
      setDeptConfirm(null)
    }
  }

  const openCreateWard = () => {
    setWardMode('create')
    setWardForm({ ...emptyWard, departmentId: activeDepartments[0]?.id || '' })
    setWardErrors({})
    setWardOpen(true)
  }

  const openEditWard = (row) => {
    setWardMode('edit')
    setWardForm({
      id: row.id,
      name: row.name,
      description: row.description || '',
      departmentId: row.departmentId,
      active: row.active,
    })
    setWardErrors({})
    setWardOpen(true)
  }

  const saveWard = async () => {
    const errors = {}
    if (!wardForm.name.trim()) errors.name = 'Ward name is required.'
    if (!wardForm.departmentId) errors.departmentId = 'Department is required.'
    setWardErrors(errors)
    if (Object.keys(errors).length) return
    setSavingWard(true)
    try {
      const body = {
        name: wardForm.name.trim(),
        description: wardForm.description,
        departmentId: wardForm.departmentId,
        active: wardForm.active,
      }
      if (wardMode === 'create') await api.createWard(body)
      else await api.updateWard(wardForm.id, body)
      await load()
      setWardOpen(false)
      toast({ title: wardMode === 'create' ? 'Ward created' : 'Ward updated', variant: 'success' })
    } catch (err) {
      toast({ title: 'Could not save ward', description: err.message, variant: 'destructive' })
    } finally {
      setSavingWard(false)
    }
  }

  const activeWards = wards.filter((row) => row.active)
  const activeRooms = rooms.filter((row) => row.active)
  const filteredRooms = rooms.filter((row) => {
    const q = roomQuery.trim().toLowerCase()
    const matchesQuery = !q || `${row.name} ${row.wardName} ${row.departmentName}`.toLowerCase().includes(q)
    const matchesStatus = roomStatus === 'all' || row.status === roomStatus
    const matchesDept = roomDeptFilter === 'all' || row.departmentId === roomDeptFilter
    const matchesWard = roomWardFilter === 'all' || row.wardId === roomWardFilter
    return matchesQuery && matchesStatus && matchesDept && matchesWard
  })
  const filteredBeds = beds.filter((row) => {
    const q = bedQuery.trim().toLowerCase()
    const matchesQuery = !q || `${row.name} ${row.label} ${row.roomName} ${row.wardName} ${row.patientId || ''}`.toLowerCase().includes(q)
    const matchesStatus = bedStatus === 'all' || row.status === bedStatus
    const matchesWard = bedWardFilter === 'all' || row.wardId === bedWardFilter
    return matchesQuery && matchesStatus && matchesWard
  })

  const openCreateRoom = () => {
    setRoomMode('create')
    setRoomForm({ ...emptyRoom, wardId: activeWards[0]?.id || '' })
    setRoomErrors({})
    setRoomOpen(true)
  }

  const openEditRoom = (row) => {
    setRoomMode('edit')
    setRoomForm({
      id: row.id,
      name: row.name,
      wardId: row.wardId,
      roomType: row.roomType,
      capacity: row.capacity,
      dailyRate: String(row.dailyRate ?? ''),
      description: row.description || '',
      active: row.active,
    })
    setRoomErrors({})
    setRoomOpen(true)
  }

  const saveRoom = async () => {
    const errors = {}
    if (!roomForm.name.trim()) errors.name = 'Room number is required.'
    if (!roomForm.wardId) errors.wardId = 'Ward is required.'
    if (!roomForm.capacity) errors.capacity = 'Capacity is required.'
    setRoomErrors(errors)
    if (Object.keys(errors).length) return
    setSavingRoom(true)
    try {
      const body = {
        name: roomForm.name.trim(),
        wardId: roomForm.wardId,
        roomType: roomForm.roomType,
        capacity: Number(roomForm.capacity),
        dailyRate: roomForm.dailyRate === '' ? undefined : Number(roomForm.dailyRate),
        description: roomForm.description,
        active: roomForm.active,
      }
      if (roomMode === 'create') await api.createRoom(body)
      else await api.updateRoom(roomForm.id, body)
      await load()
      setRoomOpen(false)
      toast({ title: roomMode === 'create' ? 'Room created' : 'Room updated', variant: 'success' })
    } catch (err) {
      toast({ title: 'Could not save room', description: err.message, variant: 'destructive' })
    } finally {
      setSavingRoom(false)
    }
  }

  const toggleRoom = async (row) => {
    try {
      await api.updateRoom(row.id, { active: !row.active })
      await load()
      toast({ title: row.active ? 'Room deactivated' : 'Room activated', variant: 'success' })
    } catch (err) {
      toast({ title: 'Status change failed', description: err.message, variant: 'destructive' })
    } finally {
      setRoomConfirm(null)
    }
  }

  const openCreateBed = () => {
    setBedMode('create')
    setBedForm({ ...emptyBed, roomId: activeRooms[0]?.id || '' })
    setBedErrors({})
    setBedOpen(true)
  }

  const openEditBed = (row) => {
    setBedMode('edit')
    setBedForm({
      id: row.id,
      name: row.name,
      roomId: row.roomId || '',
      status: row.status,
    })
    setBedErrors({})
    setBedOpen(true)
  }

  const saveBed = async () => {
    const errors = {}
    if (!bedForm.name.trim()) errors.name = 'Bed identifier is required.'
    if (!bedForm.roomId) errors.roomId = 'Room is required.'
    setBedErrors(errors)
    if (Object.keys(errors).length) return
    setSavingBed(true)
    try {
      const body = { name: bedForm.name.trim(), roomId: bedForm.roomId, status: bedForm.status }
      if (bedMode === 'create') await api.createBed(body)
      else await api.updateBed(bedForm.id, body)
      await load()
      setBedOpen(false)
      toast({ title: bedMode === 'create' ? 'Bed created' : 'Bed updated', variant: 'success' })
    } catch (err) {
      toast({ title: 'Could not save bed', description: err.message, variant: 'destructive' })
    } finally {
      setSavingBed(false)
    }
  }

  const changeBedStatus = async (row, status) => {
    try {
      await api.updateBed(row.id, { status })
      await load()
      toast({ title: `Bed marked ${status.replace('_', ' ')}`, variant: 'success' })
    } catch (err) {
      toast({ title: 'Status change failed', description: err.message, variant: 'destructive' })
    } finally {
      setBedConfirm(null)
    }
  }

  const toggleWard = async (row) => {
    try {
      await api.updateWard(row.id, { active: !row.active })
      await load()
      toast({ title: row.active ? 'Ward deactivated' : 'Ward activated', variant: 'success' })
    } catch (err) {
      toast({ title: 'Status change failed', description: err.message, variant: 'destructive' })
    } finally {
      setWardConfirm(null)
    }
  }

  const departmentColumns = [
    { key: 'name', header: 'Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'wardCount', header: 'Wards', render: (row) => row.wardCount ?? 0 },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'updatedAt', header: 'Updated', render: (row) => (row.updatedAt ? formatDate(row.updatedAt) : '—') },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {canEditDepartment && (
            <Button size="sm" variant="ghost" onClick={() => openEditDepartment(row)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
          {canEditDepartment && (
            <Button size="sm" variant="outline" onClick={() => setDeptConfirm(row)}>
              {row.active ? 'Deactivate' : 'Activate'}
            </Button>
          )}
        </div>
      ),
    },
  ]

  const wardColumns = [
    { key: 'name', header: 'Ward', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'departmentName', header: 'Department' },
    { key: 'roomCount', header: 'Rooms', render: (row) => row.roomCount ?? 0 },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {canEditWard && (
            <Button size="sm" variant="ghost" onClick={() => openEditWard(row)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
          {canEditWard && (
            <Button size="sm" variant="outline" onClick={() => setWardConfirm(row)}>
              {row.active ? 'Deactivate' : 'Activate'}
            </Button>
          )}
        </div>
      ),
    },
  ]

  const roomColumns = [
    { key: 'name', header: 'Room', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'departmentName', header: 'Department' },
    { key: 'wardName', header: 'Ward' },
    { key: 'capacity', header: 'Capacity' },
    { key: 'bedUsage', header: 'Bed usage', render: (row) => `${row.occupiedCount || 0}/${row.bedCount || 0}` },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {canEditRoom && (
            <Button size="sm" variant="ghost" onClick={() => openEditRoom(row)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
          {canEditRoom && (
            <Button size="sm" variant="outline" onClick={() => setRoomConfirm(row)}>
              {row.active ? 'Deactivate' : 'Activate'}
            </Button>
          )}
        </div>
      ),
    },
  ]

  const bedColumns = [
    { key: 'name', header: 'Bed', render: (row) => <span className="font-medium">{row.name || row.label}</span> },
    { key: 'roomName', header: 'Room', render: (row) => row.roomName || '—' },
    { key: 'wardName', header: 'Ward', render: (row) => row.wardName || '—' },
    { key: 'status', header: 'Current status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'patientId', header: 'Occupancy', render: (row) => row.patientId || '—' },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
          {canEditBed && (
            <Button size="sm" variant="ghost" onClick={() => openEditBed(row)}>
              <Pencil className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
          {canEditBed && row.status !== 'available' && row.status !== 'occupied' && (
            <Button size="sm" variant="outline" onClick={() => setBedConfirm({ row, status: 'available' })}>Available</Button>
          )}
          {canEditBed && row.status === 'available' && (
            <Button size="sm" variant="outline" onClick={() => setBedConfirm({ row, status: 'maintenance' })}>Maintenance</Button>
          )}
          {canEditBed && row.status === 'available' && (
            <Button size="sm" variant="outline" onClick={() => setBedConfirm({ row, status: 'out_of_service' })}>Out of service</Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Hospital Setup"
        description="Departments, wards, rooms, and beds. Occupied beds are assigned only through admission."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          {canViewDepartments && <TabsTrigger value="departments">Departments</TabsTrigger>}
          {canViewWards && <TabsTrigger value="wards">Wards</TabsTrigger>}
          {canViewRooms && <TabsTrigger value="rooms">Rooms</TabsTrigger>}
          {canViewBeds && <TabsTrigger value="beds">Beds</TabsTrigger>}
        </TabsList>

        {canViewDepartments && (
          <TabsContent value="departments">
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid gap-3 lg:grid-cols-[1fr_160px_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search departments" value={deptQuery} onChange={(e) => setDeptQuery(e.target.value)} />
                  </div>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={deptStatus} onChange={(e) => setDeptStatus(e.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  {canCreateDepartment && (
                    <Button onClick={openCreateDepartment}><Plus className="h-4 w-4 mr-2" /> Create department</Button>
                  )}
                </div>
              </CardContent>
            </Card>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading departments…</p>
            ) : (
              <DataTable
                columns={departmentColumns}
                data={filteredDepartments}
                onRowClick={canEditDepartment ? openEditDepartment : undefined}
                emptyState={<EmptyState icon={Building2} title="No departments yet" description="Create a department first. Wards are added under a department." />}
              />
            )}
          </TabsContent>
        )}

        {canViewWards && (
          <TabsContent value="wards">
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid gap-3 lg:grid-cols-[1fr_200px_160px_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search wards" value={wardQuery} onChange={(e) => setWardQuery(e.target.value)} />
                  </div>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={wardDeptFilter} onChange={(e) => setWardDeptFilter(e.target.value)}>
                    <option value="all">All departments</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>{dept.name}</option>
                    ))}
                  </select>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={wardStatus} onChange={(e) => setWardStatus(e.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  {canCreateWard && (
                    <Button onClick={openCreateWard} disabled={!activeDepartments.length}>
                      <Plus className="h-4 w-4 mr-2" /> Create ward
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading wards…</p>
            ) : (
              <DataTable
                columns={wardColumns}
                data={filteredWards}
                onRowClick={canEditWard ? openEditWard : undefined}
                emptyState={<EmptyState icon={Building2} title="No wards yet" description="Create a ward and assign it to an active department." />}
              />
            )}
          </TabsContent>
        )}

        {canViewRooms && (
          <TabsContent value="rooms">
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_160px_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search rooms" value={roomQuery} onChange={(e) => setRoomQuery(e.target.value)} />
                  </div>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={roomDeptFilter} onChange={(e) => setRoomDeptFilter(e.target.value)}>
                    <option value="all">All departments</option>
                    {departments.map((dept) => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                  </select>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={roomWardFilter} onChange={(e) => setRoomWardFilter(e.target.value)}>
                    <option value="all">All wards</option>
                    {wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}
                  </select>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={roomStatus} onChange={(e) => setRoomStatus(e.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <div className="flex flex-wrap gap-2">
                    {canCreateRoom && (
                      <Button onClick={openCreateRoom} disabled={!activeWards.length}><Plus className="h-4 w-4 mr-2" /> Create room</Button>
                    )}
                    {canBulkRooms && (
                      <Button variant="outline" onClick={() => setBulkRoomsOpen(true)} disabled={!activeWards.length}>
                        <LayoutGrid className="h-4 w-4 mr-2" /> Bulk create
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            {loading ? <p className="text-sm text-muted-foreground">Loading rooms…</p> : (
              <DataTable
                columns={roomColumns}
                data={filteredRooms}
                onRowClick={canEditRoom ? openEditRoom : undefined}
                emptyState={<EmptyState icon={Building2} title="No rooms yet" description="Create a room under an active ward, then add beds." />}
              />
            )}
          </TabsContent>
        )}

        {canViewBeds && (
          <TabsContent value="beds">
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid gap-3 lg:grid-cols-[1fr_200px_180px_auto]">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Search beds" value={bedQuery} onChange={(e) => setBedQuery(e.target.value)} />
                  </div>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={bedWardFilter} onChange={(e) => setBedWardFilter(e.target.value)}>
                    <option value="all">All wards</option>
                    {wards.map((ward) => <option key={ward.id} value={ward.id}>{ward.name}</option>)}
                  </select>
                  <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={bedStatus} onChange={(e) => setBedStatus(e.target.value)}>
                    <option value="all">All statuses</option>
                    <option value="available">Available</option>
                    <option value="occupied">Occupied</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="out_of_service">Out of service</option>
                  </select>
                  <div className="flex flex-wrap gap-2">
                    {canCreateBed && (
                      <Button onClick={openCreateBed} disabled={!activeRooms.length}><Plus className="h-4 w-4 mr-2" /> Create bed</Button>
                    )}
                    {canBulkBeds && (
                      <Button variant="outline" onClick={() => setBulkBedsOpen(true)} disabled={!activeRooms.length}>
                        <LayoutGrid className="h-4 w-4 mr-2" /> Bulk create
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            {loading ? <p className="text-sm text-muted-foreground">Loading beds…</p> : (
              <DataTable
                columns={bedColumns}
                data={filteredBeds}
                onRowClick={canEditBed ? openEditBed : undefined}
                emptyState={<EmptyState icon={Building2} title="No beds yet" description="Create a bed inside an active room. Occupied status is set by admission." />}
              />
            )}
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={deptOpen} onOpenChange={setDeptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{deptMode === 'create' ? 'Create department' : 'Edit department'}</DialogTitle>
            <DialogDescription>Departments group wards. They are never deleted — only activated or deactivated.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={deptForm.name} onChange={(e) => setDeptForm((p) => ({ ...p, name: e.target.value }))} />
              <FieldError message={deptErrors.name} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={deptForm.description} onChange={(e) => setDeptForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={deptForm.active} onChange={(e) => setDeptForm((p) => ({ ...p, active: e.target.checked }))} />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeptOpen(false)}>Cancel</Button>
            <Button onClick={saveDepartment} disabled={savingDept}>{savingDept ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={wardOpen} onOpenChange={setWardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{wardMode === 'create' ? 'Create ward' : 'Edit ward'}</DialogTitle>
            <DialogDescription>Each ward belongs to one department. Rooms and beds are added on the next tabs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Ward name</Label>
              <Input value={wardForm.name} onChange={(e) => setWardForm((p) => ({ ...p, name: e.target.value }))} />
              <FieldError message={wardErrors.name} />
            </div>
            <div>
              <Label>Department</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={wardForm.departmentId}
                onChange={(e) => setWardForm((p) => ({ ...p, departmentId: e.target.value }))}
              >
                <option value="">Select a department</option>
                {departments.filter((dept) => dept.active || dept.id === wardForm.departmentId).map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}{dept.active ? '' : ' (inactive)'}</option>
                ))}
              </select>
              <FieldError message={wardErrors.departmentId} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={wardForm.description} onChange={(e) => setWardForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={wardForm.active} onChange={(e) => setWardForm((p) => ({ ...p, active: e.target.checked }))} />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWardOpen(false)}>Cancel</Button>
            <Button onClick={saveWard} disabled={savingWard}>{savingWard ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deptConfirm} onOpenChange={() => setDeptConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deptConfirm?.active ? 'Deactivate this department?' : 'Activate this department?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {deptConfirm?.active
                ? 'The department stays in the system. Existing wards are not deleted. New wards cannot be added until it is active again.'
                : 'Staff will be able to add wards to this department again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleDepartment(deptConfirm)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!wardConfirm} onOpenChange={() => setWardConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{wardConfirm?.active ? 'Deactivate this ward?' : 'Activate this ward?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {wardConfirm?.active
                ? 'The ward is kept for history. It is not deleted.'
                : 'This ward will be available for use again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleWard(wardConfirm)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={roomOpen} onOpenChange={setRoomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{roomMode === 'create' ? 'Create room' : 'Edit room'}</DialogTitle>
            <DialogDescription>A room belongs to one ward. Beds are added separately and are not deleted when a room is deactivated.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Room number</Label>
              <Input value={roomForm.name} onChange={(e) => setRoomForm((p) => ({ ...p, name: e.target.value }))} />
              <FieldError message={roomErrors.name} />
            </div>
            <div>
              <Label>Ward</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={roomForm.wardId} onChange={(e) => setRoomForm((p) => ({ ...p, wardId: e.target.value }))}>
                <option value="">Select a ward</option>
                {wards.filter((ward) => ward.active || ward.id === roomForm.wardId).map((ward) => (
                  <option key={ward.id} value={ward.id}>{ward.name} — {ward.departmentName}</option>
                ))}
              </select>
              <FieldError message={roomErrors.wardId} />
            </div>
            <div>
              <Label>Room type</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={roomForm.roomType} onChange={(e) => setRoomForm((p) => ({ ...p, roomType: e.target.value }))}>
                {ROOM_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </div>
            <div>
              <Label>Capacity</Label>
              <Input type="number" min="1" max="40" value={roomForm.capacity} onChange={(e) => setRoomForm((p) => ({ ...p, capacity: e.target.value }))} />
              <FieldError message={roomErrors.capacity} />
            </div>
            <div>
              <Label>Daily rate (optional)</Label>
              <Input type="number" min="0" value={roomForm.dailyRate} onChange={(e) => setRoomForm((p) => ({ ...p, dailyRate: e.target.value }))} placeholder="Uses the room-type default if empty" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={roomForm.active} onChange={(e) => setRoomForm((p) => ({ ...p, active: e.target.checked }))} />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomOpen(false)}>Cancel</Button>
            <Button onClick={saveRoom} disabled={savingRoom}>{savingRoom ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bedOpen} onOpenChange={setBedOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bedMode === 'create' ? 'Create bed' : 'Edit bed'}</DialogTitle>
            <DialogDescription>A bed belongs to one room. Occupied status is set only when a patient is admitted.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Bed identifier</Label>
              <Input value={bedForm.name} onChange={(e) => setBedForm((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. A or 01" />
              <FieldError message={bedErrors.name} />
            </div>
            <div>
              <Label>Room</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={bedForm.roomId} onChange={(e) => setBedForm((p) => ({ ...p, roomId: e.target.value }))}>
                <option value="">Select a room</option>
                {rooms.filter((room) => room.active || room.id === bedForm.roomId).map((room) => (
                  <option key={room.id} value={room.id}>{room.name} — {room.wardName}</option>
                ))}
              </select>
              <FieldError message={bedErrors.roomId} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBedOpen(false)}>Cancel</Button>
            <Button onClick={saveBed} disabled={savingBed}>{savingBed ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!roomConfirm} onOpenChange={() => setRoomConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{roomConfirm?.active ? 'Deactivate this room?' : 'Activate this room?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {roomConfirm?.active
                ? 'The room stays in the system. Existing beds are not deleted. New beds cannot be added until it is active again.'
                : 'Beds can be added to this room again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toggleRoom(roomConfirm)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkLayoutDialog
        open={bulkRoomsOpen}
        onOpenChange={setBulkRoomsOpen}
        mode="rooms"
        wards={wards}
        rooms={rooms}
        onCreated={load}
      />
      <BulkLayoutDialog
        open={bulkBedsOpen}
        onOpenChange={setBulkBedsOpen}
        mode="beds"
        wards={wards}
        rooms={rooms}
        onCreated={load}
      />

      <AlertDialog open={!!bedConfirm} onOpenChange={() => setBedConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change this bed to {bedConfirm?.status?.replace('_', ' ')}?</AlertDialogTitle>
            <AlertDialogDescription>
              Occupied beds cannot be changed here. Historical admissions stay linked to the bed record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => changeBedStatus(bedConfirm.row, bedConfirm.status)}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
