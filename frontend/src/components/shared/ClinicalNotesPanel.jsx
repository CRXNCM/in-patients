import { useCallback, useEffect, useState } from 'react'
import { ClipboardList, Plus } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/shared/CommonComponents'
import { LoadingState } from '@/components/shared/LoadingState'
import { ErrorState } from '@/components/shared/ErrorState'
import { api } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { formatDateTime } from '@/lib/utils'

const NOTE_MAX_LENGTH = 4000

function SectionHead({ title, description, action, kicker }) {
  return (
    <div className="flex flex-col gap-3 border-b px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {kicker ? <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{kicker}</p> : null}
        <h2 className="mt-1 flex items-center gap-2 text-base font-semibold">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="flex flex-wrap gap-2">{action}</div> : null}
    </div>
  )
}

export function ClinicalNotesPanel({ patientId, admissionId, discharged, className }) {
  const { user, hasPermission } = useAuth()
  const { toast } = useToast()
  const [resolvedAdmissionId, setResolvedAdmissionId] = useState(admissionId || null)
  const [resolvingStay, setResolvingStay] = useState(!admissionId)
  const [payload, setPayload] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  const canView = hasPermission('clinicalNotes.view')
  const nurseFacing = user?.roleKey === 'nurse'
  const heading = nurseFacing ? 'Nurse Notes' : 'Clinical Notes'
  const readOnly = Boolean(discharged || payload?.readOnly)
  const canCreate = Boolean(payload?.canCreate) && !readOnly
  const notes = payload?.notes || []

  const reload = useCallback(() => setReloadToken((n) => n + 1), [])

  useEffect(() => {
    setResolvedAdmissionId(admissionId || null)
    setResolvingStay(!admissionId)
  }, [admissionId])

  useEffect(() => {
    if (admissionId || !canView || !patientId) {
      if (admissionId) setResolvingStay(false)
      return undefined
    }
    let cancelled = false
    setResolvingStay(true)
    api
      .getPatientProfile(patientId)
      .then((data) => {
        if (cancelled) return
        setResolvedAdmissionId(data.admission?.id || data.patient?.admissionId || null)
      })
      .catch(() => {
        if (!cancelled) setResolvedAdmissionId(null)
      })
      .finally(() => {
        if (!cancelled) setResolvingStay(false)
      })
    return () => {
      cancelled = true
    }
  }, [admissionId, canView, patientId])

  useEffect(() => {
    if (!canView || !patientId || !resolvedAdmissionId) {
      setLoading(false)
      return undefined
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getClinicalNotes(patientId, resolvedAdmissionId)
      .then((data) => {
        if (cancelled) return
        setPayload(data)
        setError(null)
      })
      .catch((err) => {
        if (cancelled) return
        setPayload(null)
        setError(err.message || 'Unable to load clinical notes.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canView, patientId, reloadToken, resolvedAdmissionId])

  if (!canView) return null

  if (!resolvedAdmissionId && !resolvingStay && !loading) {
    return (
      <Card id="clinical-notes" className={className}>
        <SectionHead kicker="Clinical documentation" title={heading} />
        <CardContent className="p-6">
          <ErrorState title="Unable to load clinical notes." message="This stay could not be identified." />
        </CardContent>
      </Card>
    )
  }

  const openCreate = () => {
    setEditing(null)
    setDraft('')
    setDialogOpen(true)
  }

  const openEdit = (note) => {
    setEditing(note)
    setDraft(note.note)
    setDialogOpen(true)
  }

  const closeDialog = () => {
    if (saving) return
    setDialogOpen(false)
    setEditing(null)
    setDraft('')
  }

  const handleSave = async () => {
    const note = draft.trim()
    if (!note) {
      toast({ title: 'Note is required', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      if (editing) {
        const updated = await api.updateClinicalNote(editing.id, { note })
        setPayload((current) => ({
          ...current,
          notes: (current?.notes || []).map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
        }))
        toast({ title: 'Note updated', variant: 'success' })
      } else {
        const created = await api.createClinicalNote(patientId, resolvedAdmissionId, { note })
        setPayload((current) => ({
          ...current,
          notes: [created, ...(current?.notes || []).filter((row) => row.id !== created.id)],
          canCreate: current?.canCreate ?? true,
        }))
        toast({ title: 'Note saved', variant: 'success' })
      }
      setDialogOpen(false)
      setEditing(null)
      setDraft('')
    } catch (err) {
      toast({ title: editing ? 'Could not update note' : 'Could not save note', description: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card id="clinical-notes" className={className}>
      <SectionHead
        kicker="Clinical documentation"
        title={heading}
        description="Observations and updates for this admission. These notes do not create charges."
        action={
          canCreate ? (
            <Button size="sm" variant="outline" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Add Note
            </Button>
          ) : null
        }
      />
      <CardContent className="space-y-4 p-6">
        {readOnly ? (
          <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            This admission has been discharged. Clinical notes are now read-only.
          </p>
        ) : null}

        {resolvingStay || loading ? <LoadingState message="Loading clinical notes..." /> : null}

        {!resolvingStay && !loading && error ? (
          <ErrorState title="Unable to load clinical notes." message={error} onRetry={reload} retryLabel="Try Again" />
        ) : null}

        {!resolvingStay && !loading && !error && !notes.length ? (
          <EmptyState
            icon={ClipboardList}
            title="No clinical notes recorded yet."
            description="Nurses can document patient observations and updates during the admission."
            action={
              canCreate ? (
                <Button size="sm" onClick={openCreate}>
                  <Plus className="h-4 w-4" /> Add First Note
                </Button>
              ) : null
            }
          />
        ) : null}

        {!resolvingStay && !loading && !error && notes.length
          ? notes.map((note) => (
              <article key={note.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium tabular-nums">{formatDateTime(note.createdAt)}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{note.createdByLabel || note.createdByName || 'Staff'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {note.isEdited ? <Badge variant="secondary">Edited</Badge> : null}
                    {note.isVoided ? <Badge variant="outline">Voided</Badge> : null}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{note.note}</p>
                {note.canEdit ? (
                  <div className="mt-3">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(note)}>
                      Edit
                    </Button>
                  </div>
                ) : null}
              </article>
            ))
          : null}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Clinical Note' : 'Add Clinical Note'}</DialogTitle>
            <DialogDescription>
              {editing ? 'The previous text is kept in the record history.' : 'The note is saved for this admission under your name and the current time.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="clinical-note-text">Note</Label>
            <Textarea
              id="clinical-note-text"
              value={draft}
              maxLength={NOTE_MAX_LENGTH}
              rows={7}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Patient reports mild abdominal pain..."
            />
            <p className="text-xs text-muted-foreground">{draft.trim().length}/{NOTE_MAX_LENGTH}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || !draft.trim()}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Save Note'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
