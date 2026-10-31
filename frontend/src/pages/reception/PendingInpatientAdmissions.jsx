import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader, DataTable, StatusBadge } from '@/components/shared/CommonComponents'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { ConvertToInpatientDialog } from '@/components/shared/ConvertToInpatientDialog'
import { PatientLink } from '@/components/shared/PatientLink'
import { usePatients } from '@/context/PatientsContext'
import { useToast } from '@/context/ToastContext'
import { api } from '@/api/client'
import { conversionStatusLabel } from '@/lib/admissions'
import { formatDateTime } from '@/lib/utils'

export default function PendingInpatientAdmissions() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { applyPatientUpdate } = usePatients()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [reasonOpen, setReasonOpen] = useState(null)
  const [reason, setReason] = useState('')
  const [completeFor, setCompleteFor] = useState(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.getConversionRequests()
      setRequests(data.requests || [])
    } catch (err) {
      setError(err.message || 'Could not load inpatient admission requests.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const decide = async (action) => {
    if (!reasonOpen) return
    try {
      if (action === 'reject') await api.rejectConversionRequest(reasonOpen.id, { reason })
      if (action === 'return') await api.returnConversionRequest(reasonOpen.id, { reason })
      toast({ title: action === 'reject' ? 'Request rejected' : 'Returned for correction', variant: 'success' })
      setReasonOpen(null)
      setReason('')
      setSelected(null)
      await load()
    } catch (err) {
      toast({ title: 'Action failed', description: err.message, variant: 'destructive' })
    }
  }

  const columns = [
    {
      key: 'patientId',
      header: 'Patient',
      render: (row) => (
        <PatientLink patientId={row.patientId} className="font-mono text-xs font-medium">{row.patientId}</PatientLink>
      ),
    },
    { key: 'patientName', header: 'Name', render: (row) => row.patientName || '—' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'requestedByName', header: 'Requested by' },
    { key: 'requestedAt', header: 'Requested', render: (row) => formatDateTime(row.requestedAt) },
    { key: 'reason', header: 'Reason', render: (row) => row.reason || '—' },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="outline" onClick={() => setSelected(row)}>View</Button>
          <Button size="sm" onClick={() => setCompleteFor(row)}>Complete Admission</Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Pending Inpatient Admissions"
        description="Emergency Nurse requests waiting for Reception to assign a bed, doctor, and admission deposit."
      />
      {loading ? (
        <LoadingState message="Loading inpatient admission requests…" />
      ) : error ? (
        <ErrorState title="Could not load requests" message={error} onRetry={load} />
      ) : (
        <DataTable columns={columns} data={requests} empty="No pending inpatient admission requests." />
      )}

      <Dialog open={Boolean(selected)} onOpenChange={() => setSelected(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{conversionStatusLabel(selected?.status)}</DialogTitle>
            <DialogDescription>
              {selected?.patientName} · {selected?.patientId}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Requested by:</span> {selected?.requestedByName}</p>
            <p><span className="text-muted-foreground">Requested at:</span> {selected?.requestedAt ? formatDateTime(selected.requestedAt) : '—'}</p>
            <p><span className="text-muted-foreground">Reason:</span> {selected?.reason}</p>
            {selected?.notes ? <p><span className="text-muted-foreground">Notes:</span> {selected.notes}</p> : null}
          </div>
          <DialogFooter className="flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate(`/reception/patient/${selected?.patientId}`)}>Open profile</Button>
            <Button variant="outline" onClick={() => { setReasonOpen({ ...selected, action: 'return' }); setSelected(null) }}>Return for Correction</Button>
            <Button variant="destructive" onClick={() => { setReasonOpen({ ...selected, action: 'reject' }); setSelected(null) }}>Reject</Button>
            <Button onClick={() => { setCompleteFor(selected); setSelected(null) }}>Complete Admission</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reasonOpen)} onOpenChange={() => setReasonOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{reasonOpen?.action === 'reject' ? 'Reject request' : 'Return for correction'}</DialogTitle>
            <DialogDescription>This stays on the original Emergency OPD admission. Provide a reason.</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Reason *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReasonOpen(null)}>Cancel</Button>
            <Button disabled={!reason.trim()} onClick={() => decide(reasonOpen?.action)}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConvertToInpatientDialog
        patient={completeFor ? { id: completeFor.patientId, name: completeFor.patientName } : null}
        open={Boolean(completeFor)}
        onOpenChange={(open) => { if (!open) setCompleteFor(null) }}
        title="Complete Inpatient Admission"
        submitLabel="Complete Admission"
        description="Assign a bed, visiting doctor, and admission deposit to finalize this Emergency OPD conversion."
        submitConversion={async (_id, body) => {
          const res = await api.completeConversionRequest(completeFor.id, body)
          if (res.patient) applyPatientUpdate(res.patient)
          return res.patient
        }}
        onConverted={() => {
          setCompleteFor(null)
          load()
        }}
      />
    </div>
  )
}
