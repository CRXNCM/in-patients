import mongoose from 'mongoose'

const auditEntrySchema = new mongoose.Schema(
  { action: String, by: String, at: String, note: String },
  { _id: false }
)

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    specialty: { type: String, required: true },
    visitPrice: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
    phone: { type: String, default: '' },
    department: { type: String, default: '' },
    createdBy: String,
    updatedBy: String,
    auditTrail: { type: [auditEntrySchema], default: [] },
  },
  { timestamps: true }
)

doctorSchema.index({ name: 1, specialty: 1 })
doctorSchema.index({ active: 1 })

export const Doctor = mongoose.model('Doctor', doctorSchema)
