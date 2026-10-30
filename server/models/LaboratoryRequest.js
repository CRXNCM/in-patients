import mongoose from 'mongoose'

const laboratoryRequestSchema = new mongoose.Schema(
  {
    submissionId: { type: String, required: true },
    lineId: { type: String, required: true },
    patientId: { type: String, required: true },
    request: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
)

laboratoryRequestSchema.index({ submissionId: 1, lineId: 1 }, { unique: true })
laboratoryRequestSchema.index({ patientId: 1, createdAt: -1 })

export const LaboratoryRequest = mongoose.model('LaboratoryRequest', laboratoryRequestSchema)
