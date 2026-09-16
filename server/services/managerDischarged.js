/** Manager reporting for completed stays. Totals come from discharge snapshots, not a live recalc. */
import { Patient } from '../models/Patient.js'
import { roleHasPermission } from '../utils/permissions.js'
import { todayStr, localDayRange } from '../utils/dates.js'
import { escapeRegex } from './globalSearch.js'
import { resolveDepositsPeriod } from './managerDeposits.js'

export const MANAGER_DISCHARGED_PERMISSIONS = ['reports.view', 'payments.view']

function defaultDeps() {
  return { Patient, today: todayStr() }
}

function forbidUnless(allowed) {
  if (allowed) return
  const error = new Error('Forbidden')
  error.status = 403
  throw error
}

function clampPeriod(query, today) {
  const period = resolveDepositsPeriod(query.view, query.date, today)
  const queryEnd = period.endDate > period.today ? period.today : period.endDate
  return { ...period, queryEnd }
}

export function completedAtRange(period) {
  const start = localDayRange(period.startDate)
  const end = localDayRange(period.queryEnd || period.endDate)
  if (!start || !end) return null
  return { start: start.start, end: end.end }
}

function searchMatch(query) {
  const q = String(query.q || '').trim()
  if (!q) return {}
  const rx = new RegExp(escapeRegex(q), 'i')
  return { $or: [{ name: rx }, { patientId: rx }] }
}

function mapRow(doc) {
  return {
    id: doc.patientId,
    patientId: doc.patientId,
    patientName: doc.name || '',
    admissionDate: doc.admissionDate || null,
    dischargedAt: doc.dischargeCompletedAt?.toISOString?.() || null,
    room: doc.room || null,
    bed: doc.bed || null,
    grandTotal: doc.dischargeFinalCharges || 0,
    deposits: doc.dischargeFinalDeposits || 0,
    remaining: doc.dischargeFinalBalance ?? 0,
    status: doc.status,
  }
}

export async function buildManagerDischargedReport(auth, query = {}, injected = {}) {
  forbidUnless(roleHasPermission(auth?.role, 'payments.view'))
  const deps = { ...defaultDeps(), ...injected }
  const period = clampPeriod(query, deps.today)
  const range = completedAtRange(period)
  if (!range) {
    const error = new Error('Date is not valid.')
    error.status = 400
    throw error
  }
  const match = {
    status: 'discharged',
    dischargeCompletedAt: { $gte: range.start, $lt: range.end },
    ...searchMatch(query),
  }

  const [facet] = await deps.Patient.aggregate([
    { $match: match },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              patients: { $sum: 1 },
              grandTotal: { $sum: { $ifNull: ['$dischargeFinalCharges', 0] } },
              deposits: { $sum: { $ifNull: ['$dischargeFinalDeposits', 0] } },
              remaining: { $sum: { $ifNull: ['$dischargeFinalBalance', 0] } },
            },
          },
        ],
        rows: [
          { $sort: { dischargeCompletedAt: -1, createdAt: -1 } },
          {
            $project: {
              _id: 0,
              patientId: 1,
              name: 1,
              admissionDate: 1,
              dischargeCompletedAt: 1,
              room: 1,
              bed: 1,
              dischargeFinalCharges: 1,
              dischargeFinalDeposits: 1,
              dischargeFinalBalance: 1,
              status: 1,
            },
          },
        ],
      },
    },
  ])

  const totals = facet?.summary?.[0] || { patients: 0, grandTotal: 0, deposits: 0, remaining: 0 }
  return {
    view: period.view,
    date: period.date,
    startDate: period.startDate,
    endDate: period.queryEnd,
    today: period.today,
    summary: {
      patients: totals.patients || 0,
      grandTotal: totals.grandTotal || 0,
      deposits: totals.deposits || 0,
      remaining: totals.remaining || 0,
    },
    rows: (facet?.rows || []).map(mapRow),
    generatedAt: new Date().toISOString(),
  }
}
