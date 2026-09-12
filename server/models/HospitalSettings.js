import mongoose from 'mongoose'

const hospitalSettingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'default', unique: true },
    name: String,
    address: String,
    tin: String,
    currency: { type: String, default: 'ETB' },
    lowBalanceThreshold: Number,
    receiptFooter: String,
    vatPercent: { type: Number, default: 0 },
    dailyDoctorVisitFee: Number,
    dailyDoctorVisitName: String,
  },
  { timestamps: true }
)

export const HospitalSettings = mongoose.model('HospitalSettings', hospitalSettingsSchema)
