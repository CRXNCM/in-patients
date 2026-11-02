import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validatePersonalInfoBody } from './validation.js'

describe('personal information edits', () => {
  it('requires a real name and accepts a birthday and address', () => {
    assert.ok(validatePersonalInfoBody({ name: '' }).includes('Full name is required.'))
    assert.ok(validatePersonalInfoBody({ name: '12' }).includes('Name cannot contain only numbers.'))
    assert.ok(validatePersonalInfoBody({ name: 'Hana', dateOfBirth: 'not-a-date' }).length > 0)
    assert.deepEqual(
      validatePersonalInfoBody({
        name: 'Hana Bekele',
        gender: 'Female',
        dateOfBirth: '1994-02-11',
        address: 'Kebele 05, Dire Dawa',
        phone: '0911234567',
      }),
      []
    )
  })

  it('allows clearing the date of birth', () => {
    assert.deepEqual(validatePersonalInfoBody({ name: 'Hana Bekele', dateOfBirth: '' }), [])
  })
})
