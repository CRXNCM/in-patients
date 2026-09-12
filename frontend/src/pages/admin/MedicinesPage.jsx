import { useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { StatusBadge, PageHeader, DataTable } from '@/components/shared/CommonComponents'
import { medicines as initialMedicines } from '@/data/mockData'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'

export default function MedicinesPage() {
  const { toast } = useToast()
  const [medicines, setMedicines] = useState(initialMedicines)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', unit: 'Tablet', price: '', stockStatus: 'in-stock' })

  const openAdd = () => {
    setEditing(null)
    setForm({ name: '', unit: 'Tablet', price: '', stockStatus: 'in-stock' })
    setDialogOpen(true)
  }

  const openEdit = (med) => {
    setEditing(med)
    setForm({ name: med.name, unit: med.unit, price: med.price, stockStatus: med.stockStatus })
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.name || !form.price) {
      toast({ title: 'Error', description: 'Fill all required fields', variant: 'destructive' })
      return
    }
    if (editing) {
      setMedicines((prev) => prev.map((m) => m.id === editing.id ? { ...m, ...form, price: Number(form.price) } : m))
      toast({ title: 'Updated', description: 'Medicine updated', variant: 'success' })
    } else {
      setMedicines((prev) => [...prev, { id: Date.now(), ...form, price: Number(form.price) }])
      toast({ title: 'Added', description: 'New medicine added', variant: 'success' })
    }
    setDialogOpen(false)
  }

  const columns = [
    { key: 'name', header: 'Medicine Name', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'unit', header: 'Unit' },
    { key: 'price', header: 'Price', render: (row) => formatCurrency(row.price) },
    { key: 'stockStatus', header: 'Stock Status', render: (row) => <StatusBadge status={row.stockStatus} /> },
    {
      key: 'actions', header: 'Actions',
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
      <PageHeader title="Medicines" description="Manage pharmacy inventory and pricing" action={<Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" /> Add Medicine</Button>} />
      <DataTable columns={columns} data={medicines} />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Medicine' : 'Add Medicine'}</DialogTitle>
            <DialogDescription>Configure medicine details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div><Label>Medicine Name</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} /></div>
            <div><Label>Price (ETB)</Label><Input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} /></div>
            <div>
              <Label>Stock Status</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.stockStatus} onChange={(e) => setForm((p) => ({ ...p, stockStatus: e.target.value }))}>
                <option value="in-stock">In Stock</option>
                <option value="low-stock">Low Stock</option>
                <option value="out-of-stock">Out of Stock</option>
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
          <AlertDialogHeader><AlertDialogTitle>Delete Medicine?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { setMedicines((p) => p.filter((m) => m.id !== deleteId)); setDeleteId(null); toast({ title: 'Deleted', variant: 'success' }) }}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
