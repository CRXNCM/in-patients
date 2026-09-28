import { useEffect, useState } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/api/client'
import { useToast } from '@/context/ToastContext'
import { formatCurrency } from '@/lib/utils'
import { downloadCatalogImportErrors, downloadCatalogTemplate, parseCatalogUpload } from '@/lib/catalogImportFile'

function FieldError({ message }) {
  if (!message) return null
  return <p className="text-xs text-destructive mt-1">{message}</p>
}

function actionClass(action) {
  if (action === 'add') return 'text-emerald-700 dark:text-emerald-400'
  if (action === 'skip') return 'text-amber-700 dark:text-amber-400'
  return 'text-destructive'
}

export function CatalogImportDialog({ open, onOpenChange, onImported, categories = [] }) {
  const { toast } = useToast()
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])
  const [parseError, setParseError] = useState('')
  const [preview, setPreview] = useState(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) return
    setFileName('')
    setRows([])
    setParseError('')
    setPreview(null)
    setFilter('all')
  }, [open])

  const resetPreview = () => {
    setPreview(null)
    setFilter('all')
  }

  const handleFile = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setFileName(file.name)
    setLoading(true)
    resetPreview()
    try {
      const parsed = await parseCatalogUpload(file, categories)
      if (parsed.error) {
        setRows([])
        setParseError(parsed.error)
        return
      }
      setRows(parsed.rows)
      setParseError('')
    } catch (err) {
      setRows([])
      setParseError(err.message || 'The file could not be read.')
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async () => {
    if (!rows.length) {
      setParseError('Choose an Excel or CSV file first.')
      return
    }
    setLoading(true)
    try {
      const result = await api.previewCatalogImport({ rows })
      setPreview(result)
      setFilter('all')
    } catch (err) {
      setPreview(null)
      toast({ title: 'Preview failed', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!preview?.counts?.add) {
      toast({ title: 'Nothing to import', description: 'Preview the file first. Only new items are added.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const result = await api.applyCatalogImport({ rows })
      toast({
        title: 'Catalog imported',
        description: `Added ${result.added} item(s). ${result.counts.skip} skipped, ${result.counts.error} error(s).`,
        variant: 'success',
      })
      onOpenChange(false)
      onImported?.()
    } catch (err) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const visibleRows = (preview?.rows || []).filter((row) => filter === 'all' || row.action === filter)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import catalog from Excel</DialogTitle>
          <DialogDescription>
            Use category, subcategory, name, unit, and price. Subcategory is optional. Existing items are skipped
            and keep their current price. Room and doctor fees are not imported.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Label htmlFor="catalog-import-file">Excel or CSV file</Label>
            <input
              id="catalog-import-file"
              type="file"
              accept=".xlsx,.xls,.csv,text/csv"
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-foreground"
              onChange={handleFile}
              disabled={loading || saving}
            />
            <FieldError message={parseError} />
            {fileName && !parseError ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {fileName} · {rows.length} row{rows.length === 1 ? '' : 's'} ready
              </p>
            ) : null}
          </div>
          <Button type="button" variant="outline" onClick={() => downloadCatalogTemplate(categories)} disabled={loading || saving}>
            <Download className="h-4 w-4 mr-2" /> Download template
          </Button>
        </div>

        {preview ? (
          <div className="space-y-3 rounded-md border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                Preview: {preview.counts.add} add · {preview.counts.skip} skip · {preview.counts.error} error
              </p>
              <div className="flex flex-wrap gap-1">
                {['all', 'add', 'skip', 'error'].map((key) => (
                  <Button key={key} type="button" size="sm" variant={filter === key ? 'default' : 'outline'} onClick={() => setFilter(key)}>
                    {key === 'all' ? 'All' : key[0].toUpperCase() + key.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            {preview.counts.error > 0 ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => downloadCatalogImportErrors(preview.rows)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Download errors
              </Button>
            ) : null}
            <div className="max-h-64 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80">
                  <tr className="text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Subcategory</th>
                    <th className="px-3 py-2 font-medium">Item</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={`${row.sheet}-${row.rowNumber}-${row.name}`} className="border-t">
                      <td className="px-3 py-2 tabular-nums">{row.rowNumber}</td>
                      <td className={`px-3 py-2 capitalize ${actionClass(row.action)}`}>{row.action}</td>
                      <td className="px-3 py-2">{row.categoryName || '—'}</td>
                      <td className="px-3 py-2">{row.subcategory || '—'}</td>
                      <td className="px-3 py-2">{row.name || '—'}</td>
                      <td className="px-3 py-2 tabular-nums">
                        {row.action === 'skip' && row.existingPrice != null
                          ? formatCurrency(row.existingPrice)
                          : row.price == null
                            ? '—'
                            : formatCurrency(row.price)}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={handlePreview} disabled={loading || saving || !rows.length}>
            {loading ? 'Previewing…' : 'Preview'}
          </Button>
          <Button type="button" onClick={handleImport} disabled={!preview?.counts?.add || saving}>
            <Upload className="h-4 w-4 mr-2" />
            {saving ? 'Importing…' : `Import ${preview?.counts?.add || 0} item${preview?.counts?.add === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
