import mongoose from 'mongoose'

const doctorAssignmentSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, index: true },
    subjectType: { type: String, enum: ['mother', 'baby'], default: 'mother' },
    babyId: { type: String, default: null },
    doctorId: { type: String, required: true },
    doctorNameSnapshot: { type: String, required: true },
    specialtySnapshot: { type: String, required: true },
    visitPriceSnapshot: { type: Number, required: true, min: 0 },
    effectiveFrom: { type: String, required: true },
    effectiveTo: { type: String, default: null },
    assignedBy: String,
    assignedAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'ended'], default: 'active' },
    endedBy: String,
    endedAt: Date,
  },
  { timestamps: true }
)

doctorAssignmentSchema.index({ patientId: 1, doctorId: 1, status: 1 })
doctorAssignmentSchema.index(
  { patientId: 1, doctorId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
)

export const DoctorAssignment = mongoose.model('DoctorAssignment', doctorAssignmentSchema)
