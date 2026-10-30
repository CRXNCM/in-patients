import mongoose from 'mongoose'

const historySchema = new mongoose.Schema(
  {
    action: String,
    by: String,
    byId: String,
    at: String,
    lineId: String,
    note: String,
    clientActionId: String,
  },
  { _id: false }
)

const itemSchema = new mongoose.Schema(
  {
    lineId: String,
    catalogItemId: String,
    name: String,
    unit: String,
    quantity: Number,
    unitPrice: { type: Number, default: 0 },
    baseUnitPrice: { type: Number, default: 0 },
    priceMultiplier: { type: Number, default: 1 },
    priority: { type: String, default: 'routine' },
    note: { type: String, default: '' },
    status: { type: String, default: 'pending' },
    receptionStatus: { type: String, default: 'not_sent' },
    billingRecordId: { type: String, default: '' },
    completionNote: { type: String, default: '' },
    reason: { type: String, default: '' },
    approvedBy: { type: String, default: '' },
    approvedAt: { type: String, default: '' },
    history: { type: [historySchema], default: [] },
  },
  { _id: false }
)

const laboratoryOrderSchema = new mongoose.Schema(
  {
    submissionId: { type: String, required: true, unique: true },
    sourceRecordId: { type: String, default: '' },
    patientId: { type: String, required: true },
    patientName: String,
    admissionId: String,
    admissionNumber: String,
    ward: String,
    room: String,
    bed: String,
    admissionType: { type: String, default: '' },
    convertedFromEmergency: { type: Boolean, default: false },
    requestedById: String,
    requestedByName: String,
    requestedAt: String,
    status: { type: String, default: 'pending' },
    items: { type: [itemSchema], default: [] },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true }
)

laboratoryOrderSchema.index({ status: 1, createdAt: -1 })
laboratoryOrderSchema.index({ patientId: 1, admissionId: 1, createdAt: -1 })
laboratoryOrderSchema.index({ admissionId: 1, createdAt: -1 })
laboratoryOrderSchema.index({ sourceRecordId: 1 })

export const LaboratoryOrder = mongoose.model('LaboratoryOrder', laboratoryOrderSchema)
