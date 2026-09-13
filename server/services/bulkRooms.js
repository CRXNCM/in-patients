import mongoose from 'mongoose'
import { Department } from '../models/Department.js'
import { Ward } from '../models/Ward.js'
import { Room } from '../models/Room.js'
import { Bed } from '../models/Bed.js'
import { defaultRateForRoomType, toFrontendBed, toFrontendRoom } from '../utils/hospitalSetup.js'
import {
  buildBulkPlan,
  findPlanConflicts,
  normalizeBulkOptions,
} from '../utils/bulkLayout.js'

function isTxnUnsupported(err) {
  const message = String(err?.message || '')
  return err?.code === 20 || /replica set|transaction numbers are only allowed/i.test(message)
}

async function withSafeBulkWrite(work) {
  const session = await mongoose.startSession()
  try {
    let result
    await session.withTransaction(async () => {
      result = await work(session, { roomIds: [], bedIds: [] })
    })
    return result
  } catch (err) {
    if (!isTxnUnsupported(err)) throw err
  } finally {
    session.endSession()
  }

  const created = { roomIds: [], bedIds: [] }
  try {
    return await work(null, created)
  } catch (err) {
    if (created.bedIds.length) await Bed.deleteMany({ _id: { $in: created.bedIds } })
    if (created.roomIds.length) await Room.deleteMany({ _id: { $in: created.roomIds } })
    throw err
  }
}

async function loadWardContext(wardId) {
  const ward = await Ward.findById(wardId)
  if (!ward) {
    const error = new Error('Selected ward was not found.')
    error.status = 400
    throw error
  }
  if (!ward.active) {
    const error = new Error('Rooms and beds cannot be added to an inactive ward.')
    error.status = 400
    throw error
  }
  const department = await Department.findById(ward.departmentId)
  if (!department) {
    const error = new Error('The ward department was not found.')
    error.status = 400
    throw error
  }
  if (!department.active) {
    const error = new Error('Rooms and beds cannot be added under an inactive department.')
    error.status = 400
    throw error
  }
  return { ward, department }
}

async function loadRoomContext(roomId) {
  const room = await Room.findById(roomId)
  if (!room) {
    const error = new Error('Selected room was not found.')
    error.status = 400
    throw error
  }
  if (!room.active) {
    const error = new Error('Beds cannot be added to an inactive room.')
    error.status = 400
    throw error
  }
  const { ward, department } = await loadWardContext(room.wardId)
  return { room, ward, department }
}

export async function previewBulkRooms(body) {
  const options = normalizeBulkOptions(body, 'rooms')
  const plan = buildBulkPlan(options, 'rooms')
  if (plan.errors.length) return { ok: false, errors: plan.errors, plan: null }

  const { ward, department } = await loadWardContext(options.wardId)
  const existingRooms = await Room.find({ wardId: ward._id }).select('name')
  const existingBeds = await Bed.find().select('label name')
  const conflicts = findPlanConflicts(plan, {
    existingRoomNames: existingRooms.map((row) => row.name),
    existingBedLabels: existingBeds.map((row) => row.label),
  })
  if (conflicts.length) return { ok: false, errors: conflicts, plan: null }

  return {
    ok: true,
    errors: [],
    plan: {
      ...plan,
      wardId: String(ward._id),
      wardName: ward.name,
      departmentId: String(department._id),
      departmentName: department.name,
      roomType: options.roomType,
      status: options.status,
    },
  }
}

export async function previewBulkBeds(body) {
  const options = normalizeBulkOptions(body, 'beds')
  const { room, ward, department } = await loadRoomContext(options.roomId)
  options.existingRoomName = room.name
  options.roomPrefix = options.roomPrefix || room.name
  const plan = buildBulkPlan(options, 'beds')
  if (plan.errors.length) return { ok: false, errors: plan.errors, plan: null }

  const existingInRoom = await Bed.find({ roomId: room._id }).select('name label status')
  const existingBeds = await Bed.find().select('label')
  const conflicts = findPlanConflicts(plan, {
    existingBedLabels: existingBeds.map((row) => row.label),
    existingBedNamesInRoom: existingInRoom.map((row) => row.name),
  })
  if (conflicts.length) return { ok: false, errors: conflicts, plan: null }

  return {
    ok: true,
    errors: [],
    plan: {
      ...plan,
      roomId: String(room._id),
      roomName: room.name,
      wardName: ward.name,
      departmentName: department.name,
      currentBedCount: existingInRoom.length,
      occupiedCount: existingInRoom.filter((row) => row.status === 'occupied').length,
      capacity: room.capacity,
      status: options.status,
    },
  }
}

async function insertBeds(session, created, beds, extras) {
  if (!beds.length) return []
  const docs = beds.map((bed) => ({
    label: bed.label,
    name: bed.name,
    nameKey: bed.name.toLowerCase(),
    roomId: extras.roomId,
    wardId: extras.wardId,
    departmentId: extras.departmentId,
    roomType: extras.roomType,
    dailyRate: extras.dailyRate,
    status: extras.status,
    createdBy: extras.userName,
    updatedBy: extras.userName,
  }))
  const inserted = await Bed.insertMany(docs, { session: session || undefined, ordered: true })
  created.bedIds.push(...inserted.map((row) => row._id))
  return inserted
}

export async function createBulkRooms(body, userName) {
  const preview = await previewBulkRooms(body)
  if (!preview.ok) {
    const error = new Error(preview.errors[0])
    error.status = 400
    error.errors = preview.errors
    throw error
  }

  const options = normalizeBulkOptions(body, 'rooms')
  const { ward, department } = await loadWardContext(options.wardId)
  const dailyRate = options.dailyRate == null ? defaultRateForRoomType(options.roomType) : options.dailyRate

  const createdDocs = await withSafeBulkWrite(async (session, created) => {
    const roomsOut = []
    for (const planned of preview.plan.rooms) {
      const payload = {
        name: planned.name,
        nameKey: planned.name.toLowerCase(),
        wardId: ward._id,
        departmentId: department._id,
        roomType: options.roomType,
        capacity: options.bedsPerRoom,
        dailyRate,
        active: true,
        createdBy: userName,
        updatedBy: userName,
      }
      const room = session
        ? (await Room.create([payload], { session }))[0]
        : await Room.create(payload)
      created.roomIds.push(room._id)
      const beds = await insertBeds(session, created, planned.beds, {
        roomId: room._id,
        wardId: ward._id,
        departmentId: department._id,
        roomType: options.roomType,
        dailyRate,
        status: options.status,
        userName,
      })
      roomsOut.push({ room, beds })
    }
    return roomsOut
  })

  return {
    roomCount: createdDocs.length,
    bedCount: createdDocs.reduce((sum, row) => sum + row.beds.length, 0),
    rooms: createdDocs.map((row) => ({
      ...toFrontendRoom(row.room, { ward, department, bedCount: row.beds.length, occupiedCount: 0 }),
      beds: row.beds.map((bed) => toFrontendBed(bed, { room: row.room, ward })),
    })),
  }
}

export async function createBulkBeds(body, userName) {
  const preview = await previewBulkBeds(body)
  if (!preview.ok) {
    const error = new Error(preview.errors[0])
    error.status = 400
    error.errors = preview.errors
    throw error
  }

  const options = normalizeBulkOptions(body, 'beds')
  const { room, ward, department } = await loadRoomContext(options.roomId)
  const plannedBeds = preview.plan.rooms[0]?.beds || []

  const createdBeds = await withSafeBulkWrite(async (session, created) => {
    const countQuery = Bed.countDocuments({ roomId: room._id })
    const currentCount = session ? await countQuery.session(session) : await countQuery
    const neededCapacity = currentCount + plannedBeds.length
    if (neededCapacity > room.capacity) {
      room.capacity = neededCapacity
      room.updatedBy = userName
      await room.save(session ? { session } : undefined)
    }
    return insertBeds(session, created, plannedBeds, {
      roomId: room._id,
      wardId: room.wardId,
      departmentId: room.departmentId,
      roomType: room.roomType,
      dailyRate: room.dailyRate,
      status: options.status,
      userName,
    })
  })

  return {
    roomCount: 0,
    bedCount: createdBeds.length,
    room: toFrontendRoom(room, { ward, department, bedCount: preview.plan.currentBedCount + createdBeds.length, occupiedCount: preview.plan.occupiedCount }),
    beds: createdBeds.map((bed) => toFrontendBed(bed, { room, ward })),
  }
}

export { withSafeBulkWrite }
