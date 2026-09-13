import mongoose from 'mongoose'

const wardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, lowercase: true },
    description: { type: String, default: '' },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
    active: { type: Boolean, default: true },
    createdBy: String,
    updatedBy: String,
  },
  { timestamps: true }
)

wardSchema.index({ departmentId: 1, nameKey: 1 }, { unique: true })

export const Ward = mongoose.model('Ward', wardSchema)
