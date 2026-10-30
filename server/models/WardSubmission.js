import mongoose from 'mongoose'

const originalItemSchema = new mongoose.Schema(
  {
    category: String,
    name: String,
    quantity: Number,
    unit: String,
    instructions: String,
  },
  { _id: false }
)

const wardSubmissionSchema = new mongoose.Schema(
  {
    submissionId: { type: String, required: true, unique: true },
    patientId: { type: String, required: true },
    admissionId: { type: String, default: '' },
    signature: { type: String, required: true },
    status: { type: String, default: 'processing' },
    submittedById: { type: String, default: '' },
    submittedByName: { type: String, default: '' },
    staffAccount: { type: String, default: '' },
    submittedAt: Date,
    originalItems: { type: [originalItemSchema], default: [] },
    response: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
)

export const WardSubmission = mongoose.model('WardSubmission', wardSubmissionSchema)
