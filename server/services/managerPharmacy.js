import { PharmacyOrder } from '../models/PharmacyOrder.js'
import { roleHasPermission } from '../utils/permissions.js'
import { todayStr } from '../utils/dates.js'
import { resolveDepositsPeriod } from './managerDeposits.js'

export const MANAGER_PHARMACY_PERMISSIONS = ['reports.view']

const HANDOVER_ACTIONS = new Set(['handed_over', 'partial_handover'])
const TOP_LIMIT = 50

function forbid(unless) {
  if (unless) return
  const error = new Error('Forbidden')
  error.status = 403
  throw error
}

function dayOf(value) {
  return String(value || '').slice(0, 10)
}

function inRange(day, startDate, endDate) {
  return Boolean(day) && day >= startDate && day <= endDate
}

function qty(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function money(quantity, unitPrice) {
  return Math.round(qty(quantity) * (Number(unitPrice) || 0) * 100) / 100
}

function medicineKey(item) {
  return String(item.catalogItemId || '').trim() || String(item.name || '').trim().toLowerCase()
}

export function issuedQuantityForItem(item, startDate, endDate, fallbackDay = '') {
  const events = (item.history || []).filter(
    (event) => HANDOVER_ACTIONS.has(event.action) && inRange(dayOf(event.at), startDate, endDate)
  )
  if (events.length) return events.reduce((sum, event) => sum + qty(event.quantity), 0)
  if (inRange(dayOf(fallbackDay), startDate, endDate)) return qty(item.suppliedQuantity)
  return 0
}

export function returnedQuantityForLine(order, lineId, startDate, endDate) {
  return (order.returns || []).reduce((sum, entry) => {
    if (entry.lineId !== lineId) return sum
    const accepted = qty(entry.acceptedQuantity)
    if (!accepted) return sum
    const day = dayOf(entry.verifiedAt || entry.at)
    if (!inRange(day, startDate, endDate)) return sum
    return sum + accepted
  }, 0)
}

export function summarizePharmacyUsage(orders = [], startDate, endDate) {
  const medicines = new Map()
  const patients = new Map()

  function medRow(item) {
    const key = medicineKey(item) || item.name || 'unknown'
    if (!medicines.has(key)) {
      medicines.set(key, {
        key,
        name: item.name || 'Medicine',
        unit: item.unit || '',
        issuedQuantity: 0,
        returnedQuantity: 0,
        netQuantity: 0,
        issuedValue: 0,
        patients: new Set(),
      })
    }
    return medicines.get(key)
  }

  function patientRow(order) {
    const key = order.patientId || order.admissionId || 'unknown'
    if (!patients.has(key)) {
      patients.set(key, {
        patientId: order.patientId || '',
        patientName: order.patientName || '',
        admissionId: order.admissionId || '',
        issuedQuantity: 0,
        returnedQuantity: 0,
        netQuantity: 0,
        issuedValue: 0,
        medicines: new Set(),
      })
    }
    return patients.get(key)
  }

  for (const order of orders) {
    const patient = patientRow(order)
    for (const item of order.items || []) {
      const issued = issuedQuantityForItem(item, startDate, endDate, order.requestedAt)
      const returned = returnedQuantityForLine(order, item.lineId, startDate, endDate)
      if (!issued && !returned) continue
      const med = medRow(item)
      const value = money(issued, item.unitPrice)
      med.issuedQuantity += issued
      med.returnedQuantity += returned
      med.issuedValue += value
      if (issued) med.patients.add(order.patientId || order.admissionId || '')
      patient.issuedQuantity += issued
      patient.returnedQuantity += returned
      patient.issuedValue += value
      if (issued) patient.medicines.add(medicineKey(item) || item.name)
    }
    patient.netQuantity = patient.issuedQuantity - patient.returnedQuantity
  }

  const topMedicines = [...medicines.values()]
    .map((row) => ({
      name: row.name,
      unit: row.unit,
      issuedQuantity: row.issuedQuantity,
      returnedQuantity: row.returnedQuantity,
      netQuantity: row.issuedQuantity - row.returnedQuantity,
      issuedValue: Math.round(row.issuedValue * 100) / 100,
      patientCount: [...row.patients].filter(Boolean).length,
    }))
    .filter((row) => row.issuedQuantity > 0 || row.returnedQuantity > 0)
    .sort((a, b) => b.issuedQuantity - a.issuedQuantity || b.netQuantity - a.netQuantity || a.name.localeCompare(b.name))

  const topPatients = [...patients.values()]
    .map((row) => ({
      patientId: row.patientId,
      patientName: row.patientName,
      admissionId: row.admissionId,
      issuedQuantity: row.issuedQuantity,
      returnedQuantity: row.returnedQuantity,
      netQuantity: row.netQuantity,
      issuedValue: Math.round(row.issuedValue * 100) / 100,
      medicineCount: row.medicines.size,
    }))
    .filter((row) => row.issuedQuantity > 0 || row.returnedQuantity > 0)
    .sort((a, b) => b.issuedQuantity - a.issuedQuantity || b.medicineCount - a.medicineCount || (a.patientName || '').localeCompare(b.patientName || ''))

  const issuedQuantity = topMedicines.reduce((sum, row) => sum + row.issuedQuantity, 0)
  const returnedQuantity = topMedicines.reduce((sum, row) => sum + row.returnedQuantity, 0)
  const issuedValue = topMedicines.reduce((sum, row) => sum + row.issuedValue, 0)

  return {
    summary: {
      medicines: topMedicines.length,
      patients: topPatients.length,
      issuedQuantity,
      returnedQuantity,
      netQuantity: issuedQuantity - returnedQuantity,
      issuedValue: Math.round(issuedValue * 100) / 100,
    },
    topMedicines: topMedicines.slice(0, TOP_LIMIT),
    topPatients: topPatients.slice(0, TOP_LIMIT),
  }
}

export async function buildManagerPharmacyReport(auth, query = {}, injected = {}) {
  forbid(roleHasPermission(auth?.role, 'reports.view'))
  const today = injected.today || todayStr()
  const period = resolveDepositsPeriod(query.view || 'month', query.date, today)
  const queryEnd = period.endDate > period.today ? period.today : period.endDate
  const PharmacyOrderModel = injected.PharmacyOrder || PharmacyOrder
  const startIso = `${period.startDate}T00:00:00.000Z`
  const endIso = `${queryEnd}T23:59:59.999Z`
  const orders = await PharmacyOrderModel.find({
    $or: [
      { requestedAt: { $gte: period.startDate, $lte: `${queryEnd}T23:59:59.999Z` } },
      { updatedAt: { $gte: new Date(startIso), $lte: new Date(endIso) } },
    ],
  }).lean()

  const usage = summarizePharmacyUsage(orders, period.startDate, queryEnd)
  return {
    view: period.view,
    date: period.date,
    startDate: period.startDate,
    endDate: queryEnd,
    today: period.today,
    generatedAt: new Date().toISOString(),
    ...usage,
  }
}
