import mongoose from 'mongoose'

const maternityBabySchema = new mongoose.Schema(
  {
    motherPatientId: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: 'Newborn' },
    sex: { type: String, enum: ['Male', 'Female', 'Undetermined', ''], default: '' },
    dateOfBirth: { type: String, default: '' },
    timeOfBirth: { type: String, default: '' },
    birthWeightGrams: { type: Number, default: null },
    deliveryType: { type: String, default: '' },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['admitted', 'discharged'], default: 'admitted' },
    extra: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: String,
    updatedBy: String,
  },
  { timestamps: true }
)

export const MaternityBaby = mongoose.model('MaternityBaby', maternityBabySchema)
