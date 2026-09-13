import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    username: { type: String, unique: true, lowercase: true, sparse: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['Reception', 'Nurse', 'Admin', 'Manager'], required: true },
    roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    lastLoginAt: Date,
    createdBy: String,
    updatedBy: String,
  },
  { timestamps: true }
)

export const User = mongoose.model('User', userSchema)
