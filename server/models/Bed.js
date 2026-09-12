import mongoose from 'mongoose'

const bedSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, unique: true },
    roomType: { type: String, required: true },
    dailyRate: { type: Number, required: true },
    status: { type: String, enum: ['available', 'occupied'], default: 'available' },
    patientId: { type: String, default: null },
  },
  { timestamps: true }
)

export const Bed = mongoose.model('Bed', bedSchema)
