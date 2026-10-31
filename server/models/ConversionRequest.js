import mongoose from 'mongoose'

const eventSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    byId: { type: String, default: '' },
    byName: { type: String, default: '' },
    byRole: { type: String, default: '' },
    at: { type: String, required: true },
    note: { type: String, default: '' },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false }
)

const conversionRequestSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, index: true },
    admissionId: { type: String, default: '', index: true },
    status: {
      type: String,
      enum: ['pending', 'returned', 'resubmitted', 'rejected', 'completed', 'cancelled'],
      default: 'pending',
      index: true,
    },
    pathway: { type: String, enum: ['reception', 'self'], default: 'reception' },
    reason: { type: String, default: '' },
    notes: { type: String, default: '' },
    requestedById: { type: String, default: '' },
    requestedByName: { type: String, default: '' },
    requestedByRole: { type: String, default: '' },
    requestedAt: { type: Date, default: Date.now },
    receptionNote: { type: String, default: '' },
    returnedReason: { type: String, default: '' },
    rejectedReason: { type: String, default: '' },
    cancelledReason: { type: String, default: '' },
    completedById: { type: String, default: '' },
    completedByName: { type: String, default: '' },
    completedByRole: { type: String, default: '' },
    completedAt: Date,
    conversionEvent: { type: mongoose.Schema.Types.Mixed, default: null },
    events: { type: [eventSchema], default: [] },
  },
  { timestamps: true }
)

conversionRequestSchema.index({ patientId: 1, status: 1, createdAt: -1 })
conversionRequestSchema.index(
  { patientId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['pending', 'returned', 'resubmitted'] } } }
)

export const ConversionRequest = mongoose.model('ConversionRequest', conversionRequestSchema)

export const ACTIVE_CONVERSION_STATUSES = ['pending', 'returned', 'resubmitted']
