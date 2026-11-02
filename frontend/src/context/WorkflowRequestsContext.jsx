import * as React from 'react'
import { api, hasToken, USE_API } from '@/api/client'
import { useAuth } from '@/context/AuthContext'
import { useLiveSync } from '@/context/LiveSyncContext'
import { workflowActor } from '@/lib/workflowAccess'
import { newClientId } from '@/lib/utils'
import {
  approveLaboratoryItem,
  buildLaboratoryOrder,
  cancelLaboratoryItem,
  rejectLaboratoryItem,
} from '@/services/laboratoryOrders'
import {
  applyHandover,
  applyReturn,
  buildPharmacyOrder,
  verifyReturn,
  partitionServiceLines,
  serviceLineSignature,
} from '@/services/pharmacyFulfillment'

const WorkflowRequestsContext = React.createContext(null)

function localId(prefix) {
  return `${prefix}-${newClientId()}`
}

export function WorkflowRequestsProvider({ children }) {
  const { user, isAuthenticated, authReady } = useAuth()
  const [pharmacyOrders, setPharmacyOrders] = React.useState([])
  const [laboratoryOrders, setLaboratoryOrders] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')
  const ordersRef = React.useRef(pharmacyOrders)
  const labsRef = React.useRef(laboratoryOrders)
  const submissionsRef = React.useRef(new Map())
  const inflight = React.useRef(new Set())
  ordersRef.current = pharmacyOrders
  labsRef.current = laboratoryOrders

  const persist = hasToken() && USE_API

  const refresh = React.useCallback(async () => {
    if (!USE_API) return
    if (!hasToken()) {
      setPharmacyOrders([])
      setLaboratoryOrders([])
      setError('Sign in again to load pharmacy and laboratory requests.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const role = user?.role
      const jobs = []
      if (role === 'Pharmacist' || role === 'Nurse' || role === 'Admin') jobs.push(api.getPharmacyOrders().then(setPharmacyOrders))
      if (role === 'Laboratory' || role === 'Nurse' || role === 'Admin') jobs.push(api.getLaboratoryOrders().then(setLaboratoryOrders))
      await Promise.all(jobs)
    } catch (err) {
      setError(err.message || 'Could not load ward requests.')
    } finally {
      setLoading(false)
    }
  }, [user?.role])

  React.useEffect(() => {
    if (!authReady || !isAuthenticated) return undefined
    refresh()
    return undefined
  }, [authReady, isAuthenticated, refresh])

  useLiveSync(refresh)

  const upsertOrder = React.useCallback((order) => {
    if (!order?.id) return
    setPharmacyOrders((prev) => {
      const next = [order, ...prev.filter((item) => item.id !== order.id)]
      ordersRef.current = next
      return next
    })
  }, [])

  const upsertLaboratory = React.useCallback((order) => {
    if (!order?.id) return
    setLaboratoryOrders((prev) => [order, ...prev.filter((item) => item.id !== order.id)])
  }, [])

  const routeNurseServices = React.useCallback(async (payload) => {
    if (user?.roleKey !== 'nurse') throw new Error('Only a nurse can submit ward services from the patient record.')
    const submissionId = String(payload.submissionId || '').trim()
    if (!submissionId) throw new Error('Submission id is required.')
    const signature = serviceLineSignature(payload.services || [])
    const saved = submissionsRef.current.get(submissionId)
    if (saved?.signature === signature) return { ...saved.result, duplicate: true }
    if (saved) throw new Error('This submission was already recorded with different items. Submit the new items as a new record.')

    if (USE_API && !hasToken()) {
      throw new Error('Sign in again to submit ward services. This screen does not keep a local copy.')
    }
    if (persist) {
      const result = await api.submitWardServices(payload.patientId, payload)
      if (result.pharmacyOrder) upsertOrder(result.pharmacyOrder)
      if (result.laboratoryOrder) upsertLaboratory(result.laboratoryOrder)
      submissionsRef.current.set(submissionId, { signature, result })
      return result
    }

    const parts = partitionServiceLines(payload.services || [])
    const at = new Date().toISOString()
    const actor = workflowActor(user)
    const stay = payload.stay || {}
    let pharmacyOrder = null
    if (parts.pharmacy.length) {
      const built = buildPharmacyOrder({
        submissionId,
        stay,
        actor,
        lines: parts.pharmacy,
        at,
      })
      if (built.error) throw new Error(built.error)
      pharmacyOrder = { ...built.order, id: localId('phr') }
      upsertOrder(pharmacyOrder)
    }
    let laboratoryOrder = null
    if (parts.laboratory.length) {
      const built = buildLaboratoryOrder({
        submissionId,
        stay,
        actor,
        lines: parts.laboratory,
        at,
      })
      if (built.error) throw new Error(built.error)
      laboratoryOrder = { ...built.order, id: localId('lab') }
      upsertLaboratory(laboratoryOrder)
    }
    const result = {
      record: null,
      pharmacyOrder,
      laboratoryOrder,
      otherLines: parts.other,
      counts: {
        pharmacy: parts.pharmacy.length,
        laboratory: parts.laboratory.length,
        reception: parts.other.length,
      },
    }
    submissionsRef.current.set(submissionId, { signature, result })
    return result
  }, [persist, upsertLaboratory, upsertOrder, user])

  const runOrder = React.useCallback(async (id, apply) => {
    if (inflight.current.has(id)) throw new Error('This request is already being updated.')
    inflight.current.add(id)
    try {
      const current = ordersRef.current.find((order) => order.id === id)
      if (!current) throw new Error('Request not found.')
      const result = apply(current)
      if (result.error) throw new Error(result.error)
      if (persist && !result.duplicate) {
        return result
      }
      const next = result.order
      ordersRef.current = ordersRef.current.map((order) => (order.id === id ? next : order))
      setPharmacyOrders(ordersRef.current)
      return next
    } finally {
      inflight.current.delete(id)
    }
  }, [persist])

  const handOver = React.useCallback(async (id, body) => {
    if (user?.roleKey !== 'pharmacist') throw new Error('Only a pharmacist can hand over medicine.')
    if (USE_API && !hasToken()) throw new Error('Sign in again to record a handover.')
    if (persist) {
      const order = await api.handoverPharmacyOrder(id, body)
      upsertOrder(order)
      return order
    }
    return runOrder(id, (current) => applyHandover(current, workflowActor(user), body))
  }, [persist, runOrder, upsertOrder, user])

  const recordReturn = React.useCallback(async (id, body) => {
    if (user?.roleKey !== 'pharmacist') throw new Error('Only a pharmacist can record a medicine return.')
    if (USE_API && !hasToken()) throw new Error('Sign in again to record a medicine return.')
    if (persist) {
      const order = await api.returnPharmacyOrder(id, body)
      upsertOrder(order)
      return order
    }
    return runOrder(id, (current) => applyReturn(current, workflowActor(user), body))
  }, [persist, runOrder, upsertOrder, user])

  const verifyMedicineReturn = React.useCallback(async (orderId, returnId, body) => {
    if (user?.roleKey !== 'pharmacist') throw new Error('Only a pharmacist can verify a medicine return.')
    if (USE_API && !hasToken()) throw new Error('Sign in again to verify a medicine return.')
    if (persist) {
      const order = await api.verifyPharmacyReturn(orderId, returnId, body)
      upsertOrder(order)
      return order
    }
    return runOrder(orderId, (current) => verifyReturn(current, workflowActor(user), { ...body, returnId }))
  }, [persist, runOrder, upsertOrder, user])

  const runLaboratory = React.useCallback(async (orderId, lineId, remote, applyLocal) => {
    const key = `${orderId}:${lineId}`
    if (inflight.current.has(key)) throw new Error('This test is already being updated.')
    inflight.current.add(key)
    try {
      if (USE_API && !hasToken()) throw new Error('Sign in again to update a laboratory request.')
      if (persist) {
        const order = await remote()
        upsertLaboratory(order)
        return order
      }
      const current = labsRef.current.find((order) => order.id === orderId)
      if (!current) throw new Error('Request not found.')
      const result = applyLocal(current)
      if (result.error) throw new Error(result.error)
      upsertLaboratory(result.order)
      return result.order
    } finally {
      inflight.current.delete(key)
    }
  }, [persist, upsertLaboratory])

  const approveLaboratory = React.useCallback((orderId, lineId, clientActionId) => {
    if (user?.roleKey !== 'laboratory') throw new Error('Only laboratory staff can approve a test.')
    return runLaboratory(
      orderId,
      lineId,
      () => api.approveLaboratoryItem(orderId, lineId, { clientActionId }),
      (order) => approveLaboratoryItem(order, workflowActor(user), { lineId, clientActionId })
    )
  }, [runLaboratory, user])

  const rejectLaboratory = React.useCallback((orderId, lineId, body) => {
    if (user?.roleKey !== 'laboratory') throw new Error('Only laboratory staff can reject a test.')
    return runLaboratory(
      orderId,
      lineId,
      () => api.rejectLaboratoryItem(orderId, lineId, body),
      (order) => rejectLaboratoryItem(order, workflowActor(user), { ...body, lineId })
    )
  }, [runLaboratory, user])

  const cancelLaboratory = React.useCallback((orderId, lineId, body) => (
    runLaboratory(
      orderId,
      lineId,
      () => api.cancelLaboratoryItem(orderId, lineId, body),
      (order) => cancelLaboratoryItem(order, workflowActor(user), { ...body, lineId })
    )
  ), [runLaboratory])

  const counts = React.useMemo(() => ({
    pharmacyPending: pharmacyOrders.filter((order) => order.status === 'pending' || order.status === 'partially_fulfilled').length,
    laboratoryPending: laboratoryOrders.filter((order) => (
      order.status === 'pending' || order.status === 'partially_decided'
    )).length,
  }), [laboratoryOrders, pharmacyOrders])

  const value = React.useMemo(() => ({
    pharmacyOrders,
    laboratoryOrders,
    requests: [],
    loading,
    error,
    counts,
    refresh,
    routeNurseServices,
    handOver,
    recordReturn,
    verifyMedicineReturn,
    approveLaboratory,
    rejectLaboratory,
    cancelLaboratory,
  }), [
    pharmacyOrders,
    laboratoryOrders,
    loading,
    error,
    counts,
    refresh,
    routeNurseServices,
    handOver,
    recordReturn,
    verifyMedicineReturn,
    approveLaboratory,
    rejectLaboratory,
    cancelLaboratory,
  ])

  return (
    <WorkflowRequestsContext.Provider value={value}>
      {children}
    </WorkflowRequestsContext.Provider>
  )
}

export function useWorkflowRequests() {
  const context = React.useContext(WorkflowRequestsContext)
  if (!context) throw new Error('useWorkflowRequests must be used within WorkflowRequestsProvider')
  return context
}
