import mongoose from 'mongoose'

const creditCompanySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    nameKey: { type: String, required: true, unique: true },
    code: { type: String, default: '' },
    contactPerson: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    address: { type: String, default: '' },
    notes: { type: String, default: '' },
    active: { type: Boolean, default: true },
    createdBy: String,
    updatedBy: String,
  },
  { timestamps: true }
)

creditCompanySchema.index({ name: 1 })
creditCompanySchema.index({ active: 1, name: 1 })

export const CreditCompany = mongoose.model('CreditCompany', creditCompanySchema)
