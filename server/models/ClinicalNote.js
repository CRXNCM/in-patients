import mongoose from 'mongoose'

const editHistorySchema = new mongoose.Schema(
  {
    previousNote: { type: String, required: true },
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    editedAt: { type: Date, required: true, default: Date.now },
  },
  { _id: false }
)

const clinicalNoteSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    patientId: { type: String, required: true, index: true },
    admissionId: { type: String, required: true, index: true },
    note: { type: String, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    isEdited: { type: Boolean, default: false },
    editHistory: { type: [editHistorySchema], default: [] },
    isVoided: { type: Boolean, default: false },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    voidedAt: Date,
    voidReason: String,
  },
  { timestamps: true }
)

clinicalNoteSchema.index({ patientId: 1, admissionId: 1, createdAt: -1 })

export const ClinicalNote = mongoose.model('ClinicalNote', clinicalNoteSchema)
