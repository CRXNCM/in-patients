import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAdmissionType, validateBabyBody, resolveRecordSubject, babyFieldsFromBody } from './maternity.js'

describe('maternity admission type', () => {
  it('defaults unknown values to invalid', () => {
    assert.equal(normalizeAdmissionType('maternity'), 'maternity')
    assert.equal(normalizeAdmissionType('NORMAL'), 'normal')
    assert.equal(normalizeAdmissionType('twin'), null)
  })
})

describe('baby validation', () => {
  it('accepts incomplete newborn details before delivery fields are known', () => {
    assert.deepEqual(validateBabyBody({}), [])
    assert.deepEqual(validateBabyBody({ name: 'Baby of Hana' }), [])
  })

  it('rejects invalid weight and sex', () => {
    assert.match(validateBabyBody({ sex: 'Unknown' }).join(' '), /sex/)
    assert.match(validateBabyBody({ birthWeightGrams: -1 }).join(' '), /weight/)
  })
})

describe('record subject', () => {
  it('forces mother for normal admissions', () => {
    const result = resolveRecordSubject({ admissionType: 'normal' }, { subjectType: 'baby' }, { _id: 'x' })
    assert.deepEqual(result, { subjectType: 'mother', babyId: null })
  })

  it('requires a registered baby for baby records', () => {
    const missing = resolveRecordSubject({ admissionType: 'maternity' }, { subjectType: 'baby' }, null)
    assert.match(missing.error, /newborn/)
    const ok = resolveRecordSubject({ admissionType: 'maternity' }, { subjectType: 'baby' }, { _id: { toString: () => 'B1' } })
    assert.deepEqual(ok, { subjectType: 'baby', babyId: 'B1' })
  })

  it('rejects a baby id from another admission', () => {
    const result = resolveRecordSubject(
      { admissionType: 'maternity' },
      { subjectType: 'baby', babyId: 'OTHER' },
      { _id: { toString: () => 'B1' } }
    )
    assert.match(result.error, /does not belong/)
  })
})

describe('baby fields', () => {
  it('stores extra fields without dropping the core identity', () => {
    const fields = babyFieldsFromBody({ name: '  ', extra: { apgar1: 8 } })
    assert.equal(fields.name, 'Newborn')
    assert.equal(fields.extra.apgar1, 8)
  })
})
