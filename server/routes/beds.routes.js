import { Router } from 'express'
import mongoose from 'mongoose'
import { Bed } from '../models/Bed.js'
import { Room } from '../models/Room.js'
import { Ward } from '../models/Ward.js'
import { authRequired, requireAnyPermission } from '../middleware/auth.js'
import { buildRoomsFromBeds } from '../utils/mappers.js'
import { toFrontendBed, trimText, validateBedBody } from '../utils/hospitalSetup.js'
import { previewBulkBeds, createBulkBeds } from '../services/bulkRooms.js'

const router = Router()

router.use(authRequired)

router.get('/rooms', requireAnyPermission('rooms.view', 'rooms.assign_beds', 'admissions.create'), async (_req, res) => {
  try {
    const beds = await Bed.find().sort({ roomType: 1, label: 1 })
    res.json(buildRoomsFromBeds(beds))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load rooms' })
  }
})

router.get('/available', requireAnyPermission('rooms.view', 'rooms.assign_beds', 'admissions.create'), async (req, res) => {
  try {
    const { roomType } = req.query
    const filter = { status: 'available' }
    if (roomType) filter.roomType = roomType

    const beds = await Bed.find(filter).sort({ roomType: 1, label: 1 })
    const roomIds = [...new Set(beds.map((bed) => bed.roomId).filter(Boolean).map(String))]
    const rooms = roomIds.length ? await Room.find({ _id: { $in: roomIds } }) : []
    const activeRooms = new Set(rooms.filter((room) => room.active !== false).map((room) => room._id.toString()))

    res.json(
      beds
        .filter((bed) => !bed.roomId || activeRooms.has(String(bed.roomId)))
        .map((b) => ({
          id: b._id,
          label: b.label,
          roomType: b.roomType,
          dailyRate: b.dailyRate,
          status: b.status,
        }))
    )
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load beds' })
  }
})

function sendBulkError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ error: err.message, errors: err.errors || [err.message] })
  console.error(err)
  return res.status(500).json({ error: fallback })
}

router.post('/bulk-preview', requireAnyPermission('beds.create', 'rooms.manage_beds'), async (req, res) => {
  try {
    const result = await previewBulkBeds(req.body)
    if (!result.ok) return res.status(400).json({ error: result.errors[0], errors: result.errors })
    res.json(result)
  } catch (err) {
    sendBulkError(res, err, 'Failed to preview beds')
  }
})

router.post('/bulk', requireAnyPermission('beds.create', 'rooms.manage_beds'), async (req, res) => {
  try {
    const result = await createBulkBeds(req.body, req.user.name)
    res.status(201).json(result)
  } catch (err) {
    sendBulkError(res, err, 'Failed to create beds')
  }
})

router.get('/', requireAnyPermission('beds.view', 'rooms.manage_beds', 'rooms.view'), async (_req, res) => {
  try {
    const beds = await Bed.find().sort({ label: 1 }).populate('roomId').populate('wardId')
    res.json(beds.map((bed) => toFrontendBed(bed, { room: bed.roomId, ward: bed.wardId })))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load beds' })
  }
})

router.get('/:id', requireAnyPermission('beds.view', 'rooms.manage_beds', 'rooms.view'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Bed not found' })
    const bed = await Bed.findById(req.params.id).populate('roomId').populate('wardId')
    if (!bed) return res.status(404).json({ error: 'Bed not found' })
    res.json(toFrontendBed(bed, { room: bed.roomId, ward: bed.wardId }))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load bed' })
  }
})

router.post('/', requireAnyPermission('beds.create', 'rooms.manage_beds'), async (req, res) => {
  try {
    const errors = validateBedBody(req.body)
    if (errors.length) return res.status(400).json({ error: errors[0] })

    const room = await Room.findById(req.body.roomId)
    if (!room) return res.status(400).json({ error: 'Selected room was not found.' })
    if (!room.active) return res.status(400).json({ error: 'Beds cannot be added to an inactive room.' })
    const ward = await Ward.findById(room.wardId)
    if (!ward?.active) return res.status(400).json({ error: 'Beds cannot be added under an inactive ward.' })

    const bedCount = await Bed.countDocuments({ roomId: room._id })
    if (bedCount >= room.capacity) {
      return res.status(400).json({ error: `This room already has its full capacity of ${room.capacity} beds.` })
    }

    const name = trimText(req.body.name)
    const nameKey = name.toLowerCase()
    const exists = await Bed.findOne({ roomId: room._id, nameKey })
    if (exists) return res.status(400).json({ error: 'A bed with this identifier already exists in this room.' })

    const label = `${room.name}-${name}`.replace(/\s+/g, '')
    const labelTaken = await Bed.findOne({ label })
    if (labelTaken) return res.status(400).json({ error: 'A bed with this identifier already exists.' })

    const bed = await Bed.create({
      label,
      name,
      nameKey,
      roomId: room._id,
      wardId: room.wardId,
      departmentId: room.departmentId,
      roomType: room.roomType,
      dailyRate: req.body.dailyRate === undefined || req.body.dailyRate === '' ? room.dailyRate : Number(req.body.dailyRate),
      status: req.body.status && req.body.status !== 'occupied' ? req.body.status : 'available',
      createdBy: req.user.name,
      updatedBy: req.user.name,
    })
    res.status(201).json(toFrontendBed(bed, { room, ward }))
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'A bed with this identifier already exists in this room.' })
    console.error(err)
    res.status(500).json({ error: 'Failed to create bed' })
  }
})

router.patch('/:id', requireAnyPermission('beds.edit', 'beds.manage', 'rooms.manage_beds'), async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Bed not found' })
    const bed = await Bed.findById(req.params.id)
    if (!bed) return res.status(404).json({ error: 'Bed not found' })

    const errors = validateBedBody(req.body, { partial: true })
    if (errors.length) return res.status(400).json({ error: errors[0] })

    if (req.body.roomId !== undefined && String(req.body.roomId) !== String(bed.roomId || '')) {
      const room = await Room.findById(req.body.roomId)
      if (!room) return res.status(400).json({ error: 'Selected room was not found.' })
      if (!room.active) return res.status(400).json({ error: 'Beds cannot be moved to an inactive room.' })
      if (bed.status === 'occupied') return res.status(400).json({ error: 'An occupied bed cannot be moved to another room.' })
      const bedCount = await Bed.countDocuments({ roomId: room._id })
      if (bedCount >= room.capacity) {
        return res.status(400).json({ error: `This room already has its full capacity of ${room.capacity} beds.` })
      }
      bed.roomId = room._id
      bed.wardId = room.wardId
      bed.departmentId = room.departmentId
      bed.roomType = room.roomType
    }

    if (req.body.name !== undefined) {
      if (bed.status === 'occupied') return res.status(400).json({ error: 'An occupied bed identifier cannot be changed.' })
      const name = trimText(req.body.name)
      bed.name = name
      bed.nameKey = name.toLowerCase()
      if (bed.roomId) {
        const room = await Room.findById(bed.roomId)
        if (room) bed.label = `${room.name}-${name}`.replace(/\s+/g, '')
      }
    }
    if (req.body.dailyRate !== undefined && req.body.dailyRate !== '') bed.dailyRate = Number(req.body.dailyRate)

    if (req.body.status !== undefined) {
      if (req.body.status === 'occupied') {
        return res.status(400).json({ error: 'Occupancy is set only when a patient is admitted.' })
      }
      if (bed.status === 'occupied' && bed.patientId) {
        return res.status(400).json({ error: 'This bed is occupied. Discharge or transfer the patient before changing status.' })
      }
      bed.status = req.body.status
      if (req.body.status === 'available') bed.patientId = null
    }

    if (bed.roomId && bed.nameKey) {
      const dup = await Bed.findOne({ roomId: bed.roomId, nameKey: bed.nameKey, _id: { $ne: bed._id } })
      if (dup) return res.status(400).json({ error: 'A bed with this identifier already exists in this room.' })
    }

    bed.updatedBy = req.user.name
    await bed.save()
    const room = bed.roomId ? await Room.findById(bed.roomId) : null
    const ward = bed.wardId ? await Ward.findById(bed.wardId) : null
    res.json(toFrontendBed(bed, { room, ward }))
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'A bed with this identifier already exists.' })
    console.error(err)
    res.status(500).json({ error: 'Failed to update bed' })
  }
})

export default router
