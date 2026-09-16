import { Patient } from '../models/Patient.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { roleHasPermission } from '../utils/permissions.js'
import { computeCreditState } from '../utils/credit.js'
import { todayStr, eachDateInclusive } from '../utils/dates.js'
import { escapeRegex } from './globalSearch.js'
import { resolveDepositsPeriod } from './managerDeposits.js'
import {
  recordTotalExpr,
  outstandingForStay,
  remainingCredit,
  DEFAULT_LOW_BALANCE_THRESHOLD,
} from './managerDashboard.js'

export const MANAGER_CHARGES_PERMISSIONS = ['reports.view', 'payments.view']
export const MANAGER_OUTSTANDING_PERMISSIONS = ['reports.view', 'payments.view']
export const MANAGER_CREDIT_PERMISSIONS = ['reports.view', 'credit.view']

const INPATIENT_STATUSES = ['admitted', 'pending-discharge']
const ROOM_KIND = 'Room'
const DOCTOR_KIND = 'Visiting Doctor'
const RETURN_KIND = 'Pharmacy return'

function defaultDeps() {
  return { Patient, ServiceRecord, HospitalSettings, today: todayStr() }
}

function forbid(unless) {
  if (unless) return
  const error = new Error('Forbidden')
  error.status = 403
  throw error
}

function clampPeriod(query, today) {
  const period = resolveDepositsPeriod(query.view, query.date, today)
  const queryEnd = period.endDate > period.today ? period.today : period.endDate
  return { ...period, queryEnd }
}

function average(total, count) {
  if (!count) return 0
  return total / count
}

export function categoryRecordMatch(category) {
  const name = String(category || '').trim()
  if (!name) return {}
  if (name === ROOM_KIND) return { autoType: 'room' }
  if (name === DOCTOR_KIND) return { autoType: 'doctor' }
  if (name === RETURN_KIND) return { recordType: 'return' }
  return {
    recordType: { $ne: 'return' },
    autoType: null,
    'services.category': name,
  }
}

function approvedMatch(startDate, endDate, category) {
  return {
    status: 'approved',
    date: { $gte: startDate, $lte: endDate },
    ...categoryRecordMatch(category),
  }
}

function kindLabelExpr() {
  return {
    $switch: {
      branches: [
        { case: { $eq: ['$recordType', 'return'] }, then: RETURN_KIND },
        { case: { $eq: ['$autoType', 'room'] }, then: ROOM_KIND },
        { case: { $eq: ['$autoType', 'doctor'] }, then: DOCTOR_KIND },
      ],
      default: {
        $ifNull: [{ $arrayElemAt: ['$services.category', 0] }, 'Service'],
      },
    },
  }
}

function descriptionExpr() {
  return {
    $cond: [
      { $eq: ['$recordType', 'return'] },
      RETURN_KIND,
      {
        $ifNull: [
          '$recordName',
          { $ifNull: [{ $arrayElemAt: ['$services.serviceName', 0] }, 'Approved charge'] },
        ],
      },
    ],
  }
}

async function sumApproved(ServiceRecordModel, match) {
  const [row] = await ServiceRecordModel.aggregate([
    { $match: match },
    { $addFields: { recordTotal: recordTotalExpr() } },
    { $group: { _id: null, total: { $sum: '$recordTotal' }, records: { $sum: 1 } } },
  ])
  const total = row?.total || 0
  const records = row?.records || 0
  return { total, records, average: average(total, records) }
}

async function breakdownApproved(ServiceRecordModel, startDate, endDate) {
  const match = { status: 'approved', date: { $gte: startDate, $lte: endDate } }
  const [returns, autos, categories] = await Promise.all([
    ServiceRecordModel.aggregate([
      { $match: { ...match, recordType: 'return' } },
      {
        $group: {
          _id: RETURN_KIND,
          records: { $sum: 1 },
          amount: { $sum: { $multiply: [-1, { $ifNull: [{ $sum: '$returnItems.total' }, 0] }] } },
        },
      },
    ]),
    ServiceRecordModel.aggregate([
      { $match: { ...match, recordType: { $ne: 'return' }, autoType: { $in: ['room', 'doctor'] } } },
      { $addFields: { recordTotal: { $ifNull: [{ $sum: '$services.total' }, 0] } } },
      {
        $group: {
          _id: {
            $cond: [{ $eq: ['$autoType', 'room'] }, ROOM_KIND, DOCTOR_KIND],
          },
          records: { $sum: 1 },
          amount: { $sum: '$recordTotal' },
        },
      },
    ]),
    ServiceRecordModel.aggregate([
      { $match: { ...match, recordType: { $ne: 'return' }, autoType: null } },
      { $unwind: '$services' },
      {
        $group: {
          _id: { $ifNull: ['$services.category', 'Other'] },
          records: { $sum: 1 },
          amount: { $sum: { $ifNull: ['$services.total', 0] } },
        },
      },
    ]),
  ])

  return [...autos, ...categories, ...returns]
    .map((row) => ({
      name: row._id,
      records: row.records || 0,
      amount: row.amount || 0,
    }))
    .filter((row) => row.records > 0)
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
}

async function dailyChargeTotals(ServiceRecordModel, startDate, endDate, category) {
  const dates = eachDateInclusive(startDate, endDate)
  const grouped = await ServiceRecordModel.aggregate([
    { $match: approvedMatch(startDate, endDate, category) },
    { $addFields: { recordTotal: recordTotalExpr() } },
    { $group: { _id: '$date', total: { $sum: '$recordTotal' }, records: { $sum: 1 } } },
  ])
  const map = Object.fromEntries(grouped.map((row) => [row._id, row]))
  return dates.map((date) => {
    const row = map[date]
    const records = row?.records || 0
    const total = row?.total || 0
    return { date, records, total, average: average(total, records) }
  })
}

async function dayChargeRows(ServiceRecordModel, date, category) {
  return ServiceRecordModel.aggregate([
    { $match: approvedMatch(date, date, category) },
    { $sort: { recordedAt: 1, _id: 1 } },
    {
      $lookup: {
        from: 'patients',
        localField: 'patientId',
        foreignField: 'patientId',
        as: 'patient',
      },
    },
    { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        id: { $toString: '$_id' },
        date: 1,
        amount: recordTotalExpr(),
        status: 1,
        recordedBy: { $ifNull: ['$submittedBy', ''] },
        patientId: 1,
        patientName: { $ifNull: ['$patient.name', ''] },
        chargeType: kindLabelExpr(),
        description: descriptionExpr(),
      },
    },
  ])
}

function metricFromBreakdown(breakdown, name) {
  const row = breakdown.find((item) => item.name === name)
  return row ? row.amount : 0
}

export async function buildManagerChargesReport(auth, query = {}, injected = {}) {
  forbid(roleHasPermission(auth?.role, 'payments.view'))
  const deps = { ...defaultDeps(), ...injected }
  const period = clampPeriod(query, deps.today)
  const category = String(query.category || '').trim()
  const match = approvedMatch(period.startDate, period.queryEnd, category)
  const [summary, breakdown] = await Promise.all([
    sumApproved(deps.ServiceRecord, match),
    breakdownApproved(deps.ServiceRecord, period.startDate, period.queryEnd),
  ])

  const rows =
    period.view === 'day'
      ? await dayChargeRows(deps.ServiceRecord, period.date, category)
      : await dailyChargeTotals(deps.ServiceRecord, period.startDate, period.queryEnd, category)

  return {
    view: period.view,
    date: period.date,
    startDate: period.startDate,
    endDate: period.endDate,
    today: period.today,
    category: category || null,
    summary: {
      total: summary.total,
      records: summary.records,
      average: summary.average,
      room: metricFromBreakdown(breakdown, ROOM_KIND),
      doctor: metricFromBreakdown(breakdown, DOCTOR_KIND),
      pharmacy: metricFromBreakdown(breakdown, 'Pharmacy'),
      returns: metricFromBreakdown(breakdown, RETURN_KIND),
    },
    breakdown,
    rows,
    generatedAt: new Date().toISOString(),
  }
}

function inpatientFilter(query) {
  const status = String(query.status || '').trim()
  const filter = {
    status: INPATIENT_STATUSES.includes(status) ? status : { $in: INPATIENT_STATUSES },
  }
  const q = String(query.q || '').trim()
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ name: rx }, { patientId: rx }]
  }
  const credit = String(query.credit || '').trim().toLowerCase()
  if (credit === 'true') filter.isCreditPatient = true
  if (credit === 'false') filter.isCreditPatient = { $ne: true }
  return filter
}

async function attachStayFinances(PatientModel, ServiceRecordModel, filter) {
  const query = PatientModel.find(filter)
    .select(
      'patientId name room bed status admissionDate depositTotal isCreditPatient admissionPaymentMode requiredInitialDeposit'
    )
    .sort({ admissionDate: -1 })
  const stays = typeof query.lean === 'function' ? await query.lean() : await query
  const ids = stays.map((doc) => doc.patientId).filter(Boolean)
  const chargeRows = ids.length
    ? await ServiceRecordModel.aggregate([
        { $match: { status: 'approved', patientId: { $in: ids } } },
        { $addFields: { recordTotal: recordTotalExpr() } },
        { $group: { _id: '$patientId', totalCharges: { $sum: '$recordTotal' } } },
      ])
    : []
  const charges = Object.fromEntries(chargeRows.map((row) => [row._id, row.totalCharges]))
  return stays.map((doc) => {
    const totalCharges = charges[doc.patientId] || 0
    const depositTotal = doc.depositTotal || 0
    const credit = computeCreditState({
      admissionPaymentMode: doc.admissionPaymentMode,
      requiredInitialDeposit: doc.requiredInitialDeposit,
      depositTotal,
    })
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
      remaining: remainingCredit(depositTotal, totalCharges),
      outstanding: outstandingForStay(depositTotal, totalCharges),
      isCreditPatient: Boolean(doc.isCreditPatient),
      admittedOnCredit: credit.admittedOnCredit,
      creditOutstanding: credit.outstandingDeposit,
      depositStatus: credit.depositStatus,
    }
  })
}

function mapOutstandingRow(row, includeCredit) {
  const mapped = {
    id: row.id,
    patientName: row.patientName,
    patientId: row.patientId,
    room: row.room,
    bed: row.bed,
    status: row.status,
    admissionDate: row.admissionDate,
    outstanding: row.outstanding,
    remaining: row.remaining,
  }
  if (includeCredit) mapped.isCreditPatient = row.isCreditPatient
  return mapped
}

async function loadThreshold(HospitalSettingsModel) {
  if (!HospitalSettingsModel?.findOne) return DEFAULT_LOW_BALANCE_THRESHOLD
  const found = HospitalSettingsModel.findOne({ key: 'default' })
  const settings = (typeof found?.lean === 'function' ? await found.lean() : await found) || {}
  return settings.lowBalanceThreshold ?? DEFAULT_LOW_BALANCE_THRESHOLD
}

export async function buildManagerOutstandingReport(auth, query = {}, injected = {}) {
  forbid(roleHasPermission(auth?.role, 'payments.view'))
  const deps = { ...defaultDeps(), ...injected }
  const includeCredit = roleHasPermission(auth?.role, 'credit.view')
  const threshold = await loadThreshold(deps.HospitalSettings)
  const rows = (await attachStayFinances(deps.Patient, deps.ServiceRecord, inpatientFilter(query)))
    .filter((row) => row.outstanding > 0)
    .sort((a, b) => b.outstanding - a.outstanding)
    .map((row) => mapOutstandingRow(row, includeCredit))

  const total = rows.reduce((sum, row) => sum + row.outstanding, 0)
  const highBalance = rows.filter((row) => row.outstanding >= threshold).length
  return {
    summary: {
      total,
      patients: rows.length,
      average: average(total, rows.length),
      highBalance,
    },
    rows,
    generatedAt: new Date().toISOString(),
  }
}

function mapCreditRow(row) {
  return {
    id: row.id,
    patientName: row.patientName,
    patientId: row.patientId,
    room: row.room,
    bed: row.bed,
    status: row.status,
    admissionDate: row.admissionDate,
    depositTotal: row.depositTotal,
    totalCharges: row.totalCharges,
    remaining: row.remaining,
    outstanding: row.outstanding,
    isCreditPatient: row.isCreditPatient,
    admittedOnCredit: row.admittedOnCredit,
    creditOutstanding: row.creditOutstanding,
    depositStatus: row.depositStatus,
  }
}

export async function buildManagerCreditReport(auth, query = {}, injected = {}) {
  forbid(roleHasPermission(auth?.role, 'credit.view'))
  const deps = { ...defaultDeps(), ...injected }
  const filter = inpatientFilter({ ...query, credit: '' })
  filter.isCreditPatient = true
  const rows = (await attachStayFinances(deps.Patient, deps.ServiceRecord, filter)).map(mapCreditRow)
  const creditOutstanding = rows.reduce((sum, row) => sum + (row.creditOutstanding || 0), 0)
  return {
    summary: {
      patients: rows.length,
      creditOutstanding,
      average: average(creditOutstanding, rows.length),
      billingOutstanding: rows.reduce((sum, row) => sum + row.outstanding, 0),
    },
    rows,
    generatedAt: new Date().toISOString(),
  }
}

export { INPATIENT_STATUSES, ROOM_KIND, DOCTOR_KIND, RETURN_KIND }
