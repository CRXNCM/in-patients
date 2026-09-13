export function isMaternityAdmission(patient) {
  return patient?.admissionType === 'maternity'
}

export function subjectLabel(subjectType) {
  return subjectType === 'baby' ? 'Baby' : 'Mother'
}
