import { Router } from 'express'
import mongoose from 'mongoose'
import { Department } from '../models/Department.js'
import { Ward } from '../models/Ward.js'
import { Room } from '../models/Room.js'
import { Bed } from '../models/Bed.js'
import { authRequired, requireAnyPermission } from '../middleware/auth.js'
import { roleHasPermission } from '../utils/permissions.js'
import {
  defaultRateForRoomType,
  toFrontendRoom,
  trimText,
  validateRoomBody,
} from '../utils/hospitalSetup.js'
import { previewBulkRooms, createBulkRooms } from '../services/bulkRooms.js'

const router = Router()

router.use(authRequired)

async function bedUsage() {
  const rows = await Bed.aggregate([
    { $match: { roomId: { $ne: null } } },
    {
      $group: {
        _id: '$roomId',
        bedCount: { $sum: 1 },
        occupiedCount: { $sum: { $cond: [{ $eq: ['$status', 'occupied'] }, 1, 0] } },
      },
    },
  ])
  return Object.fromEntries(rows.map((row) => [String(row._id), row]))
}

function extrasFor(room, usage = {}) {
  const stats = usage[room._id.toString()] || {}
  return {
    ward: room.wardId,
    department: room.departmentId,
    bedCount: stats.bedCount || 0,
    occupiedCount: stats.occupiedCount || 0,
  }
}

function requireBulkRoomAndBedCreate(req, res, next) {
  const role = req.auth?.role
  const canRooms = roleHasPermission(role, 'rooms.create') || roleHasPermission(role, 'rooms.manage_rooms')
  const canBeds = roleHasPermission(role, 'beds.create') || roleHasPermission(role, 'rooms.manage_beds')
  if (!canRooms || !canBeds) return res.status(403).json({ error: 'Forbidden' })
  next()
}

function sendBulkError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ error: err.message, errors: err.errors || [err.message] })
  console.error(err)
  return res.status(500).json({ error: fallback })
}

router.post('/bulk-preview', requireBulkRoomAndBedCreate, async (req, res) => {
  try {
    const result = await previewBulkRooms(req.body)
    if (!result.ok) return res.status(400).json({ error: result.errors[0], errors: result.errors })
    res.json(result)
  } catch (err) {
    sendBulkError(res, err, 'Failed to preview rooms and beds')
  }
})

router.post('/bulk', requireBulkRoomAndBedCreate, async (req, res) => {
  try {
    const result = await createBulkRooms(req.body, req.user.name)
    res.status(201).json(result)
  } catch (err) {
    sendBulkError(res, err, 'Failed to create rooms and beds')
  }
})

router.get('/', requireAnyPermission('rooms.view', 'rooms.manage_rooms'), async (_req, res) => {
  try {
    const rooms = await Room.find().sort({ name: 1 }).populate('wardId').populate('departmentId')
    const usage = await bedUsage()
    res.json(rooms.map((room) => toFrontendRoom(room, extrasFor(room, usage))))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load rooms' })
  }
})

router.get('/:id', requireAnyPermission('rooms.view', 'rooms.manage_rooms'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Room not found' })
    const room = await Room.findById(req.params.id).populate('wardId').populate('departmentId')
    if (!room) return res.status(404).json({ error: 'Room not found' })
    const usage = await bedUsage()
    res.json(toFrontendRoom(room, extrasFor(room, usage)))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load room' })
  }
})

router.post('/', requireAnyPermission('rooms.create', 'rooms.manage_rooms'), async (req, res) => {
  try {
    const errors = validateRoomBody(req.body)
    if (errors.length) return res.status(400).json({ error: errors[0] })

    const ward = await Ward.findById(req.body.wardId)
    if (!ward) return res.status(400).json({ error: 'Selected ward was not found.' })
    if (!ward.active) return res.status(400).json({ error: 'Rooms cannot be added to an inactive ward.' })
    const department = await Department.findById(ward.departmentId)
    if (!department) return res.status(400).json({ error: 'The ward department was not found.' })
    if (!department.active) return res.status(400).json({ error: 'Rooms cannot be added under an inactive department.' })

    const name = trimText(req.body.name)
    const nameKey = name.toLowerCase()
    const exists = await Room.findOne({ wardId: ward._id, nameKey })
    if (exists) return res.status(400).json({ error: 'A room with this number already exists in this ward.' })

    const roomType = req.body.roomType
    const dailyRate = req.body.dailyRate === undefined || req.body.dailyRate === ''
      ? defaultRateForRoomType(roomType)
      : Number(req.body.dailyRate)

    const room = await Room.create({
      name,
      nameKey,
      wardId: ward._id,
      departmentId: department._id,
      roomType,
      capacity: Number(req.body.capacity),
      dailyRate,
      description: trimText(req.body.description),
      active: req.body.active !== false,
      createdBy: req.user.name,
      updatedBy: req.user.name,
    })
    res.status(201).json(toFrontendRoom(room, { ward, department, bedCount: 0, occupiedCount: 0 }))
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'A room with this number already exists in this ward.' })
    console.error(err)
    res.status(500).json({ error: 'Failed to create room' })
  }
})

router.patch('/:id', requireAnyPermission('rooms.edit', 'rooms.manage_rooms'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Room not found' })
    const room = await Room.findById(req.params.id)
    if (!room) return res.status(404).json({ error: 'Room not found' })

    const errors = validateRoomBody(req.body, { partial: true })
    if (errors.length) return res.status(400).json({ error: errors[0] })

    if (req.body.wardId !== undefined) {
      const ward = await Ward.findById(req.body.wardId)
      if (!ward) return res.status(400).json({ error: 'Selected ward was not found.' })
      if (!ward.active) return res.status(400).json({ error: 'Rooms cannot be moved to an inactive ward.' })
      const department = await Department.findById(ward.departmentId)
      if (!department?.active) return res.status(400).json({ error: 'Rooms cannot be moved under an inactive department.' })
      room.wardId = ward._id
      room.departmentId = department._id
    }
    if (req.body.name !== undefined) {
      room.name = trimText(req.body.name)
      room.nameKey = room.name.toLowerCase()
    }
    if (req.body.roomType !== undefined) room.roomType = req.body.roomType
    if (req.body.capacity !== undefined) room.capacity = Number(req.body.capacity)
    if (req.body.dailyRate !== undefined && req.body.dailyRate !== '') room.dailyRate = Number(req.body.dailyRate)
    if (req.body.description !== undefined) room.description = trimText(req.body.description)
    if (req.body.active !== undefined) room.active = !!req.body.active

    const occupied = await Bed.countDocuments({ roomId: room._id, status: 'occupied' })
    if (req.body.capacity !== undefined && room.capacity < occupied) {
      return res.status(400).json({ error: 'Capacity cannot be lower than the number of occupied beds.' })
    }

    const dup = await Room.findOne({ wardId: room.wardId, nameKey: room.nameKey, _id: { $ne: room._id } })
    if (dup) return res.status(400).json({ error: 'A room with this number already exists in this ward.' })

    room.updatedBy = req.user.name
    await room.save()
    const ward = await Ward.findById(room.wardId)
    const department = await Department.findById(room.departmentId)
    const usage = await bedUsage()
    res.json(toFrontendRoom(room, extrasFor({ ...room.toObject(), wardId: ward, departmentId: department, _id: room._id }, usage)))
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'A room with this number already exists in this ward.' })
    console.error(err)
    res.status(500).json({ error: 'Failed to update room' })
  }
})

export default router
