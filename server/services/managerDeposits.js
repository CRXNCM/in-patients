import { Deposit } from '../models/Deposit.js'
import { isValidDateString } from '../utils/validation.js'
import {
  todayStr,
  shiftDate,
  eachDateInclusive,
  mondayWeekRange,
  localMonthRange,
  clampToToday,
} from '../utils/dates.js'
import { roleHasPermission } from '../utils/permissions.js'

export const MANAGER_DEPOSITS_PERMISSIONS = ['reports.view', 'payments.view']

function defaultDeps() {
  return { Deposit, today: todayStr() }
}

export function resolveDepositsPeriod(view, rawDate, today = todayStr()) {
  const requestedView = String(view || 'day').toLowerCase()
  if (!['day', 'week', 'month'].includes(requestedView)) {
    const error = new Error('View must be day, week, or month.')
    error.status = 400
    throw error
  }

  const requested = rawDate ? String(rawDate).trim() : today
  if (requested && !isValidDateString(requested)) {
    const error = new Error('Date is not valid.')
    error.status = 400
    throw error
  }

  const date = clampToToday(requested || today, today)
  if (requestedView === 'week') {
    const week = mondayWeekRange(date)
    return { view: requestedView, date, startDate: week.startDate, endDate: week.endDate, today }
  }
  if (requestedView === 'month') {
    const month = localMonthRange(date)
    return { view: requestedView, date, startDate: month.startDate, endDate: month.endDate, today }
  }
  return { view: requestedView, date, startDate: date, endDate: date, today }
}

function averageDeposit(total, transactions) {
  if (!transactions) return 0
  return total / transactions
}

function fillDailyRows(dates, grouped) {
  const map = Object.fromEntries((grouped || []).map((row) => [row._id, row]))
  return dates.map((date) => {
    const row = map[date]
    const transactions = row?.transactions || 0
    const total = row?.total || 0
    return {
      date,
      transactions,
      total,
      average: averageDeposit(total, transactions),
    }
  })
}

async function summarizeRange(DepositModel, startDate, endDate) {
  const [row] = await DepositModel.aggregate([
    { $match: { date: { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id: null,
        total: { $sum: '$amount' },
        transactions: { $sum: 1 },
      },
    },
  ])
  const total = row?.total || 0
  const transactions = row?.transactions || 0
  return { total, transactions, average: averageDeposit(total, transactions) }
}

async function dailyTotals(DepositModel, startDate, endDate) {
  const dates = eachDateInclusive(startDate, endDate)
  const grouped = await DepositModel.aggregate([
    { $match: { date: { $gte: startDate, $lte: endDate } } },
    {
      $group: {
        _id: '$date',
        total: { $sum: '$amount' },
        transactions: { $sum: 1 },
      },
    },
  ])
  return fillDailyRows(dates, grouped)
}

async function dayTransactions(DepositModel, date) {
  return DepositModel.aggregate([
    { $match: { date } },
    { $sort: { createdAt: 1, _id: 1 } },
    {
      $lookup: {
        from: 'patients',
        localField: 'patientId',
        foreignField: 'patientId',
        as: 'patient',
      },
    },
    {
      $unwind: {
        path: '$patient',
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 0,
        id: { $toString: '$_id' },
        date: 1,
        amount: 1,
        method: 1,
        receivedBy: { $ifNull: ['$receivedBy', ''] },
        createdAt: 1,
        patientId: 1,
        patientName: { $ifNull: ['$patient.name', ''] },
      },
    },
  ])
}

export async function buildManagerDepositsReport(auth, query = {}, injected = {}) {
  if (!roleHasPermission(auth?.role, 'payments.view')) {
    const error = new Error('Forbidden')
    error.status = 403
    throw error
  }

  const deps = { ...defaultDeps(), ...injected }
  const period = resolveDepositsPeriod(query.view, query.date, deps.today)
  const queryEnd = period.endDate > period.today ? period.today : period.endDate
  const summary = await summarizeRange(deps.Deposit, period.startDate, queryEnd)

  let rows
  if (period.view === 'day') {
    rows = await dayTransactions(deps.Deposit, period.date)
  } else {
    rows = await dailyTotals(deps.Deposit, period.startDate, queryEnd)
  }

  return {
    view: period.view,
    date: period.date,
    startDate: period.startDate,
    endDate: period.endDate,
    today: period.today,
    summary,
    rows,
    generatedAt: new Date().toISOString(),
  }
}

export { averageDeposit, fillDailyRows }
