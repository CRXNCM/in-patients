import mongoose from 'mongoose'

const bedSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, unique: true },
    name: { type: String, default: '' },
    nameKey: { type: String, default: '', lowercase: true },
    roomType: { type: String, required: true },
    dailyRate: { type: Number, required: true },
    status: {
      type: String,
      enum: ['available', 'occupied', 'maintenance', 'out_of_service'],
      default: 'available',
    },
    patientId: { type: String, default: null },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    wardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ward' },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
    createdBy: String,
    updatedBy: String,
  },
  { timestamps: true }
)

bedSchema.index({ roomId: 1, nameKey: 1 }, { unique: true, sparse: true })

export const Bed = mongoose.model('Bed', bedSchema)
