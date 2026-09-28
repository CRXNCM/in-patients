import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import 'dotenv/config'
import mongoose from 'mongoose'
import { connectDB } from '../config/db.js'
import { User } from '../models/User.js'
import { Role } from '../models/Role.js'
import { Patient } from '../models/Patient.js'
import { ClinicalNote } from '../models/ClinicalNote.js'
import { ServiceRecord } from '../models/ServiceRecord.js'
import { Deposit } from '../models/Deposit.js'
import clinicalNotesRoutes from '../routes/clinicalNotes.routes.js'
import { todayStr } from '../utils/dates.js'
import { calcPatientBalance } from './autoCharges.js'

const PREFIX = 'cnote-test-'
const hasDb = Boolean(process.env.MONGODB_URI && process.env.JWT_SECRET)

function sign(user) {
  return jwt.sign(
    { id: user._id.toString(), email: user.email, role: user.role, roleKey: user.role.toLowerCase(), name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  )
}

async function request(app, path, { token, method = 'GET', body } = {}) {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s))
  })
  const { port } = server.address()
  try {
    const headers = { Accept: 'application/json' }
    if (token) headers.Authorization = `Bearer ${token}`
    if (body) headers['Content-Type'] = 'application/json'
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const payload = await res.json().catch(() => ({}))
    return { status: res.status, body: payload }
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  }
}

describe('clinical notes HTTP', { skip: !hasDb }, () => {
  let app
  let nurse
  let otherNurse
  let reception
  let manager
  let patient
  let discharged
  const createdRoleIds = []
  const createdUserIds = []

  async function makeUser({ permissions, slug, accessRole = 'Nurse', accessLabel = 'Nurse' }) {
    const role = await Role.create({
      name: `${PREFIX}${slug}`,
      slug: `${PREFIX}${slug}`,
      accessRole,
      description: 'Temporary clinical notes test role',
      permissions,
      active: true,
      system: false,
    })
    createdRoleIds.push(role._id)
    const user = await User.create({
      email: `${PREFIX}${slug}@example.invalid`,
      username: `${PREFIX}${slug}`,
      password: await bcrypt.hash('password', 8),
      name: slug === 'nurse' ? 'Almaz Tsegaye' : `Notes ${slug}`,
      role: accessLabel,
      roleId: role._id,
      status: 'active',
    })
    createdUserIds.push(user._id)
    return user
  }

  before(async () => {
    await connectDB(process.env.MONGODB_URI)
    await User.deleteMany({ email: { $regex: `^${PREFIX}` } })
    await Role.deleteMany({ slug: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await ClinicalNote.deleteMany({ patientId: { $regex: `^${PREFIX}` } })

    app = express()
    app.use(express.json())
    app.use('/api', clinicalNotesRoutes)

    nurse = await makeUser({
      permissions: ['clinicalNotes.view', 'clinicalNotes.create', 'clinicalNotes.editOwn'],
      slug: 'nurse',
    })
    otherNurse = await makeUser({
      permissions: ['clinicalNotes.view', 'clinicalNotes.create', 'clinicalNotes.editOwn'],
      slug: 'other',
    })
    reception = await makeUser({
      permissions: ['clinicalNotes.view', 'patients.view', 'admissions.create'],
      slug: 'desk',
      accessRole: 'Reception',
      accessLabel: 'Reception',
    })
    manager = await makeUser({
      permissions: ['clinicalNotes.view', 'reports.view'],
      slug: 'mgr',
      accessRole: 'Manager',
      accessLabel: 'Manager',
    })

    const today = todayStr()
    patient = await Patient.create({
      patientId: `${PREFIX}P1`,
      name: 'Abebe Kebede',
      gender: 'Male',
      address: 'Addis Ababa',
      admissionDate: today,
      status: 'admitted',
      room: 'General Ward',
      bed: 'B-12',
    })
    discharged = await Patient.create({
      patientId: `${PREFIX}P2`,
      name: 'Discharged Stay',
      gender: 'Female',
      address: 'Dire Dawa',
      admissionDate: today,
      status: 'discharged',
      room: 'General Ward',
      bed: 'GW-01',
    })
  })

  after(async () => {
    await ClinicalNote.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await Patient.deleteMany({ patientId: { $regex: `^${PREFIX}` } })
    await User.deleteMany({ _id: { $in: createdUserIds } })
    await Role.deleteMany({ _id: { $in: createdRoleIds } })
    await mongoose.disconnect()
  })

  it('lets a nurse create and view notes for the current admission only', async () => {
    const created = await request(
      app,
      `/api/patients/${patient.patientId}/admissions/${patient._id}/clinical-notes`,
      {
        token: sign(nurse),
        method: 'POST',
        body: { note: 'Patient is awake, conscious and responsive.', createdBy: otherNurse._id },
      }
    )
    assert.equal(created.status, 201)
    assert.equal(created.body.createdById, nurse._id.toString())
    assert.equal(created.body.note, 'Patient is awake, conscious and responsive.')

    const later = await request(
      app,
      `/api/patients/${patient.patientId}/admissions/${patient._id}/clinical-notes`,
      {
        token: sign(nurse),
        method: 'POST',
        body: { note: 'Patient complained of mild abdominal pain.' },
      }
    )
    assert.equal(later.status, 201)

    const listed = await request(
      app,
      `/api/patients/${patient.patientId}/admissions/${patient._id}/clinical-notes`,
      { token: sign(nurse) }
    )
    assert.equal(listed.status, 200)
    assert.equal(listed.body.notes.length, 2)
    assert.equal(listed.body.notes[0].note, 'Patient complained of mild abdominal pain.')
    assert.equal(listed.body.canCreate, true)

    const wrongStay = await request(
      app,
      `/api/patients/${patient.patientId}/admissions/${discharged._id}/clinical-notes`,
      { token: sign(nurse) }
    )
    assert.equal(wrongStay.status, 404)

    const otherStayNotes = await request(
      app,
      `/api/patients/${discharged.patientId}/admissions/${discharged._id}/clinical-notes`,
      { token: sign(nurse) }
    )
    assert.equal(otherStayNotes.status, 200)
    assert.equal(otherStayNotes.body.notes.length, 0)
    assert.equal(otherStayNotes.body.readOnly, true)
    assert.equal(otherStayNotes.body.canCreate, false)
  })

  it('lets a nurse edit their own note and preserves history', async () => {
    const existing = await ClinicalNote.findOne({ patientId: patient.patientId, createdBy: nurse._id }).sort({
      createdAt: 1,
    })
    const patched = await request(app, `/api/clinical-notes/${existing._id}`, {
      token: sign(nurse),
      method: 'PATCH',
      body: { note: 'Patient complained of mild abdominal pain. Vital signs stable.' },
    })
    assert.equal(patched.status, 200)
    assert.equal(patched.body.isEdited, true)

    const stored = await ClinicalNote.findById(existing._id)
    assert.equal(stored.editHistory.length, 1)
    assert.ok(stored.editHistory[0].previousNote)
    assert.equal(String(stored.editHistory[0].editedBy), nurse._id.toString())
  })

  it('blocks another nurse from editing, reception from creating, and empty notes', async () => {
    const existing = await ClinicalNote.findOne({ patientId: patient.patientId, createdBy: nurse._id })
    const foreign = await request(app, `/api/clinical-notes/${existing._id}`, {
      token: sign(otherNurse),
      method: 'PATCH',
      body: { note: 'Changed by another nurse' },
    })
    assert.equal(foreign.status, 403)

    const deskCreate = await request(
      app,
      `/api/patients/${patient.patientId}/admissions/${patient._id}/clinical-notes`,
      { token: sign(reception), method: 'POST', body: { note: 'Reception should not write this.' } }
    )
    assert.equal(deskCreate.status, 403)

    const deskView = await request(
      app,
      `/api/patients/${patient.patientId}/admissions/${patient._id}/clinical-notes`,
      { token: sign(reception) }
    )
    assert.equal(deskView.status, 200)
    assert.equal(deskView.body.canCreate, false)

    const empty = await request(
      app,
      `/api/patients/${patient.patientId}/admissions/${patient._id}/clinical-notes`,
      { token: sign(nurse), method: 'POST', body: { note: '   ' } }
    )
    assert.equal(empty.status, 400)

    const noAuth = await request(
      app,
      `/api/patients/${patient.patientId}/admissions/${patient._id}/clinical-notes`,
      { method: 'POST', body: { note: 'Unauthenticated' } }
    )
    assert.equal(noAuth.status, 401)

    const managerCreate = await request(
      app,
      `/api/patients/${patient.patientId}/admissions/${patient._id}/clinical-notes`,
      { token: sign(manager), method: 'POST', body: { note: 'Manager should not write this.' } }
    )
    assert.equal(managerCreate.status, 403)
  })

  it('rejects create and edit after discharge and does not create billing records', async () => {
    const create = await request(
      app,
      `/api/patients/${discharged.patientId}/admissions/${discharged._id}/clinical-notes`,
      { token: sign(nurse), method: 'POST', body: { note: 'Too late' } }
    )
    assert.equal(create.status, 400)

    const note = await ClinicalNote.create({
      patient: discharged._id,
      patientId: discharged.patientId,
      admissionId: String(discharged._id),
      note: 'Recorded before discharge',
      createdBy: nurse._id,
    })
    const edit = await request(app, `/api/clinical-notes/${note._id}`, {
      token: sign(nurse),
      method: 'PATCH',
      body: { note: 'Should stay read-only' },
    })
    assert.equal(edit.status, 400)

    const [records, deposits] = await Promise.all([
      ServiceRecord.countDocuments({ patientId: patient.patientId }),
      Deposit.countDocuments({ patientId: patient.patientId }),
    ])
    assert.equal(records, 0)
    assert.equal(deposits, 0)

    const billed = await calcPatientBalance(patient.patientId)
    assert.equal(billed.totalCharges || 0, 0)
  })
})
