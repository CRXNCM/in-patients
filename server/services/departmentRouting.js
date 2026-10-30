import { Patient } from '../models/Patient.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { PharmacyOrder } from '../models/PharmacyOrder.js'
import { LaboratoryOrder } from '../models/LaboratoryOrder.js'
import { partitionServiceLines, buildPharmacyOrder } from '../../frontend/src/services/pharmacyFulfillment.js'
import { buildLaboratoryOrder } from '../../frontend/src/services/laboratoryOrders.js'

function audit(action, by, note = '') {
  return { action, by, at: new Date().toISOString(), note }
}

function stayFrom(patient, record) {
  return {
    patientId: patient?.patientId || record.patientId,
    patientName: patient?.name || record.recordName || '',
    admissionId: patient?._id ? String(patient._id) : '',
    admissionNumber: patient?.patientId || record.patientId,
    ward: '',
    room: patient?.room || '',
    bed: patient?.bed || '',
  }
}

async function createOrder(Model, built, sourceRecordId) {
  if (!built?.order || built.error) return null
  const { id: _id, ...payload } = built.order
  payload.sourceRecordId = sourceRecordId
  try {
    return await Model.create(payload)
  } catch (err) {
    if (err?.code !== 11000) throw err
    return Model.findOne({ submissionId: payload.submissionId })
  }
}

async function lineIdsAlreadyQueued(Model, patientId, lineIds) {
  if (!lineIds.length) return new Set()
  const orders = await Model.find({ patientId, 'items.lineId': { $in: lineIds } }).select('items.lineId')
  const found = new Set()
  for (const order of orders) {
    for (const item of order.items || []) {
      if (lineIds.includes(item.lineId)) found.add(item.lineId)
    }
  }
  return found
}

export async function detachMixedDepartmentLines(record, actor = {}) {
  if (!record || record.status !== 'pending' || record.recordType === 'return') return false
  if (record.billingKey || record.workflowLineId || record.departmentCleared) return false
  const parts = partitionServiceLines(record.services || [])
  if ((!parts.pharmacy.length && !parts.laboratory.length) || !parts.other.length) return false

  const patient = await Patient.findOne({ patientId: record.patientId })
  const stay = stayFrom(patient, record)
  const actorObj = { id: actor.id || '', name: actor.name || record.submittedBy || 'Nurse' }
  const at = new Date().toISOString()
  const sourceRecordId = String(record._id)
  const submissionId = `record-${sourceRecordId}`

  const pharmacyIds = parts.pharmacy.map((line) => line.id).filter(Boolean)
  const laboratoryIds = parts.laboratory.map((line) => line.id).filter(Boolean)
  const queuedPharmacy = await lineIdsAlreadyQueued(PharmacyOrder, record.patientId, pharmacyIds)
  const queuedLaboratory = await lineIdsAlreadyQueued(LaboratoryOrder, record.patientId, laboratoryIds)
  const newPharmacy = parts.pharmacy.filter((line) => line.id && !queuedPharmacy.has(line.id))
  const newLaboratory = parts.laboratory.filter((line) => line.id && !queuedLaboratory.has(line.id))

  if (newPharmacy.length) {
    const built = buildPharmacyOrder({ submissionId, stay, actor: actorObj, lines: newPharmacy, at })
    if (built.error) throw new Error(built.error)
    await createOrder(PharmacyOrder, built, sourceRecordId)
  }
  if (newLaboratory.length) {
    const built = buildLaboratoryOrder({ submissionId, stay, actor: actorObj, lines: newLaboratory, at })
    if (built.error) throw new Error(built.error)
    await createOrder(LaboratoryOrder, built, sourceRecordId)
  }

  record.services = parts.other
  if (!record.submissionId) record.submissionId = submissionId
  record.departmentGate = ''
  record.departmentCleared = false
  record.auditTrail = [
    ...(record.auditTrail || []),
    audit(
      'edited',
      actorObj.name,
      `Pharmacy and laboratory items were moved to their queues. ${parts.other.length} other service(s) remain for reception.`
    ),
  ]
  record.markModified('services')
  record.markModified('auditTrail')
  await record.save()
  return true
}

export async function detachPendingMixedDepartmentLines(actor) {
  const records = await ServiceRecord.find({
    status: 'pending',
    departmentCleared: { $ne: true },
    billingKey: { $in: [null, ''] },
    'services.category': { $in: ['Pharmacy', 'Laboratory', 'pharmacy', 'laboratory', 'Lab', 'lab'] },
  })
  for (const record of records) {
    try {
      await detachMixedDepartmentLines(record, actor)
    } catch (err) {
      console.error(err)
    }
  }
}
