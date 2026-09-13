import { Patient } from '../models/Patient.js'
import { Doctor } from '../models/Doctor.js'
import { Room } from '../models/Room.js'
import { Bed } from '../models/Bed.js'
import { Department } from '../models/Department.js'
import { Ward } from '../models/Ward.js'
import { User } from '../models/User.js'
import { roleHasPermission } from '../utils/permissions.js'

export const SEARCH_LIMIT = 5
export const MIN_QUERY_LENGTH = 2
export const MAX_QUERY_LENGTH = 80

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function normalizeSearchQuery(raw) {
  if (raw == null) return { error: 'Search query is required' }
  const q = String(raw).trim()
  if (!q) return { error: 'Search query is required' }
  if (q.length < MIN_QUERY_LENGTH) return { error: 'Search query is too short' }
  if (q.length > MAX_QUERY_LENGTH) return { error: 'Search query is too long' }
  return { q }
}

export function allowedSearchScopes(role) {
  return {
    patients: roleHasPermission(role, 'patients.view') || roleHasPermission(role, 'admissions.view'),
    doctors: roleHasPermission(role, 'doctors.view'),
    rooms: roleHasPermission(role, 'rooms.view') || roleHasPermission(role, 'beds.view'),
    departments: roleHasPermission(role, 'departments.view'),
    wards: roleHasPermission(role, 'wards.view'),
    users: roleHasPermission(role, 'users.view'),
  }
}

export function resultRoute(accessRole, type, id) {
  if (type === 'patient') {
    if (accessRole === 'Reception') return `/reception/patient/${id}`
    if (accessRole === 'Nurse') return `/nurse/patient/${id}`
    return null
  }
  if (accessRole !== 'Admin') return null
  if (type === 'doctor') return '/admin/doctors'
  if (type === 'room' || type === 'bed' || type === 'department' || type === 'ward') return '/admin/departments'
  if (type === 'user') return '/admin/users'
  return null
}

export function item(type, id, title, subtitle, meta, route) {
  return {
    type,
    id: String(id),
    title,
    subtitle: subtitle || '',
    meta: meta || '',
    route: route || null,
  }
}

function textFilter(q) {
  return new RegExp(escapeRegex(q), 'i')
}

function takePage(docs) {
  const hasMore = docs.length > SEARCH_LIMIT
  return { rows: docs.slice(0, SEARCH_LIMIT), hasMore }
}

function defaultDeps() {
  return { Patient, Doctor, Room, Bed, Department, Ward, User }
}

async function searchPatients(PatientModel, q, accessRole) {
  const rx = textFilter(q)
  const docs = await PatientModel.find({
    $or: [{ name: rx }, { patientId: rx }, { mrn: rx }, { phone: rx }],
  })
    .sort({ admissionDate: -1, createdAt: -1 })
    .limit(SEARCH_LIMIT + 1)
    .select('patientId name status mrn room bed')
    .lean()
  const { rows, hasMore } = takePage(docs)
  return {
    hasMore,
    items: rows.map((doc) =>
      item(
        'patient',
        doc.patientId,
        doc.name,
        doc.mrn || doc.patientId,
        [doc.status, [doc.room, doc.bed].filter(Boolean).join(' / ')].filter(Boolean).join(' · '),
        resultRoute(accessRole, 'patient', doc.patientId)
      )
    ),
  }
}

async function searchDoctors(DoctorModel, q, accessRole) {
  const rx = textFilter(q)
  const docs = await DoctorModel.find({ $or: [{ name: rx }, { specialty: rx }] })
    .sort({ name: 1 })
    .limit(SEARCH_LIMIT + 1)
    .select('name specialty active')
    .lean()
  const { rows, hasMore } = takePage(docs)
  return {
    hasMore,
    items: rows.map((doc) =>
      item('doctor', doc._id, doc.name, doc.specialty, doc.active === false ? 'Inactive' : 'Active', resultRoute(accessRole, 'doctor', doc._id))
    ),
  }
}

async function searchRoomsAndBeds(deps, q, accessRole) {
  const rx = textFilter(q)
  const [roomDocs, bedDocs] = await Promise.all([
    deps.Room.find({ $or: [{ name: rx }, { roomType: rx }] })
      .sort({ name: 1 })
      .limit(SEARCH_LIMIT + 1)
      .select('name roomType wardId')
      .lean(),
    deps.Bed.find({ $or: [{ label: rx }, { name: rx }] })
      .sort({ label: 1 })
      .limit(SEARCH_LIMIT + 1)
      .select('label name status roomId')
      .lean(),
  ])
  const roomsPage = takePage(roomDocs)
  const bedsPage = takePage(bedDocs)
  const wardIds = [...new Set(roomsPage.rows.map((row) => row.wardId).filter(Boolean))]
  const wards = wardIds.length ? await deps.Ward.find({ _id: { $in: wardIds } }).select('name').lean() : []
  const wardName = Object.fromEntries(wards.map((w) => [String(w._id), w.name]))

  return {
    rooms: {
      hasMore: roomsPage.hasMore,
      items: roomsPage.rows.map((doc) =>
        item(
          'room',
          doc._id,
          doc.name,
          doc.roomType,
          wardName[String(doc.wardId)] || '',
          resultRoute(accessRole, 'room', doc._id)
        )
      ),
    },
    beds: {
      hasMore: bedsPage.hasMore,
      items: bedsPage.rows.map((doc) =>
        item(
          'bed',
          doc._id,
          doc.label || doc.name,
          doc.name && doc.name !== doc.label ? doc.name : '',
          doc.status,
          resultRoute(accessRole, 'bed', doc._id)
        )
      ),
    },
  }
}

async function searchDepartments(DepartmentModel, q, accessRole) {
  const rx = textFilter(q)
  const docs = await DepartmentModel.find({ name: rx })
    .sort({ name: 1 })
    .limit(SEARCH_LIMIT + 1)
    .select('name active')
    .lean()
  const { rows, hasMore } = takePage(docs)
  return {
    hasMore,
    items: rows.map((doc) =>
      item(
        'department',
        doc._id,
        doc.name,
        '',
        doc.active === false ? 'Inactive' : 'Active',
        resultRoute(accessRole, 'department', doc._id)
      )
    ),
  }
}

async function searchWards(deps, q, accessRole) {
  const rx = textFilter(q)
  const docs = await deps.Ward.find({ name: rx })
    .sort({ name: 1 })
    .limit(SEARCH_LIMIT + 1)
    .select('name departmentId active')
    .lean()
  const { rows, hasMore } = takePage(docs)
  const deptIds = [...new Set(rows.map((row) => row.departmentId).filter(Boolean))]
  const depts = deptIds.length ? await deps.Department.find({ _id: { $in: deptIds } }).select('name').lean() : []
  const deptName = Object.fromEntries(depts.map((d) => [String(d._id), d.name]))
  return {
    hasMore,
    items: rows.map((doc) =>
      item(
        'ward',
        doc._id,
        doc.name,
        deptName[String(doc.departmentId)] || '',
        doc.active === false ? 'Inactive' : 'Active',
        resultRoute(accessRole, 'ward', doc._id)
      )
    ),
  }
}

async function searchUsers(UserModel, q, accessRole) {
  const rx = textFilter(q)
  const docs = await UserModel.find({ $or: [{ name: rx }, { username: rx }, { email: rx }] })
    .sort({ name: 1 })
    .limit(SEARCH_LIMIT + 1)
    .select('name username email role status')
    .lean()
  const { rows, hasMore } = takePage(docs)
  return {
    hasMore,
    items: rows.map((doc) =>
      item(
        'user',
        doc._id,
        doc.name,
        doc.username || doc.email,
        doc.role,
        resultRoute(accessRole, 'user', doc._id)
      )
    ),
  }
}

export async function buildSearchResults(auth, query, injected = {}) {
  const parsed = normalizeSearchQuery(query)
  if (parsed.error) {
    const error = new Error(parsed.error)
    error.status = 400
    throw error
  }

  const deps = { ...defaultDeps(), ...injected }
  const role = auth?.role
  const accessRole = auth?.user?.role
  const scopes = allowedSearchScopes(role)
  const groups = {}
  const jobs = []

  if (scopes.patients) {
    jobs.push(
      searchPatients(deps.Patient, parsed.q, accessRole).then((block) => {
        groups.patients = block
      })
    )
  }
  if (scopes.doctors) {
    jobs.push(
      searchDoctors(deps.Doctor, parsed.q, accessRole).then((block) => {
        groups.doctors = block
      })
    )
  }
  if (scopes.rooms) {
    jobs.push(
      searchRoomsAndBeds(deps, parsed.q, accessRole).then((block) => {
        groups.rooms = block.rooms
        groups.beds = block.beds
      })
    )
  }
  if (scopes.departments) {
    jobs.push(
      searchDepartments(deps.Department, parsed.q, accessRole).then((block) => {
        groups.departments = block
      })
    )
  }
  if (scopes.wards) {
    jobs.push(
      searchWards(deps, parsed.q, accessRole).then((block) => {
        groups.wards = block
      })
    )
  }
  if (scopes.users) {
    jobs.push(
      searchUsers(deps.User, parsed.q, accessRole).then((block) => {
        groups.users = block
      })
    )
  }

  await Promise.all(jobs)

  const order = ['patients', 'doctors', 'rooms', 'beds', 'departments', 'wards', 'users']
  const results = order.flatMap((key) => groups[key]?.items || [])

  return {
    query: parsed.q,
    results,
    groups,
  }
}
