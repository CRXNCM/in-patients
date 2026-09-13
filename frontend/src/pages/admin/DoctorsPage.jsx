import { useEffect, useState } from 'react'
import { PageHeader, DataTable, StatusBadge } from '@/components/shared/CommonComponents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { doctors as mockDoctors } from '@/data/mockData'
import { api, USE_API } from '@/api/client'
import { DOCTOR_SPECIALTIES } from '@/lib/doctors'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'

const emptyForm = {
  name: '',
  specialty: 'General Practitioner',
  visitPrice: '',
  phone: '',
  department: '',
  active: true,
}

export default function DoctorsPage() {
  const { toast } = useToast()
  const { hasPermission, hasAnyPermission } = useAuth()
  const canManage = hasAnyPermission(['doctors.manage', 'doctors.manage_pricing'])
  const canCreate = hasPermission('doctors.manage')
  const [rows, setRows] = useState(() => (USE_API ? [] : mockDoctors))
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!USE_API) return
    const data = await api.getDoctors()
    setRows(data)
  }

  useEffect(() => {
    load().catch((err) => toast({ title: 'Failed to load doctors', description: err.message, variant: 'destructive' }))
  }, [])

  const startCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const startEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name,
      specialty: row.specialty,
      visitPrice: String(row.visitPrice ?? ''),
      phone: row.phone || '',
      department: row.department || '',
      active: row.active !== false && row.status !== 'inactive',
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.name.trim() || form.visitPrice === '' || Number(form.visitPrice) < 0) {
      toast({ title: 'Name and a non-negative visit price are required.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        specialty: form.specialty,
        visitPrice: Number(form.visitPrice),
        phone: form.phone,
        department: form.department,
        active: form.active,
      }
      if (USE_API) {
        if (editing) await api.updateDoctor(editing.id, body)
        else await api.createDoctor(body)
        await load()
      } else {
        if (editing) {
          setRows((prev) => prev.map((row) => (row.id === editing.id ? { ...row, ...body, status: body.active ? 'active' : 'inactive' } : row)))
        } else {
          setRows((prev) => [...prev, { id: Date.now(), ...body, status: body.active ? 'active' : 'inactive' }])
        }
      }
      setOpen(false)
      toast({ title: editing ? 'Doctor updated' : 'Doctor added', variant: 'success' })
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row) => {
    const nextActive = !(row.active !== false && row.status !== 'inactive')
    try {
      if (USE_API) {
        await api.updateDoctor(row.id, { active: nextActive })
        await load()
      } else {
        setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, active: nextActive, status: nextActive ? 'active' : 'inactive' } : item)))
      }
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' })
    }
  }

  const columns = [
    { key: 'name', header: 'Doctor Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'specialty', header: 'Specialty' },
    { key: 'visitPrice', header: 'Visit price', render: (row) => formatCurrency(row.visitPrice || 0) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.active === false || row.status === 'inactive' ? 'inactive' : 'active'} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        canManage ? (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => startEdit(row)}>Edit</Button>
            <Button size="sm" variant="outline" onClick={() => toggleActive(row)}>
              {row.active === false || row.status === 'inactive' ? 'Activate' : 'Deactivate'}
            </Button>
          </div>
        ) : null
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Doctors"
        description="Catalog of visiting doctors and daily visit prices. Historical patient charges keep the price that applied at assignment time."
        action={canCreate ? <Button onClick={startCreate}>Add doctor</Button> : null}
      />
      <DataTable columns={columns} data={rows} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit doctor' : 'Add doctor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Full name</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>Specialty</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.specialty}
                onChange={(e) => setForm((p) => ({ ...p, specialty: e.target.value }))}
              >
                {DOCTOR_SPECIALTIES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>Daily visit price (ETB)</Label>
              <Input type="number" min="0" step="0.01" value={form.visitPrice} onChange={(e) => setForm((p) => ({ ...p, visitPrice: e.target.value }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
