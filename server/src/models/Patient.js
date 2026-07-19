import mongoose from 'mongoose'

const patientSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    age: Number,
    dateOfBirth: String,
    gender: { type: String, required: true },
    phone: String,
    address: { type: String, required: true },
    emergencyContact: { type: String, required: true },
    emergencyPhone: String,
    mrn: { type: String, sparse: true, unique: true },
    nationalId: { type: String, sparse: true, unique: true },
    admissionReason: { type: String, required: true },
    admissionDate: { type: String, required: true },
    status: { type: String, enum: ['admitted', 'pending-discharge', 'discharged'], default: 'admitted' },
    pendingDischarge: { type: Boolean, default: false },
    room: String,
    bed: String,
    bedId: String,
    depositTotal: { type: Number, default: 0 },
    disabledDoctorVisitDates: { type: [String], default: [] },
    createdBy: String,
    updatedBy: String,
  },
  { timestamps: true }
)

export const Patient = mongoose.model('Patient', patientSchema)
