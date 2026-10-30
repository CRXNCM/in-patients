import { useRef, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/context/ToastContext'
import { useWorkflowRequests } from '@/context/WorkflowRequestsContext'
import {
  canApprovePharmacy,
  canCancelRequest,
  canProcessLaboratory,
} from '@/lib/workflowAccess'
import { ConfirmDialog, ReasonDialog, RequestDetailDialog } from './WorkflowDialogs'

export function useWorkflowMutations() {
  const { user } = useAuth()
  const { toast } = useToast()
  const workflow = useWorkflowRequests()
  const [selectedId, setSelectedId] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [reason, setReason] = useState(null)
  const busyRef = useRef(false)
  const [busy, setBusy] = useState(false)

  const selected = workflow.requests.find((request) => request.id === selectedId) || null
  const canFulfill = canApprovePharmacy(user)
  const canProcess = canProcessLaboratory(user)
  const capabilities = selected ? {
    approve: canFulfill && selected.status === 'pending',
    reject: canFulfill && selected.status === 'pending',
    accept: canProcess && selected.kind === 'laboratory' && selected.status === 'pending',
    complete: canProcess && selected.kind === 'laboratory' && selected.status === 'processing',
    cancel: canCancelRequest(user, selected),
  } : {}

  const run = async (work, success) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      await work()
      toast({ title: success.title, description: success.description, variant: 'success' })
      setConfirm(null)
      setReason(null)
    } catch (err) {
      toast({ title: 'Could not update the request', description: err.message, variant: 'destructive' })
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  const dialogs = (
    <>
      <RequestDetailDialog
        request={selected}
        capabilities={capabilities}
        busy={busy}
        onOpenChange={(open) => { if (!open) setSelectedId(null) }}
        onApprove={(request) => setConfirm({ type: 'approve', request })}
        onReject={(request) => setReason({ type: 'reject', request })}
        onAccept={(request) => setConfirm({ type: 'accept', request })}
        onComplete={(request) => setReason({ type: 'complete', request })}
        onCancel={(request) => setReason({ type: 'cancel', request })}
      />
      <ConfirmDialog
        open={!!confirm}
        busy={busy}
        title={confirm?.type === 'accept' ? 'Accept laboratory request?' : 'Approve pharmacy request?'}
        description={confirm?.type === 'accept'
          ? 'Accepting marks the request as processing. It does not complete the test.'
          : 'Approve only after the medicine has been handed to the nurse. This does not add a charge.'}
        confirmLabel={confirm?.type === 'accept' ? 'Accept request' : 'Approve handover'}
        onOpenChange={(open) => { if (!open) setConfirm(null) }}
        onConfirm={() => {
          if (!confirm) return
          if (confirm.type === 'accept') {
            run(() => workflow.acceptRequest(confirm.request.id), { title: 'Request accepted', description: `${confirm.request.id} is now processing.` })
          } else if (workflow.approveRequest) {
            run(() => workflow.approveRequest(confirm.request.id), { title: 'Request approved', description: `${confirm.request.id} was marked as handed to the nurse.` })
          }
        }}
      />
      <ReasonDialog
        open={!!reason}
        busy={busy}
        destructive={reason?.type === 'reject' || reason?.type === 'cancel'}
        title={reason?.type === 'complete' ? 'Mark test complete' : reason?.type === 'cancel' ? 'Cancel request?' : 'Reject pharmacy request?'}
        description={reason?.type === 'complete'
          ? 'Add a short completion note. This prototype does not store a laboratory report.'
          : reason?.type === 'cancel'
            ? 'A cancellation reason is required. The request stays in the history.'
            : 'A rejection reason is required. The nurse can still see the request.'}
        label={reason?.type === 'complete' ? 'Completion note' : reason?.type === 'cancel' ? 'Cancellation reason' : 'Rejection reason'}
        placeholder={reason?.type === 'complete' ? 'For example, worksheet filed on the bench' : 'Reason'}
        confirmLabel={reason?.type === 'complete' ? 'Mark complete' : reason?.type === 'cancel' ? 'Cancel request' : 'Reject request'}
        onOpenChange={(open) => { if (!open) setReason(null) }}
        onConfirm={(note) => {
          if (!reason) return
          if (reason.type === 'complete') {
            run(() => workflow.completeRequest(reason.request.id, note), { title: 'Request completed', description: `${reason.request.id} is complete.` })
          } else if (reason.type === 'cancel') {
            run(() => workflow.cancelRequest(reason.request.id, note), { title: 'Request cancelled', description: `${reason.request.id} was cancelled.` })
          } else if (workflow.rejectRequest) {
            run(() => workflow.rejectRequest(reason.request.id, note), { title: 'Request rejected', description: `${reason.request.id} stays in the history.` })
          }
        }}
      />
    </>
  )

  return {
    requests: workflow.requests,
    loading: workflow.loading,
    error: workflow.error,
    user,
    busy,
    canFulfill,
    canProcess,
    setSelectedId,
    setConfirm,
    setReason,
    dialogs,
  }
}
