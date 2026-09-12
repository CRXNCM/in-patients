import mongoose from 'mongoose'

const depositSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, index: true },
    amount: { type: Number, required: true },
    method: { type: String, required: true },
    referenceNumber: { type: String, sparse: true, index: true },
    date: { type: String, required: true },
    receivedBy: String,
    isInitial: { type: Boolean, default: false },
  },
  { timestamps: true }
)

depositSchema.index({ referenceNumber: 1 }, { unique: true, sparse: true })

export const Deposit = mongoose.model('Deposit', depositSchema)
