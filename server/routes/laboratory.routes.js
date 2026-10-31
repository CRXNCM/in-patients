import { Router } from 'express'
import { LaboratoryOrder } from '../models/LaboratoryOrder.js'
import { authRequired } from '../middleware/auth.js'
import { todayStr } from '../utils/dates.js'
import {
  approveLaboratoryItem,
  cancelLaboratoryItem,
  laboratoryOverallStatus,
  rejectLaboratoryItem,
} from '../../frontend/src/services/laboratoryOrders.js'
import { syncLaboratoryItemCharge, withdrawPendingDepartmentCharge } from '../services/departmentBilling.js'
import { detachPendingMixedDepartmentLines } from '../services/departmentRouting.js'

const router = Router()

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    next()
  }
}

export function plainLaboratoryOrder(doc) {
  if (!doc) return null
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc
  const items = obj.items || []
  return {
    id: String(doc._id || obj.id || ''),
    kind: 'laboratory',
    updatedAt: doc.updatedAt?.toISOString?.() || obj.updatedAt || null,
    submissionId: obj.submissionId,
    sourceRecordId: obj.sourceRecordId || '',
    patientId: obj.patientId,
    patientName: obj.patientName || '',
    admissionId: obj.admissionId || '',
    admissionNumber: obj.admissionNumber || obj.patientId,
    ward: obj.ward || '',
    room: obj.room || '',
    bed: obj.bed || '',
    admissionType: obj.admissionType || '',
    convertedFromEmergency: Boolean(obj.convertedFromEmergency),
    requestedById: obj.requestedById || '',
    requestedByName: obj.requestedByName || '',
    requestedAt: obj.requestedAt,
    status: laboratoryOverallStatus(items),
    items,
    history: obj.history || [],
  }
}

function actorOf(req) {
  return { id: req.user.id, name: req.user.name }
}

async function persistOrder(doc, nextOrder) {
  const updated = await LaboratoryOrder.findOneAndUpdate(
    { _id: doc._id, updatedAt: doc.updatedAt },
    { $set: { items: nextOrder.items, history: nextOrder.history, status: nextOrder.status } },
    { new: true }
  )
  if (updated) return { order: plainLaboratoryOrder(updated), doc: updated }
  const current = await LaboratoryOrder.findById(doc._id)
  if (!current) return { error: 'Request not found.', status: 404 }
  const plain = plainLaboratoryOrder(current)
  const actionId = [...(nextOrder.history || [])].reverse().find((event) => event.clientActionId)?.clientActionId
  const seen = actionId && JSON.stringify(plain).includes(`"clientActionId":"${actionId}"`)
  if (seen) return { order: plain, doc: current, duplicate: true }
  return { error: 'This request changed. Refresh it and try again.', status: 409 }
}

async function releaseApprovedItems(doc, actorName) {
  const plain = plainLaboratoryOrder(doc)
  const date = String(plain.requestedAt || '').slice(0, 10) || todayStr()
  let changed = false
  const items = []
  for (const item of plain.items) {
    const ready = item.status === 'approved' || item.status === 'processing' || item.status === 'completed'
    if (ready && (!item.receptionStatus || item.receptionStatus === 'not_sent')) {
      items.push(await syncLaboratoryItemCharge(plain, item, actorName, date))
      changed = true
    } else {
      items.push(item)
    }
  }
  if (!changed) return plain
  doc.items = items
  doc.markModified('items')
  await doc.save()
  return plainLaboratoryOrder(doc)
}

function matchesQuery(order, query) {
  const search = String(query.search || '').trim().toLowerCase()
  if (search) {
    const names = (order.items || []).map((item) => item.name).join(' ')
    const haystack = `${order.patientName} ${order.patientId} ${order.id} ${order.admissionNumber} ${names}`.toLowerCase()
    if (!haystack.includes(search)) return false
  }
  if (query.status && query.status !== 'all' && order.status !== query.status) return false
  if (query.ward && order.ward !== query.ward) return false
  if (query.priority && query.priority !== 'all') {
    if (!(order.items || []).some((item) => item.priority === query.priority)) return false
  }
  const day = String(order.requestedAt || '').slice(0, 10)
  if (query.from && day < String(query.from)) return false
  if (query.to && day > String(query.to)) return false
  if (query.date && day !== String(query.date)) return false
  return true
}

router.get('/orders', authRequired, requireRoles('Laboratory', 'Nurse', 'Admin'), async (req, res) => {
  try {
    await detachPendingMixedDepartmentLines(req.user)
    const docs = await LaboratoryOrder.find().sort({ requestedAt: -1, createdAt: -1 }).limit(500)
    const orders = docs.map(plainLaboratoryOrder).filter((order) => matchesQuery(order, req.query))
    const page = Number(req.query.page)
    const limit = Number(req.query.limit)
    if (page || limit) {
      const size = Math.min(200, Math.max(1, limit || 20))
      const current = Math.max(1, page || 1)
      const start = (current - 1) * size
      return res.json({ orders: orders.slice(start, start + size), total: orders.length, page: current, limit: size })
    }
    res.json(orders)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load laboratory requests' })
  }
})

router.get('/orders/:id', authRequired, requireRoles('Laboratory', 'Nurse', 'Admin'), async (req, res) => {
  try {
    const doc = await LaboratoryOrder.findById(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Request not found.' })
    res.json(plainLaboratoryOrder(doc))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load the laboratory request' })
  }
})

async function transition(req, res, apply, { release = false } = {}) {
  const doc = await LaboratoryOrder.findById(req.params.id)
  if (!doc) return res.status(404).json({ error: 'Request not found.' })
  const result = apply(plainLaboratoryOrder(doc))
  if (result.error) return res.status(400).json({ error: result.error })
  if (result.duplicate) {
    const released = release ? await releaseApprovedItems(doc, req.user.name) : plainLaboratoryOrder(doc)
    return res.json(released)
  }
  const saved = await persistOrder(doc, result.order)
  if (saved.error) return res.status(saved.status || 409).json({ error: saved.error })
  if (!release) return res.json(saved.order)
  res.json(await releaseApprovedItems(saved.doc, req.user.name))
}

router.post('/orders/:id/items/:lineId/approve', authRequired, requireRoles('Laboratory'), async (req, res) => {
  try {
    await transition(req, res, (order) => approveLaboratoryItem(order, actorOf(req), {
      lineId: req.params.lineId,
      clientActionId: req.body?.clientActionId,
    }), { release: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to approve the test' })
  }
})

router.post('/orders/:id/items/:lineId/reject', authRequired, requireRoles('Laboratory'), async (req, res) => {
  try {
    await transition(req, res, (order) => rejectLaboratoryItem(order, actorOf(req), {
      lineId: req.params.lineId,
      clientActionId: req.body?.clientActionId,
      reason: req.body?.reason,
    }))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to reject the test' })
  }
})

router.post('/orders/:id/items/:lineId/cancel', authRequired, requireRoles('Laboratory', 'Nurse'), async (req, res) => {
  try {
    const doc = await LaboratoryOrder.findById(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Request not found.' })
    const current = plainLaboratoryOrder(doc)
    const item = (current.items || []).find((entry) => entry.lineId === req.params.lineId)
    if (!item) return res.status(404).json({ error: 'Test not found on this request.' })
    if (req.user.role === 'Nurse') {
      if (String(current.requestedById) !== String(req.user.id) || item.status !== 'pending') {
        return res.status(403).json({ error: 'Forbidden' })
      }
    }
    const result = cancelLaboratoryItem(current, actorOf(req), {
      lineId: req.params.lineId,
      clientActionId: req.body?.clientActionId,
      reason: req.body?.reason,
    })
    if (result.error) return res.status(400).json({ error: result.error })
    if (result.duplicate) return res.json(current)
    if (result.billingRecordId) {
      const withdrew = await withdrawPendingDepartmentCharge(
        result.billingRecordId,
        req.user.name,
        'Laboratory cancelled this test before reception approved the charge.'
      )
      if (withdrew) {
        result.order.items = result.order.items.map((entry) => (
          entry.lineId === req.params.lineId ? { ...entry, receptionStatus: 'rejected' } : entry
        ))
      }
    }
    const saved = await persistOrder(doc, result.order)
    if (saved.error) return res.status(saved.status || 409).json({ error: saved.error })
    res.json(saved.order)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to cancel the test' })
  }
})

export default router
