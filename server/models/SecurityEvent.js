import mongoose from 'mongoose'

const securityEventSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    actorId: String,
    actorName: String,
    targetType: String,
    targetId: String,
    targetName: String,
    added: { type: [String], default: [] },
    removed: { type: [String], default: [] },
    note: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { timestamps: false }
)

securityEventSchema.index({ at: -1 })

export const SecurityEvent = mongoose.model('SecurityEvent', securityEventSchema)
