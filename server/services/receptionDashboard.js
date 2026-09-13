import { Patient } from '../models/Patient.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { Deposit } from '../models/Deposit.js'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { todayStr } from '../utils/dates.js'
import { roleHasPermission } from '../utils/permissions.js'
import { recordTotalExpr } from './managerDashboard.js'

export const RECEPTION_DASHBOARD_PERMISSION = 'patients.view'

const INPATIENT_STATUSES = ['admitted', 'pending-discharge']
const PENDING_PANEL_LIMIT = 4
const DEFAULT_LOW_BALANCE_THRESHOLD = 3000

export function balanceStatus(remaining, threshold = DEFAULT_LOW_BALANCE_THRESHOLD) {
  const limit = Number(threshold) || DEFAULT_LOW_BALANCE_THRESHOLD
  if (remaining >= limit * 2) return 'sufficient'
  if (remaining >= limit) return 'low'
  return 'critical'
}

export function recordTypeForPanel(recordType) {
  return recordType === 'return' ? 'pharmacy_return' : 'daily_services'
}

export function recordAmount(doc) {
  if (doc.recordType === 'return') {
    return -(doc.returnItems?.reduce((sum, line) => sum + (line.total || 0), 0) || 0)
  }
  return doc.services?.reduce((sum, line) => sum + (line.total || 0), 0) || 0
}

export function mapPendingRecord(doc, patientName = '') {
  const amount = recordAmount(doc)
  const itemCount =
    doc.recordType === 'return' ? doc.returnItems?.length || 0 : doc.services?.length || 0
  return {
    id: String(doc._id),
    patientId: doc.patientId,
    patientName: patientName || '',
    recordName: doc.recordName || '',
    type: recordTypeForPanel(doc.recordType),
    status: doc.status,
    recordedBy: doc.submittedBy || '',
    recordedAt: doc.recordedAt?.toISOString?.() || doc.createdAt?.toISOString?.() || null,
    itemCount,
    amount,
  }
}

export function mapInpatient(doc, extras = {}, { includeMoney } = {}) {
  const row = {
    id: doc.patientId,
    name: doc.name || '',
    room: doc.room || null,
    bed: doc.bed || null,
    admissionDate: doc.admissionDate || null,
    stayStatus: doc.status,
  }
  if (includeMoney) {
    row.deposit = extras.depositTotal ?? doc.depositTotal ?? 0
    row.totalCharges = extras.totalCharges || 0
    row.remaining = extras.remaining ?? row.deposit - row.totalCharges
    row.pendingCharges = extras.pendingCharges || 0
    row.balanceStatus = extras.balanceStatus || balanceStatus(row.remaining, extras.threshold)
  }
  return row
}

function defaultDeps() {
  return {
    Patient,
    ServiceRecord,
    Deposit,
    HospitalSettings,
    today: todayStr(),
  }
}

async function loadThreshold(HospitalSettingsModel) {
  const found = HospitalSettingsModel.findOne({ key: 'default' })
  const settings = (typeof found?.lean === 'function' ? await found.lean() : await found) || {}
  return settings.lowBalanceThreshold ?? DEFAULT_LOW_BALANCE_THRESHOLD
}

async function sumDepositsToday(DepositModel, today) {
  const [row] = await DepositModel.aggregate([
    { $match: { date: today } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  return row?.total || 0
}

async function totalsByPatient(ServiceRecordModel, patientIds, status) {
  if (!patientIds.length) return []
  return ServiceRecordModel.aggregate([
    { $match: { status, patientId: { $in: patientIds } } },
    { $addFields: { recordTotal: recordTotalExpr() } },
    { $group: { _id: '$patientId', total: { $sum: '$recordTotal' } } },
  ])
}

async function leanFind(query) {
  if (query && typeof query.lean === 'function') return query.lean()
  return query
}

function inpatientFind(PatientModel) {
  return PatientModel.find({ status: { $in: INPATIENT_STATUSES } })
    .select('patientId name room bed status admissionDate depositTotal')
    .sort({ admissionDate: -1, createdAt: -1 })
}

export async function buildReceptionDashboard(auth, injected = {}) {
  const deps = { ...defaultDeps(), ...injected }
  const can = (key) => roleHasPermission(auth?.role, key)
  const includeMoney = can('payments.view') || can('credit.view')
  const includeDeposits = can('payments.view')
  const today = deps.today
  const threshold = includeMoney ? await loadThreshold(deps.HospitalSettings) : DEFAULT_LOW_BALANCE_THRESHOLD

  const [admitted, pendingDischarge, pendingApprovals, pendingList, inpatientRows, todayDeposits] = await Promise.all([
    deps.Patient.countDocuments({ status: 'admitted' }),
    deps.Patient.countDocuments({ status: 'pending-discharge' }),
    deps.ServiceRecord.countDocuments({ status: 'pending' }),
    leanFind(
      deps.ServiceRecord.find({ status: 'pending' })
        .sort({ recordedAt: -1, createdAt: -1 })
        .limit(PENDING_PANEL_LIMIT)
        .select('patientId recordName recordType status submittedBy recordedAt createdAt services returnItems')
    ),
    leanFind(inpatientFind(deps.Patient)),
    includeDeposits ? sumDepositsToday(deps.Deposit, today) : Promise.resolve(null),
  ])

  const nameIds = [...new Set((pendingList || []).map((doc) => doc.patientId).filter(Boolean))]
  const nameDocs = nameIds.length
    ? await leanFind(deps.Patient.find({ patientId: { $in: nameIds } }).select('patientId name'))
    : []
  const namesById = Object.fromEntries(nameDocs.map((doc) => [doc.patientId, doc.name]))
  const ids = inpatientRows.map((doc) => doc.patientId).filter(Boolean)
  let chargeMap = {}
  let pendingMap = {}
  if (includeMoney && ids.length) {
    const [approved, pending] = await Promise.all([
      totalsByPatient(deps.ServiceRecord, ids, 'approved'),
      totalsByPatient(deps.ServiceRecord, ids, 'pending'),
    ])
    chargeMap = Object.fromEntries(approved.map((row) => [row._id, row.total]))
    pendingMap = Object.fromEntries(pending.map((row) => [row._id, row.total]))
  }

  const currentInpatients = inpatientRows.map((doc) => {
    const depositTotal = doc.depositTotal || 0
    const totalCharges = chargeMap[doc.patientId] || 0
    const remaining = depositTotal - totalCharges
    return mapInpatient(
      doc,
      {
        depositTotal,
        totalCharges,
        remaining,
        pendingCharges: pendingMap[doc.patientId] || 0,
        balanceStatus: balanceStatus(remaining, threshold),
        threshold,
      },
      { includeMoney }
    )
  })

  const lowBalanceCount = includeMoney
    ? currentInpatients.filter((row) => row.balanceStatus && row.balanceStatus !== 'sufficient').length
    : null

  const payload = {
    generatedAt: new Date().toISOString(),
    census: { admitted, pendingDischarge },
    workQueue: { pendingApprovals, pendingDischarges: pendingDischarge },
    pendingRecords: pendingList.map((doc) => mapPendingRecord(doc, namesById[doc.patientId] || '')),
    currentInpatients,
    canReview: can('admissions.edit') || can('patients.edit'),
  }

  if (includeDeposits) payload.finance = { todayDeposits }
  if (includeMoney) payload.watchlist = { lowBalanceCount }

  return payload
}

export { PENDING_PANEL_LIMIT, DEFAULT_LOW_BALANCE_THRESHOLD }
