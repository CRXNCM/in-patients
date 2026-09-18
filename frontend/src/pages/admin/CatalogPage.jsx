import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Pencil, Plus } from 'lucide-react'
import { PageHeader, DataTable, EmptyState, StatusBadge } from '@/components/shared/CommonComponents'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { api, USE_API } from '@/api/client'
import { formatCurrency } from '@/lib/utils'
import { useToast } from '@/context/ToastContext'
import { useAuth } from '@/context/AuthContext'
import { useBillingConfig } from '@/context/BillingConfigContext'
import { MotionPage } from '@/lib/motion'

const CATALOG_CATEGORIES = [
  { slug: 'consumables', name: 'Consumables' },
  { slug: 'laboratory', name: 'Laboratory' },
  { slug: 'medical-supplies', name: 'Medical Supplies' },
  { slug: 'pharmacy', name: 'Pharmacy' },
  { slug: 'procedures', name: 'Procedures' },
  { slug: 'radiology', name: 'Radiology' },
]

const emptyForm = { name: '', unit: '', price: '', active: true }
const selectClass = 'h-9 rounded-md border bg-background px-3 text-sm shadow-sm'

function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-destructive">{message}</p>
}

function validateForm(form) {
  const errors = {}
  if (!String(form.name || '').trim()) errors.name = 'Item name is required.'
  if (form.price === '' || form.price === null || form.price === undefined) {
    errors.price = 'Price is required.'
  } else if (!Number.isFinite(Number(form.price)) || Number(form.price) < 0) {
    errors.price = 'Price must be 0 or more.'
  }
  return errors
}

export default function CatalogPage() {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const { refreshCategories } = useBillingConfig()
  const canModify = hasPermission('system.modify_settings')

  const [slug, setSlug] = useState(CATALOG_CATEGORIES[0].slug)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

  const category = CATALOG_CATEGORIES.find((c) => c.slug === slug) || CATALOG_CATEGORIES[0]

  const load = useCallback(async (nextSlug = slug) => {
    if (!USE_API) {
      setItems([])
      setError('Catalog management requires the live API.')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await api.getCategoryServices(nextSlug)
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      setItems([])
      setError(err.message || 'Failed to load catalog items.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    load(slug)
  }, [slug, load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      const active = item.active !== false
      if (statusFilter === 'active' && !active) return false
      if (statusFilter === 'inactive' && active) return false
      if (!q) return true
      return String(item.name || '').toLowerCase().includes(q) || String(item.unit || '').toLowerCase().includes(q)
    })
  }, [items, query, statusFilter])

  const openAdd = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormErrors({})
    setDialogOpen(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({
      name: item.name || '',
      unit: item.unit || '',
      price: item.price === 0 || item.price ? String(item.price) : '',
      active: item.active !== false,
    })
    setFormErrors({})
    setDialogOpen(true)
  }

  const handleSave = async (event) => {
    event?.preventDefault()
    const errors = validateForm(form)
    setFormErrors(errors)
    if (Object.keys(errors).length) return

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        unit: String(form.unit || '').trim(),
        price: Number(form.price),
      }
      if (editing) {
        payload.active = form.active
        await api.updateCategoryService(slug, editing.id, payload)
      } else {
        await api.createCategoryService(slug, payload)
      }
      setDialogOpen(false)
      toast({
        title: editing ? 'Item updated' : 'Item added',
        description: `${payload.name} saved in ${category.name}.`,
        variant: 'success',
      })
      await load(slug)
      refreshCategories?.()
    } catch (err) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (item) => {
    const nextActive = item.active === false
    setTogglingId(item.id)
    try {
      await api.updateCategoryService(slug, item.id, { active: nextActive })
      toast({
        title: nextActive ? 'Item activated' : 'Item deactivated',
        description: item.name,
        variant: 'success',
      })
      await load(slug)
      refreshCategories?.()
    } catch (err) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' })
    } finally {
      setTogglingId(null)
    }
  }

  const columns = [
    { key: 'name', header: 'Item', render: (row) => <span className="font-medium">{row.name}</span> },
    { key: 'unit', header: 'Unit', render: (row) => row.unit || '—' },
    { key: 'price', header: 'Price', render: (row) => <span className="tabular-nums">{formatCurrency(row.price)}</span> },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.active === false ? 'inactive' : 'active'} />,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        canModify ? (
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" size="sm" onClick={() => openEdit(row)}>
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={togglingId === row.id}
              onClick={() => toggleActive(row)}
            >
              {row.active === false ? 'Activate' : 'Deactivate'}
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">View only</span>
        )
      ),
    },
  ]

  const emptyDescription = items.length === 0
    ? 'Add your first item to this category.'
    : 'Try a different search or status filter.'

  return (
    <MotionPage>
      <PageHeader
        title="Catalog"
        description="Manage live prices for consumables, laboratory, medical supplies, pharmacy, procedures, and radiology."
        action={
          canModify ? (
            <Button onClick={openAdd} disabled={loading || Boolean(error)}>
              <Plus className="h-4 w-4 mr-2" /> Add Item
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {CATALOG_CATEGORIES.map((cat) => (
          <Button
            key={cat.slug}
            type="button"
            size="sm"
            variant={cat.slug === slug ? 'default' : 'outline'}
            onClick={() => {
              setSlug(cat.slug)
              setQuery('')
            }}
          >
            {cat.name}
          </Button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${category.name.toLowerCase()} items...`}
          className="sm:max-w-xs"
        />
        <select
          className={selectClass}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Status filter"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <Card>
        {loading ? (
          <CardContent className="p-0">
            <LoadingState message={`Loading ${category.name.toLowerCase()} items…`} />
          </CardContent>
        ) : error ? (
          <CardContent className="p-6">
            <ErrorState title={`${category.name} could not be loaded.`} message={error} onRetry={() => load(slug)} />
          </CardContent>
        ) : (
          <DataTable
            columns={columns}
            data={filtered}
            emptyState={
              <EmptyState
                icon={ClipboardList}
                title={items.length === 0 ? 'No catalog items yet.' : 'No matching items'}
                description={emptyDescription}
                action={
                  canModify && items.length === 0 ? (
                    <Button onClick={openAdd}>
                      <Plus className="h-4 w-4 mr-2" /> Add Item
                    </Button>
                  ) : null
                }
              />
            }
          />
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit item' : 'Add item'}</DialogTitle>
              <DialogDescription>
                {editing ? `Update this ${category.name.toLowerCase()} item.` : `Add an item to ${category.name}.`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="catalog-name">Item Name *</Label>
                <Input
                  id="catalog-name"
                  className="mt-1"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  autoFocus
                />
                <FieldError message={formErrors.name} />
              </div>
              <div>
                <Label htmlFor="catalog-unit">Unit</Label>
                <Input
                  id="catalog-unit"
                  className="mt-1"
                  value={form.unit}
                  onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label htmlFor="catalog-price">Price *</Label>
                <Input
                  id="catalog-price"
                  className="mt-1 tabular-nums"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
                />
                <FieldError message={formErrors.price} />
              </div>
              {editing ? (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={form.active}
                    onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                  />
                  Active
                </label>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MotionPage>
  )
}
