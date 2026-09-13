import mongoose from 'mongoose'

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameKey: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, default: '' },
    active: { type: Boolean, default: true },
    createdBy: String,
    updatedBy: String,
  },
  { timestamps: true }
)

export const Department = mongoose.model('Department', departmentSchema)
