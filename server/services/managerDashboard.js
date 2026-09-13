import { Patient } from '../models/Patient.js'
import { Bed } from '../models/Bed.js'
import { Deposit } from '../models/Deposit.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { todayStr, localDayRange, shiftDate } from '../utils/dates.js'
import { roleHasPermission } from '../utils/permissions.js'
import { occupancyFromStatusCounts } from './adminDashboard.js'

export const MANAGER_DASHBOARD_PERMISSION = 'reports.view'

const INPATIENT_STATUSES = ['admitted', 'pending-discharge']
const BED_STATUSES = ['available', 'occupied', 'maintenance', 'out_of_service']
const TOP_LIMIT = 5
const RECENT_LIMIT = 8
const WATCHLIST_LIMIT = 8
const DEFAULT_LOW_BALANCE_THRESHOLD = 3000
const DEFAULT_HOSPITAL_NAME = 'Central City Hospital'
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function monthPrefix(today) {
  return String(today || '').slice(0, 7)
}

export function localWeekdayShort(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  if (!y || !m || !d) return ''
  return WEEKDAY_SHORT[new Date(y, m - 1, d).getDay()]
}

export function lastSevenLocalDates(today) {
  const dates = []
  for (let i = 6; i >= 0; i -= 1) {
    dates.push(shiftDate(today, -i))
  }
  return dates.filter(Boolean)
}

export function recordTotalExpr() {
  return {
    $cond: [
      { $eq: ['$recordType', 'return'] },
      { $multiply: [-1, { $ifNull: [{ $sum: '$returnItems.total' }, 0] }] },
      { $ifNull: [{ $sum: '$services.total' }, 0] },
    ],
  }
}

export function outstandingForStay(depositTotal, totalCharges) {
  return Math.max(0, (Number(totalCharges) || 0) - (Number(depositTotal) || 0))
}

export function remainingCredit(depositTotal, totalCharges) {
  return (Number(depositTotal) || 0) - (Number(totalCharges) || 0)
}

/** Existing product rule: remaining deposit-minus-charges below 2 × configured threshold. */
export function isBalanceAttention(remaining, threshold) {
  return remaining < (Number(threshold) || DEFAULT_LOW_BALANCE_THRESHOLD) * 2
}

export function mapRecentAdmission(doc) {
  return {
    id: doc.patientId,
    patientName: doc.name || '',
    admissionDate: doc.admissionDate || null,
    room: doc.room || null,
    bed: doc.bed || null,
    status: doc.status,
  }
}

export function mapWatchlistPatient(doc) {
  const row = {
    id: doc.patientId,
    patientName: doc.name || '',
    admissionDate: doc.admissionDate || null,
    room: doc.room || null,
    bed: doc.bed || null,
    status: doc.status,
  }
  if (typeof doc.remaining === 'number') row.remaining = doc.remaining
  return row
}

function defaultDeps() {
  return {
    Patient,
    Bed,
    Deposit,
    ServiceRecord,
    HospitalSettings,
    today: todayStr(),
  }
}

async function countBedsByStatus(BedModel) {
  const groups = await BedModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }])
  const counts = Object.fromEntries(BED_STATUSES.map((status) => [status, 0]))
  let extra = 0
  for (const row of groups) {
    if (row._id && counts[row._id] !== undefined) counts[row._id] = row.count
    else extra += row.count || 0
  }
  const beds = occupancyFromStatusCounts(counts)
  if (extra) {
    beds.total += extra
    beds.occupancyPercentage = beds.total === 0 ? 0 : Math.round((beds.occupied / beds.total) * 100)
  }
  return {
    occupied: beds.occupied,
    available: beds.available,
    maintenance: beds.maintenance,
    outOfService: beds.outOfService,
    total: beds.total,
    percentage: beds.occupancyPercentage,
  }
}

async function sumDeposits(DepositModel, match) {
  const [row] = await DepositModel.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  return row?.total || 0
}

async function sumApprovedCharges(ServiceRecordModel, dateMatch) {
  const [row] = await ServiceRecordModel.aggregate([
    { $match: { status: 'approved', ...dateMatch } },
    { $addFields: { recordTotal: recordTotalExpr() } },
    { $group: { _id: null, total: { $sum: '$recordTotal' } } },
  ])
  return row?.total || 0
}

async function totalsByDate(Model, { match, amountExpr, dates }) {
  const rows = await Model.aggregate([
    { $match: match },
    { $addFields: { _amount: amountExpr } },
    { $group: { _id: '$date', total: { $sum: '$_amount' } } },
  ])
  const map = Object.fromEntries(rows.map((row) => [row._id, row.total]))
  return dates.map((date) => ({
    date,
    day: localWeekdayShort(date),
    amount: map[date] || 0,
  }))
}

async function chargesByCategory(ServiceRecordModel) {
  return ServiceRecordModel.aggregate([
    { $match: { status: 'approved', recordType: { $ne: 'return' } } },
    { $unwind: '$services' },
    {
      $group: {
        _id: { $ifNull: ['$services.category', 'Other'] },
        amount: { $sum: { $ifNull: ['$services.total', 0] } },
      },
    },
    { $sort: { amount: -1 } },
    { $project: { _id: 0, name: '$_id', amount: 1 } },
  ])
}

async function topServiceLines(ServiceRecordModel, lineMatch = null) {
  const pipeline = [
    { $match: { status: 'approved', recordType: { $ne: 'return' } } },
    { $unwind: '$services' },
  ]
  if (lineMatch) pipeline.push({ $match: lineMatch })
  pipeline.push(
    {
      $group: {
        _id: '$services.serviceName',
        count: { $sum: { $ifNull: ['$services.quantity', 1] } },
        amount: { $sum: { $ifNull: ['$services.total', 0] } },
      },
    },
    { $sort: { amount: -1 } },
    { $limit: TOP_LIMIT },
    { $project: { _id: 0, name: '$_id', count: 1, amount: 1 } }
  )
  return ServiceRecordModel.aggregate(pipeline)
}

async function chargesByPatientIds(ServiceRecordModel, patientIds) {
  if (!patientIds.length) return []
  return ServiceRecordModel.aggregate([
    { $match: { status: 'approved', patientId: { $in: patientIds } } },
    { $addFields: { recordTotal: recordTotalExpr() } },
    { $group: { _id: '$patientId', totalCharges: { $sum: '$recordTotal' } } },
  ])
}

async function loadSettings(HospitalSettingsModel) {
  const found = HospitalSettingsModel.findOne({ key: 'default' })
  const settings = (typeof found?.lean === 'function' ? await found.lean() : await found) || {}
  return {
    hospitalName: settings.name || DEFAULT_HOSPITAL_NAME,
    lowBalanceThreshold: settings.lowBalanceThreshold ?? DEFAULT_LOW_BALANCE_THRESHOLD,
  }
}

function inpatientFind(PatientModel) {
  const query = PatientModel.find({ status: { $in: INPATIENT_STATUSES } })
    .select('patientId name room bed status admissionDate depositTotal')
    .sort({ admissionDate: -1, createdAt: -1 })
  if (typeof query.lean === 'function') return query.lean()
  return query
}

function attachBalances(inpatients, chargeRows) {
  const charges = Object.fromEntries((chargeRows || []).map((row) => [row._id, row.totalCharges]))
  return inpatients.map((doc) => {
    const totalCharges = charges[doc.patientId] || 0
    const depositTotal = doc.depositTotal || 0
    return {
      ...doc,
      totalCharges,
      depositTotal,
      remaining: remainingCredit(depositTotal, totalCharges),
      outstanding: outstandingForStay(depositTotal, totalCharges),
    }
  })
}

async function collectMetrics(auth, injected, { includeFinance, includeCredit, includeCensus, includeOccupancy }) {
  const deps = { ...defaultDeps(), ...injected }
  const today = deps.today
  const month = monthPrefix(today)
  const day = localDayRange(today)
  const weekDates = lastSevenLocalDates(today)
  const settings = await loadSettings(deps.HospitalSettings)

  const jobs = {
    occupancy: includeOccupancy ? countBedsByStatus(deps.Bed) : Promise.resolve(null),
    census: includeCensus
      ? Promise.all([
          deps.Patient.countDocuments({ status: 'admitted' }),
          deps.Patient.countDocuments({ status: 'pending-discharge' }),
          deps.Patient.countDocuments({ admissionDate: today }),
          day
            ? deps.Patient.countDocuments({
                status: 'discharged',
                dischargeCompletedAt: { $gte: day.start, $lt: day.end },
              })
            : Promise.resolve(0),
        ])
      : Promise.resolve(null),
    depositsToday: includeFinance ? sumDeposits(deps.Deposit, { date: today }) : Promise.resolve(null),
    depositsMonth: includeFinance
      ? sumDeposits(deps.Deposit, { date: { $regex: `^${month}` } })
      : Promise.resolve(null),
    chargesToday: includeFinance ? sumApprovedCharges(deps.ServiceRecord, { date: today }) : Promise.resolve(null),
    chargesMonth: includeFinance
      ? sumApprovedCharges(deps.ServiceRecord, { date: { $regex: `^${month}` } })
      : Promise.resolve(null),
    dailyCharges: includeFinance
      ? totalsByDate(deps.ServiceRecord, {
          match: { status: 'approved', date: { $in: weekDates } },
          amountExpr: recordTotalExpr(),
          dates: weekDates,
        })
      : Promise.resolve(null),
    dailyDeposits: includeFinance
      ? totalsByDate(deps.Deposit, {
          match: { date: { $in: weekDates } },
          amountExpr: '$amount',
          dates: weekDates,
        })
      : Promise.resolve(null),
    categories: includeFinance ? chargesByCategory(deps.ServiceRecord) : Promise.resolve(null),
    topServices: includeFinance ? topServiceLines(deps.ServiceRecord) : Promise.resolve(null),
    topMedicines: includeFinance
      ? topServiceLines(deps.ServiceRecord, { 'services.category': 'Pharmacy' })
      : Promise.resolve(null),
    inpatients:
      includeCensus || includeCredit ? inpatientFind(deps.Patient) : Promise.resolve([]),
    creditAdmissions: includeCredit
      ? deps.Patient.countDocuments({ status: { $ne: 'discharged' }, isCreditPatient: true })
      : Promise.resolve(null),
  }

  const raw = {}
  await Promise.all(
    Object.entries(jobs).map(async ([key, promise]) => {
      raw[key] = await promise
    })
  )

  let balanced = raw.inpatients || []
  if (includeCredit && raw.inpatients?.length) {
    const chargeRows = await chargesByPatientIds(
      deps.ServiceRecord,
      raw.inpatients.map((doc) => doc.patientId).filter(Boolean)
    )
    balanced = attachBalances(raw.inpatients, chargeRows)
  }

  return { today, month, settings, weekDates, raw, balanced }
}

function shapeDashboard({ includeFinance, includeCredit, includeCensus, includeOccupancy, collected }) {
  const payload = {
    generatedAt: new Date().toISOString(),
    hospitalName: collected.settings.hospitalName,
  }

  if (includeCensus && collected.raw.census) {
    const [admitted, pendingDischarge, admittedToday, dischargedToday] = collected.raw.census
    payload.census = { admitted, pendingDischarge, admittedToday, dischargedToday }
  }

  if (includeOccupancy && collected.raw.occupancy) {
    payload.occupancy = collected.raw.occupancy
  }

  if (includeFinance) {
    payload.finance = {
      deposits: {
        today: collected.raw.depositsToday || 0,
        month: collected.raw.depositsMonth || 0,
      },
      approvedCharges: {
        today: collected.raw.chargesToday || 0,
        month: collected.raw.chargesMonth || 0,
      },
    }
    if (includeCredit) {
      payload.finance.outstandingBalance = collected.balanced.reduce((sum, row) => sum + row.outstanding, 0)
      payload.finance.creditAdmissions = collected.raw.creditAdmissions || 0
    }
    payload.chargesByCategory = collected.raw.categories || []
    payload.dailyChargesTrend = collected.raw.dailyCharges || []
    payload.topServices = collected.raw.topServices || []
    payload.topMedicines = collected.raw.topMedicines || []
  }

  if (includeCredit) {
    const threshold = collected.settings.lowBalanceThreshold
    const flagged = collected.balanced.filter((row) => isBalanceAttention(row.remaining, threshold))
    payload.watchlist = {
      lowBalanceCount: flagged.length,
      lowBalancePatients: flagged.slice(0, WATCHLIST_LIMIT).map(mapWatchlistPatient),
    }
  }

  if (includeCensus) {
    payload.recentAdmissions = collected.balanced.slice(0, RECENT_LIMIT).map(mapRecentAdmission)
  }

  return payload
}

export async function buildManagerDashboard(auth, injected = {}) {
  const can = (key) => roleHasPermission(auth?.role, key)
  const includeCensus = can('patients.view') || can('admissions.view')
  const includeFinance = can('payments.view')
  const includeCredit = can('credit.view')
  const includeOccupancy = true

  const collected = await collectMetrics(auth, injected, {
    includeFinance,
    includeCredit,
    includeCensus,
    includeOccupancy,
  })

  return shapeDashboard({
    includeFinance,
    includeCredit,
    includeCensus,
    includeOccupancy,
    collected,
  })
}

export async function buildManagerReportSnapshot(auth, injected = {}) {
  const collected = await collectMetrics(auth, injected, {
    includeFinance: true,
    includeCredit: true,
    includeCensus: true,
    includeOccupancy: true,
  })

  const recentPatients = collected.balanced.slice(0, 10).map((row) => ({
    id: row.patientId,
    name: row.name,
    deposit: row.depositTotal,
    balance: row.remaining,
    admissionDate: row.admissionDate,
    room: row.room,
    bed: row.bed,
  }))

  const dailyRevenueTrend = collected.weekDates.map((date, i) => ({
    day: localWeekdayShort(date),
    date,
    revenue:
      (collected.raw.dailyDeposits?.[i]?.amount || 0) + (collected.raw.dailyCharges?.[i]?.amount || 0),
  }))

  return {
    stats: {
      todayRevenue: (collected.raw.depositsToday || 0) + (collected.raw.chargesToday || 0),
      monthlyRevenue: (collected.raw.depositsMonth || 0) + (collected.raw.chargesMonth || 0),
      totalDeposits: collected.balanced.reduce((sum, row) => sum + (row.depositTotal || 0), 0),
      outstandingBalance: collected.balanced.reduce((sum, row) => sum + row.outstanding, 0),
      inpatientCount: collected.balanced.length,
      nearLowBalance: collected.balanced.filter((row) =>
        isBalanceAttention(row.remaining, collected.settings.lowBalanceThreshold)
      ).length,
      todayDeposits: collected.raw.depositsToday || 0,
      occupancyRate: collected.raw.occupancy?.percentage || 0,
    },
    revenueByDepartment: (collected.raw.categories || []).map((row) => ({
      name: row.name,
      revenue: row.amount,
    })),
    dailyRevenueTrend,
    topServices: (collected.raw.topServices || []).map((row) => ({
      name: row.name,
      count: row.count,
      revenue: row.amount,
    })),
    topMedicines: (collected.raw.topMedicines || []).map((row) => ({
      name: row.name,
      count: row.count,
      revenue: row.amount,
    })),
    recentPatients,
    hospitalName: collected.settings.hospitalName,
  }
}

export { INPATIENT_STATUSES, TOP_LIMIT, RECENT_LIMIT, WATCHLIST_LIMIT, DEFAULT_LOW_BALANCE_THRESHOLD }
