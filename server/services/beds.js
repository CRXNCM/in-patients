import { Bed } from '../models/Bed.js'
import { Room } from '../models/Room.js'

export async function claimAvailableBed({ label, patientId }) {
  const bed = await Bed.findOneAndUpdate(
    { label, status: 'available' },
    { $set: { status: 'occupied', patientId } },
    { new: true }
  )
  if (!bed) {
    const error = new Error('Selected bed is not available.')
    error.status = 400
    throw error
  }
  if (bed.roomId) {
    const room = await Room.findById(bed.roomId)
    if (!room || room.active === false) {
      bed.status = 'available'
      bed.patientId = null
      await bed.save()
      const error = new Error('Selected bed is not available.')
      error.status = 400
      throw error
    }
  }
  return bed
}

export async function releaseBed(bed, patientId) {
  if (!bed) return
  if (bed.status === 'occupied' && (!bed.patientId || bed.patientId === patientId)) {
    bed.status = 'available'
    bed.patientId = null
    await bed.save()
  }
}
