import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { StatusBadge, PageHeader, DataTable } from '@/components/shared/CommonComponents'
import { services as initialServices } from '@/data/mockData'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'

export default function ServicesPage() {
  const { toast } = useToast()
  const [services, setServices] = useState(initialServices)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', department: '', price: '', status: 'active' })

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', department: '', price: '', status: 'active' })
    setDialogOpen(true)
  }

  const openEdit = (service) => {
    setEditing(service)
    setForm({ name: service.name, department: service.department, price: service.price, status: service.status })
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.name || !form.department || !form.price) {
      toast({ title: 'Error', description: 'Fill all required fields', variant: 'destructive' })
      return
    }
    if (editing) {
      setServices((prev) => prev.map((s) => s.id === editing.id ? { ...s, ...form, price: Number(form.price) } : s))
      toast({ title: 'Updated', description: 'Service updated successfully', variant: 'success' })
    } else {
      setServices((prev) => [...prev, { id: Date.now(), ...form, price: Number(form.price) }])
      toast({ title: 'Added', description: 'New service added', variant: 'success' })
    }
    setDialogOpen(false)
  }

  const handleDelete = () => {
    setServices((prev) => prev.filter((s) => s.id !== deleteId))
    setDeleteId(null)
    toast({ title: 'Deleted', description: 'Service removed', variant: 'success' })
  }

  const columns = [
    { key: 'name', header: 'Service Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'department', header: 'Department' },
    { key: 'price', header: 'Price', render: (row) => formatCurrency(row.price) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Services"
        description="Manage hospital services and pricing"
        action={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Service</Button>}
      />
      <DataTable columns={columns} data={services} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Service' : 'Add Service'}</DialogTitle>
            <DialogDescription>Configure service details and pricing</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Service Name</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Department</Label><Input value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} /></div>
            <div><Label>Price (ETB)</Label><Input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} /></div>
            <div>
              <Label>Status</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
