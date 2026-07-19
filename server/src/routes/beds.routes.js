import { Router } from 'express'
import { Bed } from '../models/Bed.js'
import { authRequired } from '../middleware/auth.js'
import { buildRoomsFromBeds } from '../utils/mappers.js'

const router = Router()

router.get('/rooms', authRequired, async (_req, res) => {
  try {
    const beds = await Bed.find().sort({ roomType: 1, label: 1 })
    res.json(buildRoomsFromBeds(beds))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load rooms' })
  }
})

router.get('/available', authRequired, async (req, res) => {
  try {
    const { roomType } = req.query
    const filter = { status: 'available' }
    if (roomType) filter.roomType = roomType

    const beds = await Bed.find(filter).sort({ roomType: 1, label: 1 })
    res.json(
      beds.map((b) => ({
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

export default router
