import mongoose from 'mongoose'

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, lowercase: true },
    wardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ward', required: true },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    roomType: { type: String, required: true },
    capacity: { type: Number, required: true, min: 1 },
    dailyRate: { type: Number, default: 0, min: 0 },
    description: { type: String, default: '' },
    active: { type: Boolean, default: true },
    createdBy: String,
    updatedBy: String,
  },
  { timestamps: true }
)

roomSchema.index({ wardId: 1, nameKey: 1 }, { unique: true })

export const Room = mongoose.model('Room', roomSchema)
