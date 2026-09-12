import mongoose from 'mongoose'

const roomAssignmentSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, index: true },
    bedId: { type: String, required: true },
    roomType: String,
    bedLabel: String,
    startDate: { type: String, required: true },
    endDate: { type: String, default: null },
    dailyRate: { type: Number, required: true },
    reason: String,
    assignedBy: String,
  },
  { timestamps: true }
)

export const RoomAssignment = mongoose.model('RoomAssignment', roomAssignmentSchema)
