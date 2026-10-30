import mongoose from 'mongoose'

const historySchema = new mongoose.Schema(
  {
    action: String,
    by: String,
    byId: String,
    at: String,
    lineId: String,
    quantity: Number,
    outcome: String,
    reasonCode: String,
    reasonNote: String,
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
    requestedQuantity: Number,
    unitPrice: { type: Number, default: 0 },
    baseUnitPrice: { type: Number, default: 0 },
    priceMultiplier: { type: Number, default: 1 },
    instructions: String,
    suppliedQuantity: { type: Number, default: 0 },
    billedQuantity: { type: Number, default: 0 },
    receptionStatus: { type: String, default: 'not_sent' },
    billingRecordId: { type: String, default: '' },
    status: { type: String, default: 'pending' },
    reasonCode: { type: String, default: '' },
    reasonNote: { type: String, default: '' },
    history: { type: [historySchema], default: [] },
  },
  { _id: false }
)

const returnSchema = new mongoose.Schema(
  {
    id: String,
    lineId: String,
    quantity: Number,
    presentedQuantity: Number,
    acceptedQuantity: Number,
    notAcceptedQuantity: Number,
    reason: String,
    reasonCode: { type: String, default: '' },
    reasonNote: { type: String, default: '' },
    discrepancyReason: { type: String, default: '' },
    verificationNotes: { type: String, default: '' },
    physicalStatus: { type: String, default: '' },
    billingStatus: { type: String, default: '' },
    billingNote: { type: String, default: '' },
    billingRecordId: { type: String, default: '' },
    pharmacistId: String,
    pharmacistName: String,
    at: String,
    verifiedById: { type: String, default: '' },
    verifiedByName: { type: String, default: '' },
    verifiedAt: { type: String, default: '' },
    receptionBy: { type: String, default: '' },
    receptionAt: { type: String, default: '' },
    receptionNote: { type: String, default: '' },
    clientActionId: String,
    verifyActionId: { type: String, default: '' },
    history: { type: [historySchema], default: [] },
  },
  { _id: false }
)

const pharmacyOrderSchema = new mongoose.Schema(
  {
    submissionId: { type: String, required: true, unique: true },
    patientId: { type: String, required: true },
    patientName: String,
    admissionId: String,
    admissionNumber: String,
    ward: String,
    room: String,
    bed: String,
    admissionType: { type: String, default: '' },
    convertedFromEmergency: { type: Boolean, default: false },
    sourceRecordId: { type: String, default: '' },
    requestedById: String,
    requestedByName: String,
    requestedAt: String,
    status: { type: String, default: 'pending' },
    items: { type: [itemSchema], default: [] },
    returns: { type: [returnSchema], default: [] },
    history: { type: [historySchema], default: [] },
  },
  { timestamps: true }
)

pharmacyOrderSchema.index({ patientId: 1, admissionId: 1, requestedAt: -1 })
pharmacyOrderSchema.index({ status: 1, createdAt: -1 })
pharmacyOrderSchema.index({ admissionId: 1, createdAt: -1 })
pharmacyOrderSchema.index({ sourceRecordId: 1 })

export const PharmacyOrder = mongoose.model('PharmacyOrder', pharmacyOrderSchema)
