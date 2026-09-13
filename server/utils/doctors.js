export const DOCTOR_SPECIALTIES = [
  'General Practitioner',
  'Internal Medicine',
  'Surgeon',
  'Pediatrician',
  'Gynecologist',
  'Cardiologist',
  'Orthopedic Specialist',
  'Dentist',
  'Radiologist',
  'Other',
]

function trimText(value) {
  return String(value ?? '').trim()
}

export function validateDoctorBody(body, { partial = false } = {}) {
  const errors = []
  const name = trimText(body?.name)
  const specialty = trimText(body?.specialty)

  if (!partial || body.name !== undefined) {
    if (!name) errors.push('Doctor name is required.')
    else if (name.length < 2) errors.push('Doctor name must be at least 2 characters.')
  }

  if (!partial || body.specialty !== undefined) {
    if (!specialty) errors.push('Specialty is required.')
    else if (!DOCTOR_SPECIALTIES.includes(specialty)) errors.push('Specialty is not valid.')
  }

  if (!partial || body.visitPrice !== undefined) {
    const price = Number(body?.visitPrice)
    if (Number.isNaN(price) || price < 0) errors.push('Visit price must be zero or greater.')
  }

  if (body?.active !== undefined && typeof body.active !== 'boolean') {
    errors.push('Active must be true or false.')
  }

  return errors
}

export function toFrontendDoctor(doc) {
  if (!doc) return null
  return {
    id: doc._id.toString(),
    name: doc.name,
    specialty: doc.specialty,
    visitPrice: doc.visitPrice,
    active: doc.active,
    phone: doc.phone || '',
    department: doc.department || '',
    createdBy: doc.createdBy || null,
    updatedBy: doc.updatedBy || null,
    createdAt: doc.createdAt?.toISOString?.() || null,
    updatedAt: doc.updatedAt?.toISOString?.() || null,
    auditTrail: doc.auditTrail || [],
  }
}

export function toFrontendAssignment(doc) {
  if (!doc) return null
  return {
    id: doc._id.toString(),
    patientId: doc.patientId,
    subjectType: doc.subjectType === 'baby' ? 'baby' : 'mother',
    babyId: doc.babyId || null,
    doctorId: doc.doctorId,
    doctorName: doc.doctorNameSnapshot,
    specialty: doc.specialtySnapshot,
    visitPrice: doc.visitPriceSnapshot,
    effectiveFrom: doc.effectiveFrom,
    effectiveTo: doc.effectiveTo,
    assignedBy: doc.assignedBy,
    assignedAt: doc.assignedAt?.toISOString?.() || doc.assignedAt || null,
    status: doc.status,
    endedBy: doc.endedBy || null,
    endedAt: doc.endedAt?.toISOString?.() || doc.endedAt || null,
  }
}
