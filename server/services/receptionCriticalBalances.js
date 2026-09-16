import { Patient } from '../models/Patient.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { roleHasPermission } from '../utils/permissions.js'
import { escapeRegex } from './globalSearch.js'
import { recordTotalExpr } from './managerDashboard.js'
import {
  balanceStatus,
  DEFAULT_LOW_BALANCE_THRESHOLD,
} from './receptionDashboard.js'

const INPATIENT_STATUSES = ['admitted', 'pending-discharge']

export const RECEPTION_CRITICAL_BALANCES_PERMISSIONS = ['patients.view', 'payments.view']

function defaultDeps() {
  return { Patient, ServiceRecord, HospitalSettings }
}

function forbidUnless(allowed) {
  if (allowed) return
  const error = new Error('Forbidden')
  error.status = 403
  throw error
}

async function loadThreshold(HospitalSettingsModel) {
  if (!HospitalSettingsModel?.findOne) return DEFAULT_LOW_BALANCE_THRESHOLD
  const found = HospitalSettingsModel.findOne({ key: 'default' })
  const settings = (typeof found?.lean === 'function' ? await found.lean() : await found) || {}
  return settings.lowBalanceThreshold ?? DEFAULT_LOW_BALANCE_THRESHOLD
}

function stayFilter(query) {
  const status = String(query.status || '').trim()
  const filter = {
    status: INPATIENT_STATUSES.includes(status) ? status : { $in: INPATIENT_STATUSES },
  }
  const q = String(query.q || '').trim()
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ name: rx }, { patientId: rx }]
  }
  return filter
}

async function approvedChargesByPatient(ServiceRecordModel, patientIds) {
  if (!patientIds.length) return {}
  const rows = await ServiceRecordModel.aggregate([
    { $match: { status: 'approved', patientId: { $in: patientIds } } },
    { $addFields: { recordTotal: recordTotalExpr() } },
    { $group: { _id: '$patientId', total: { $sum: '$recordTotal' } } },
  ])
  return Object.fromEntries(rows.map((row) => [row._id, row.total]))
}

export async function buildReceptionCriticalBalances(auth, query = {}, injected = {}) {
  forbidUnless(roleHasPermission(auth?.role, 'payments.view'))
  const deps = { ...defaultDeps(), ...injected }
  const includeCredit = roleHasPermission(auth?.role, 'credit.view')
  const threshold = await loadThreshold(deps.HospitalSettings)

  const found = deps.Patient.find(stayFilter(query))
    .select('patientId name room bed status admissionDate depositTotal isCreditPatient')
    .sort({ admissionDate: -1, createdAt: -1 })
  const stays = typeof found?.lean === 'function' ? await found.lean() : await found
  const ids = stays.map((doc) => doc.patientId).filter(Boolean)
  const charges = await approvedChargesByPatient(deps.ServiceRecord, ids)

  const rows = stays
    .map((doc) => {
      const depositTotal = doc.depositTotal || 0
      const totalCharges = charges[doc.patientId] || 0
      const remaining = depositTotal - totalCharges
      return {
        id: doc.patientId,
        patientName: doc.name || '',
        patientId: doc.patientId,
        room: doc.room || null,
        bed: doc.bed || null,
        status: doc.status,
        admissionDate: doc.admissionDate || null,
        depositTotal,
        totalCharges,
        remaining,
        balanceStatus: balanceStatus(remaining, threshold),
        isCreditPatient: includeCredit ? Boolean(doc.isCreditPatient) : undefined,
      }
    })
    .filter((row) => row.balanceStatus === 'critical')
    .sort((a, b) => a.remaining - b.remaining)
    .map((row) => {
      if (!includeCredit) {
        const { isCreditPatient, ...rest } = row
        return rest
      }
      return row
    })

  const remainingTotal = rows.reduce((sum, row) => sum + row.remaining, 0)
  return {
    threshold,
    summary: {
      patients: rows.length,
      remainingTotal,
    },
    rows,
    generatedAt: new Date().toISOString(),
  }
}

export { INPATIENT_STATUSES }
