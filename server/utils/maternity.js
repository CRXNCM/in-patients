import { isValidDateString } from './validation.js'

const ADMISSION_TYPES = ['normal', 'maternity']
const SUBJECT_TYPES = ['mother', 'baby']
const BABY_SEX = ['Male', 'Female', 'Undetermined', '']
const BABY_STATUSES = ['admitted', 'discharged']

export function normalizeAdmissionType(value) {
  const type = String(value || 'normal').trim().toLowerCase()
  return ADMISSION_TYPES.includes(type) ? type : null
}

export function toFrontendBaby(doc) {
  if (!doc) return null
  return {
    id: doc._id.toString(),
    motherPatientId: doc.motherPatientId,
    name: doc.name || 'Newborn',
    sex: doc.sex || '',
    dateOfBirth: doc.dateOfBirth || '',
    timeOfBirth: doc.timeOfBirth || '',
    birthWeightGrams: doc.birthWeightGrams ?? null,
    deliveryType: doc.deliveryType || '',
    notes: doc.notes || '',
    status: doc.status || 'admitted',
    extra: doc.extra && typeof doc.extra === 'object' ? doc.extra : {},
  }
}

export function validateBabyBody(body = {}) {
  const errors = []
  if (body.sex !== undefined && !BABY_SEX.includes(String(body.sex))) {
    errors.push('Baby sex must be Male, Female, or Undetermined.')
  }
  if (body.dateOfBirth) {
    if (!isValidDateString(body.dateOfBirth)) errors.push('Baby date of birth is not valid.')
  }
  if (body.timeOfBirth) {
    if (!/^\d{2}:\d{2}$/.test(String(body.timeOfBirth))) {
      errors.push('Baby time of birth must be HH:MM.')
    }
  }
  if (body.birthWeightGrams !== undefined && body.birthWeightGrams !== null && body.birthWeightGrams !== '') {
    const weight = Number(body.birthWeightGrams)
    if (Number.isNaN(weight) || weight < 0 || weight > 10000) {
      errors.push('Birth weight must be between 0 and 10000 grams.')
    }
  }
  if (body.status !== undefined && !BABY_STATUSES.includes(String(body.status))) {
    errors.push('Baby status must be admitted or discharged.')
  }
  return errors
}

export function resolveRecordSubject(patient, body = {}, baby = null) {
  if (patient.admissionType !== 'maternity') {
    return { subjectType: 'mother', babyId: null }
  }

  const requested = String(body.subjectType || 'mother').trim().toLowerCase()
  if (!SUBJECT_TYPES.includes(requested)) {
    return { error: 'Subject must be mother or baby.' }
  }

  if (requested === 'baby') {
    if (!baby) {
      return { error: 'Register the newborn before adding baby records.' }
    }
    const babyId = baby._id.toString()
    if (body.babyId && String(body.babyId) !== babyId) {
      return { error: 'Baby does not belong to this maternity admission.' }
    }
    return { subjectType: 'baby', babyId }
  }

  return { subjectType: 'mother', babyId: null }
}

export function babyFieldsFromBody(body = {}) {
  const extra = body.extra && typeof body.extra === 'object' && !Array.isArray(body.extra) ? body.extra : {}
  const weight =
    body.birthWeightGrams === undefined || body.birthWeightGrams === null || body.birthWeightGrams === ''
      ? null
      : Number(body.birthWeightGrams)

  return {
    name: String(body.name || 'Newborn').trim() || 'Newborn',
    sex: BABY_SEX.includes(String(body.sex || '')) ? String(body.sex || '') : '',
    dateOfBirth: String(body.dateOfBirth || '').trim(),
    timeOfBirth: String(body.timeOfBirth || '').trim(),
    birthWeightGrams: Number.isNaN(weight) ? null : weight,
    deliveryType: String(body.deliveryType || '').trim(),
    notes: String(body.notes || '').trim(),
    status: BABY_STATUSES.includes(String(body.status || 'admitted')) ? String(body.status || 'admitted') : 'admitted',
    extra,
  }
}
