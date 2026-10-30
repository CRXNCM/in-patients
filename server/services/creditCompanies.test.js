import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { companyNameKey, normalizeCompanyName, validateCompanyBody } from './creditCompanies.js'

describe('credit company names', () => {
  it('normalizes surrounding space and case for uniqueness', () => {
    assert.equal(normalizeCompanyName('  Ethio  Insurance  '), 'Ethio Insurance')
    assert.equal(companyNameKey('  ETHIO insurance '), companyNameKey('Ethio Insurance'))
  })

  it('requires a name and rejects a bad email', () => {
    assert.deepEqual(validateCompanyBody({ name: '' }).errors, ['Company name is required.'])
    assert.ok(validateCompanyBody({ name: 'Acme', email: 'not-an-email' }).errors.includes('Email is not a valid email address.'))
    assert.equal(validateCompanyBody({ name: 'Acme Ltd' }).errors.length, 0)
  })
})
