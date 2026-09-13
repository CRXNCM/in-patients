import mongoose from 'mongoose'
import { ACCESS_ROLES } from '../utils/roles.js'

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true },
    accessRole: { type: String, enum: ACCESS_ROLES, required: true },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    permissionsSetAt: Date,
    active: { type: Boolean, default: true },
    system: { type: Boolean, default: false },
    createdBy: String,
    updatedBy: String,
  },
  { timestamps: true }
)

export const Role = mongoose.model('Role', roleSchema)
