import { useEffect, useMemo, useState } from 'react'
import { PageHeader, DataTable, StatusBadge, EmptyState } from '@/components/shared/CommonComponents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SearchInput } from '@/components/ui/search-input'
import { Card, CardContent } from '@/components/ui/card'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { api, USE_API } from '@/api/client'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { Building2 } from 'lucide-react'

const emptyForm = {
  name: '',
  code: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  active: true,
}

export default function CreditCompaniesPage() {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const canManage = hasPermission('credit.manage_companies')
  const [rows, setRows] = useState([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(USE_API)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    if (!USE_API) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await api.listCreditCompanies()
      setRows(data.companies || [])
    } catch (err) {
      setError(err.message)
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const visible = useMemo(() => {
    const search = q.trim().toLowerCase()
    if (!search) return rows
    return rows.filter((row) =>
      [row.name, row.code].some((value) => String(value || '').toLowerCase().includes(search))
    )
  }, [rows, q])

  const startCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const startEdit = (row) => {
    setEditing(row)
    setForm({
      name: row.name || '',
      code: row.code || '',
      contactPerson: row.contactPerson || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      notes: row.notes || '',
      active: row.active !== false,
    })
    setOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Company name is required.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim(),
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
        active: form.active,
      }
      if (editing) await api.updateCreditCompany(editing.id, body)
      else await api.createCreditCompany(body)
      await load()
      setOpen(false)
      toast({ title: editing ? 'Credit company updated' : 'Credit company added', variant: 'success' })
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (row) => {
    try {
      await api.updateCreditCompany(row.id, { active: row.active === false })
      await load()
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' })
    }
  }

  const columns = [
    { key: 'name', header: 'Company', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'code', header: 'Code', render: (row) => row.code || '—' },
    { key: 'contactPerson', header: 'Contact', render: (row) => row.contactPerson || '—' },
    { key: 'phone', header: 'Phone', render: (row) => row.phone || '—' },
    {
      key: 'admissionCount',
      header: 'Credit admissions',
      render: (row) => <span className="tabular-nums">{row.admissionCount || 0}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.active === false ? 'inactive' : 'active'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => startEdit(row)}>Edit</Button>
            <Button size="sm" variant="outline" onClick={() => toggleActive(row)}>
              {row.active === false ? 'Activate' : 'Deactivate'}
            </Button>
          </div>
        ) : null
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Credit Companies"
        description="Companies that can be billed for credit-patient admissions. Deactivated companies stay on historical records."
        action={canManage ? <Button onClick={startCreate}>Add Credit Company</Button> : null}
      />

      <div className="mb-4 max-w-sm">
        <SearchInput
          label="Search companies"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search by name or code"
        />
      </div>

      {loading && (
        <Card>
          <CardContent className="p-0">
            <LoadingState message="Loading credit companies…" />
          </CardContent>
        </Card>
      )}

      {!loading && error && (
        <Card>
          <CardContent className="p-6">
            <ErrorState title="Credit companies could not be loaded." message={error} onRetry={load} />
          </CardContent>
        </Card>
      )}

      {!loading && !error && visible.length === 0 && (
        <Card>
          <EmptyState
            icon={Building2}
            title={q.trim() ? 'No matching companies' : 'No credit companies'}
            description={q.trim() ? 'Try a different name or code.' : 'Add a company before admitting a credit patient.'}
          />
        </Card>
      )}

      {!loading && !error && visible.length > 0 && <DataTable columns={columns} data={visible} />}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit credit company' : 'Add credit company'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Company name *</Label>
              <Input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div>
              <Label>Company code</Label>
              <Input value={form.code} onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))} />
            </div>
            <div>
              <Label>Contact person</Label>
              <Input value={form.contactPerson} onChange={(event) => setForm((prev) => ({ ...prev, contactPerson: event.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))} />
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))} />
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
