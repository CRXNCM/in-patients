import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, FolderPlus, Pencil, Plus, Upload } from 'lucide-react'
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
import { CATALOG_CATEGORIES, manualCatalogTabs, slugifyCategoryName } from '@/lib/catalogCategories'
import { CatalogImportDialog } from '@/components/admin/CatalogImportDialog'

const emptyForm = { name: '', subcategory: '', unit: '', price: '', active: true }
const emptyCategoryForm = { name: '', slug: '', billingType: 'quantity', description: '' }
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

function validateCategoryForm(form, existingTabs = []) {
  const errors = {}
  const name = String(form.name || '').trim()
  const slug = slugifyCategoryName(form.slug || form.name)
  if (!name) errors.name = 'Category name is required.'
  if (!slug) errors.slug = 'Slug must use letters or numbers.'
  if (existingTabs.some((tab) => tab.slug === slug)) errors.slug = 'This slug is already used.'
  if (existingTabs.some((tab) => tab.name.toLowerCase() === name.toLowerCase())) {
    errors.name = 'This category name already exists.'
  }
  return errors
}

export default function CatalogPage() {
  const { toast } = useToast()
  const { hasPermission } = useAuth()
  const { categories, refreshCategories } = useBillingConfig()
  const canModify = hasPermission('system.modify_settings')
  const tabs = useMemo(() => {
    const live = manualCatalogTabs(categories)
    return live.length ? live : CATALOG_CATEGORIES
  }, [categories])

  const [slug, setSlug] = useState(CATALOG_CATEGORIES[0].slug)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')

  const [importOpen, setImportOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [categoryForm, setCategoryForm] = useState(emptyCategoryForm)
  const [categoryErrors, setCategoryErrors] = useState({})
  const [categorySaving, setCategorySaving] = useState(false)
  const [slugTouched, setSlugTouched] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [formErrors, setFormErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState(null)

  const category = tabs.find((c) => c.slug === slug) || tabs[0] || CATALOG_CATEGORIES[0]

  useEffect(() => {
    if (!tabs.length) return
    if (!tabs.some((tab) => tab.slug === slug)) setSlug(tabs[0].slug)
  }, [tabs, slug])

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
      return (
        String(item.name || '').toLowerCase().includes(q)
        || String(item.subcategory || '').toLowerCase().includes(q)
        || String(item.unit || '').toLowerCase().includes(q)
      )
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
      subcategory: item.subcategory || '',
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
        subcategory: String(form.subcategory || '').trim(),
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
    { key: 'subcategory', header: 'Subcategory', render: (row) => row.subcategory || '—' },
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
        description="Manage service categories and live prices. Room and doctor fees stay on beds and doctors."
        action={
          canModify ? (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setCategoryForm(emptyCategoryForm)
                  setCategoryErrors({})
                  setSlugTouched(false)
                  setCategoryDialogOpen(true)
                }}
              >
                <FolderPlus className="h-4 w-4 mr-2" /> Add Category
              </Button>
              <Button variant="outline" onClick={() => setImportOpen(true)} disabled={Boolean(error)}>
                <Upload className="h-4 w-4 mr-2" /> Import Excel
              </Button>
              <Button onClick={openAdd} disabled={loading || Boolean(error) || !category}>
                <Plus className="h-4 w-4 mr-2" /> Add Item
              </Button>
            </div>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((cat) => (
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

      <CatalogImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        categories={tabs}
        onImported={async () => {
          await load(slug)
          refreshCategories?.()
        }}
      />

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              const errors = validateCategoryForm(categoryForm, tabs)
              setCategoryErrors(errors)
              if (Object.keys(errors).length) return
              setCategorySaving(true)
              try {
                const created = await api.createCategory({
                  name: categoryForm.name.trim(),
                  slug: categoryForm.slug.trim() || slugifyCategoryName(categoryForm.name),
                  billingType: categoryForm.billingType,
                  description: categoryForm.description.trim(),
                })
                await refreshCategories?.()
                setSlug(created.id)
                setQuery('')
                setCategoryDialogOpen(false)
                toast({
                  title: 'Category added',
                  description: `${created.name} is ready. Add items or import Excel into it.`,
                  variant: 'success',
                })
              } catch (err) {
                toast({ title: 'Could not add category', description: err.message, variant: 'destructive' })
              } finally {
                setCategorySaving(false)
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Add category</DialogTitle>
              <DialogDescription>
                Create a billing group first, then add items or import Excel. Room and doctor stay automatic.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="category-name">Name *</Label>
                <Input
                  id="category-name"
                  className="mt-1"
                  value={categoryForm.name}
                  onChange={(e) => {
                    const name = e.target.value
                    setCategoryForm((prev) => ({
                      ...prev,
                      name,
                      slug: slugTouched ? prev.slug : slugifyCategoryName(name),
                    }))
                  }}
                  placeholder="Physiotherapy"
                  autoFocus
                />
                <FieldError message={categoryErrors.name} />
              </div>
              <div>
                <Label htmlFor="category-slug">Excel / slug</Label>
                <Input
                  id="category-slug"
                  className="mt-1"
                  value={categoryForm.slug}
                  onChange={(e) => {
                    setSlugTouched(true)
                    setCategoryForm((prev) => ({ ...prev, slug: slugifyCategoryName(e.target.value) }))
                  }}
                  placeholder="physiotherapy"
                />
                <p className="mt-1 text-xs text-muted-foreground">Used in Excel. Letters, numbers, and hyphens only.</p>
                <FieldError message={categoryErrors.slug} />
              </div>
              <div>
                <Label htmlFor="category-billing">Billing type *</Label>
                <select
                  id="category-billing"
                  className={`${selectClass} mt-1 w-full`}
                  value={categoryForm.billingType}
                  onChange={(e) => setCategoryForm((prev) => ({ ...prev, billingType: e.target.value }))}
                >
                  <option value="quantity">Quantity — count × price</option>
                  <option value="selection">Selection — pick one item</option>
                </select>
              </div>
              <div>
                <Label htmlFor="category-description">Description</Label>
                <Input
                  id="category-description"
                  className="mt-1"
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)} disabled={categorySaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={categorySaving}>
                {categorySaving ? 'Saving…' : 'Create category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                <Label htmlFor="catalog-subcategory">Subcategory</Label>
                <Input
                  id="catalog-subcategory"
                  className="mt-1"
                  value={form.subcategory}
                  onChange={(e) => setForm((p) => ({ ...p, subcategory: e.target.value }))}
                  placeholder="Optional, e.g. Hematology"
                />
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
