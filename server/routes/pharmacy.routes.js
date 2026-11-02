import { Router } from 'express'
import { PharmacyOrder } from '../models/PharmacyOrder.js'
import { authRequired } from '../middleware/auth.js'
import { todayStr } from '../utils/dates.js'
import { applyHandover, applyReturn, listMedicineReturns, overallStatus, verifyReturn } from '../../frontend/src/services/pharmacyFulfillment.js'
import { syncPharmacyItemCharge } from '../services/departmentBilling.js'
import { attachReturnBilling } from '../services/pharmacyReturns.js'
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

export function plainPharmacyOrder(doc) {
  if (!doc) return null
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : doc
  const items = obj.items || []
  return {
    id: String(doc._id || obj.id || ''),
    updatedAt: doc.updatedAt?.toISOString?.() || obj.updatedAt || null,
    submissionId: obj.submissionId,
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
    status: overallStatus(items),
    items,
    returns: obj.returns || [],
    history: obj.history || [],
  }
}

async function persistOrder(doc, nextOrder, clientActionId) {
  const updated = await PharmacyOrder.findOneAndUpdate(
    { _id: doc._id, updatedAt: doc.updatedAt },
    {
      $set: {
        items: nextOrder.items,
        returns: nextOrder.returns,
        history: nextOrder.history,
        status: nextOrder.status,
      },
    },
    { new: true }
  )
  if (updated) return { order: plainPharmacyOrder(updated) }
  const current = await PharmacyOrder.findById(doc._id)
  if (!current) return { error: 'Request not found.', status: 404 }
  const plain = plainPharmacyOrder(current)
  const seen = JSON.stringify(plain).includes(`"clientActionId":"${clientActionId}"`)
  if (seen) return { order: plain, duplicate: true }
  return { error: 'This request changed. Refresh it and try again.', status: 409 }
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
  const day = String(order.requestedAt || '').slice(0, 10)
  if (query.from && day < String(query.from)) return false
  if (query.to && day > String(query.to)) return false
  if (query.date && day !== String(query.date)) return false
  return true
}

async function releaseSuppliedItems(orderId, actorName) {
  const doc = await PharmacyOrder.findById(orderId)
  if (!doc) return null
  const plain = plainPharmacyOrder(doc)
  const date = String(plain.requestedAt || '').slice(0, 10) || todayStr()
  let changed = false
  const items = []
  for (const item of plain.items) {
    const supplied = Number(item.suppliedQuantity) || 0
    const billed = Number(item.billedQuantity) || 0
    const closed = item.receptionStatus === 'approved' || item.receptionStatus === 'rejected'
    if (supplied > billed && !closed) {
      items.push(await syncPharmacyItemCharge(plain, item, actorName, date))
      changed = true
    } else {
      items.push(item)
    }
  }
  if (!changed) return plain
  doc.items = items
  doc.markModified('items')
  await doc.save()
  return plainPharmacyOrder(doc)
}

router.get('/orders', authRequired, requireRoles('Pharmacist', 'Nurse', 'Admin'), async (req, res) => {
  try {
    await detachPendingMixedDepartmentLines(req.user)
    const docs = await PharmacyOrder.find().sort({ requestedAt: -1, createdAt: -1 }).limit(500)
    const orders = docs.map(plainPharmacyOrder).filter((order) => matchesQuery(order, req.query))
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
    res.status(500).json({ error: 'Failed to load pharmacy requests' })
  }
})

router.get('/orders/:id', authRequired, requireRoles('Pharmacist', 'Nurse', 'Admin'), async (req, res) => {
  try {
    const doc = await PharmacyOrder.findById(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Request not found.' })
    res.json(plainPharmacyOrder(doc))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load the pharmacy request' })
  }
})

router.post('/orders/:id/handover', authRequired, requireRoles('Pharmacist'), async (req, res) => {
  try {
    const doc = await PharmacyOrder.findById(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Request not found.' })
    const result = applyHandover(plainPharmacyOrder(doc), {
      id: req.user.id,
      name: req.user.name,
    }, req.body || {})
    if (result.error) return res.status(400).json({ error: result.error })
    if (!result.duplicate) {
      const saved = await persistOrder(doc, result.order, req.body?.clientActionId)
      if (saved.error) return res.status(saved.status || 409).json({ error: saved.error })
    }
    const released = await releaseSuppliedItems(doc._id, req.user.name)
    res.json(released)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to record the handover' })
  }
})

router.get('/returns', authRequired, requireRoles('Pharmacist', 'Reception', 'Admin'), async (req, res) => {
  try {
    const docs = await PharmacyOrder.find({ 'returns.0': { $exists: true } }).sort({ updatedAt: -1 }).limit(500)
    const forReception = req.user.role === 'Reception'
    const rows = listMedicineReturns(docs.map(plainPharmacyOrder), {
      includePending: !forReception,
      forReception,
    })
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load medicine returns' })
  }
})

router.post('/orders/:id/returns', authRequired, requireRoles('Pharmacist'), async (req, res) => {
  try {
    const doc = await PharmacyOrder.findById(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Request not found.' })
    const result = applyReturn(plainPharmacyOrder(doc), {
      id: req.user.id,
      name: req.user.name,
    }, req.body || {})
    if (result.error) return res.status(400).json({ error: result.error })
    if (result.duplicate) return res.json(plainPharmacyOrder(doc))
    const saved = await persistOrder(doc, result.order, req.body?.clientActionId)
    if (saved.error) return res.status(saved.status || 409).json({ error: saved.error })
    res.json(saved.order)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to record the return' })
  }
})

router.post('/orders/:id/returns/:returnId/verify', authRequired, requireRoles('Pharmacist'), async (req, res) => {
  try {
    const doc = await PharmacyOrder.findById(req.params.id)
    if (!doc) return res.status(404).json({ error: 'Request not found.' })
    const result = verifyReturn(plainPharmacyOrder(doc), {
      id: req.user.id,
      name: req.user.name,
    }, { ...(req.body || {}), returnId: req.params.returnId })
    if (result.error) return res.status(400).json({ error: result.error })
    let orderDoc = doc
    if (!result.duplicate) {
      const saved = await persistOrder(doc, result.order, req.body?.clientActionId)
      if (saved.error) return res.status(saved.status || 409).json({ error: saved.error })
      orderDoc = await PharmacyOrder.findById(doc._id)
    }
    const billed = await attachReturnBilling(orderDoc, result.returnId || req.params.returnId, req.user.name)
    if (billed.error) return res.status(billed.status || 400).json({ error: billed.error })
    res.json(billed.order)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to verify the return' })
  }
})

export default router
