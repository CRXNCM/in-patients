import { Patient } from '../models/Patient.js'
import { Bed } from '../models/Bed.js'
import { Department } from '../models/Department.js'
import { Ward } from '../models/Ward.js'
import { Room } from '../models/Room.js'
import { Doctor } from '../models/Doctor.js'
import { User } from '../models/User.js'
import { ServiceCategory } from '../models/ServiceCategory.js'
import { Deposit } from '../models/Deposit.js'
import { todayStr, localDayRange } from '../utils/dates.js'
import { roleHasPermission } from '../utils/permissions.js'

export const ADMIN_DASHBOARD_PERMISSIONS = [
  'patients.view',
  'beds.view',
  'rooms.view',
  'departments.view',
  'wards.view',
  'doctors.view',
  'users.view',
  'system.view_settings',
  'payments.view',
  'credit.view',
]

const BED_STATUSES = ['available', 'occupied', 'maintenance', 'out_of_service']

export function occupancyFromStatusCounts(counts = {}) {
  const available = Number(counts.available) || 0
  const occupied = Number(counts.occupied) || 0
  const maintenance = Number(counts.maintenance) || 0
  const outOfService = Number(counts.out_of_service) || 0
  const total = available + occupied + maintenance + outOfService
  return {
    total,
    occupied,
    available,
    maintenance,
    outOfService,
    unavailable: maintenance + outOfService,
    occupancyPercentage: total === 0 ? 0 : Math.round((occupied / total) * 100),
  }
}

export function mapRecentAdmission(doc, { includeCredit } = {}) {
  const item = {
    patientId: doc.patientId,
    name: doc.name,
    status: doc.status,
    admissionDate: doc.admissionDate,
    admissionType: doc.admissionType || 'normal',
    room: doc.room || '',
    bed: doc.bed || '',
  }
  if (doc.dischargeCompletedAt) {
    item.dischargeCompletedAt = new Date(doc.dischargeCompletedAt).toISOString()
  }
  if (includeCredit) {
    item.isCreditPatient = Boolean(doc.isCreditPatient)
  }
  return item
}

function defaultDeps() {
  return {
    Patient,
    Bed,
    Department,
    Ward,
    Room,
    Doctor,
    User,
    ServiceCategory,
    Deposit,
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
  return beds
}

async function catalogCounts(ServiceCategoryModel) {
  const [row] = await ServiceCategoryModel.aggregate([
    {
      $group: {
        _id: null,
        serviceCategories: { $sum: 1 },
        priceLines: { $sum: { $size: { $ifNull: ['$services', []] } } },
      },
    },
  ])
  return {
    serviceCategories: row?.serviceCategories || 0,
    priceLines: row?.priceLines || 0,
  }
}

async function depositsTodayTotal(DepositModel, today) {
  const [row] = await DepositModel.aggregate([
    { $match: { date: today } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ])
  return row?.total || 0
}

export async function buildAdminDashboard(auth, injected = {}) {
  const deps = { ...defaultDeps(), ...injected }
  const role = auth?.role
  const can = (key) => roleHasPermission(role, key)
  const today = deps.today
  const day = localDayRange(today)

  const payload = { generatedAt: new Date().toISOString() }

  const jobs = []

  if (can('patients.view') && day) {
    jobs.push(
      (async () => {
        const [currentlyAdmitted, pendingDischarge, admittedToday, dischargedToday, recent] = await Promise.all([
          deps.Patient.countDocuments({ status: 'admitted' }),
          deps.Patient.countDocuments({ status: 'pending-discharge' }),
          deps.Patient.countDocuments({ admissionDate: today }),
          deps.Patient.countDocuments({
            status: 'discharged',
            dischargeCompletedAt: { $gte: day.start, $lt: day.end },
          }),
          deps.Patient.find({})
            .sort({ admissionDate: -1, createdAt: -1 })
            .limit(8)
            .select('patientId name status admissionDate admissionType room bed isCreditPatient dischargeCompletedAt')
            .lean(),
        ])
        payload.census = {
          currentlyAdmitted,
          admittedToday,
          pendingDischarge,
          dischargedToday,
        }
        payload.recentAdmissions = recent.map((doc) =>
          mapRecentAdmission(doc, { includeCredit: can('credit.view') })
        )
      })()
    )
  }

  if (can('beds.view') || can('rooms.view')) {
    jobs.push(
      (async () => {
        payload.beds = await countBedsByStatus(deps.Bed)
      })()
    )
  }

  const setupJobs = []
  if (can('departments.view')) setupJobs.push(['departments', () => deps.Department.countDocuments({})])
  if (can('wards.view')) setupJobs.push(['wards', () => deps.Ward.countDocuments({})])
  if (can('rooms.view')) setupJobs.push(['rooms', () => deps.Room.countDocuments({})])
  if (can('beds.view') || can('rooms.view')) setupJobs.push(['beds', () => deps.Bed.countDocuments({})])
  if (can('doctors.view')) setupJobs.push(['doctors', () => deps.Doctor.countDocuments({})])
  if (can('users.view')) setupJobs.push(['users', () => deps.User.countDocuments({})])

  if (setupJobs.length) {
    jobs.push(
      (async () => {
        const setup = {}
        const values = await Promise.all(setupJobs.map(([, fn]) => fn()))
        setupJobs.forEach(([key], i) => {
          setup[key] = values[i]
        })
        payload.setup = setup
      })()
    )
  }

  if (can('system.view_settings')) {
    jobs.push(
      (async () => {
        payload.catalog = await catalogCounts(deps.ServiceCategory)
      })()
    )
  }

  if (can('payments.view')) {
    jobs.push(
      (async () => {
        payload.finance = { todayDeposits: await depositsTodayTotal(deps.Deposit, today) }
      })()
    )
  }

  if (can('credit.view')) {
    jobs.push(
      (async () => {
        payload.credit = {
          creditAdmissions: await deps.Patient.countDocuments({
            status: { $ne: 'discharged' },
            isCreditPatient: true,
          }),
        }
      })()
    )
  }

  await Promise.all(jobs)
  return payload
}
