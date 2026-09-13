import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  escapeRegex,
  normalizeSearchQuery,
  allowedSearchScopes,
  resultRoute,
  item,
  buildSearchResults,
  SEARCH_LIMIT,
  MAX_QUERY_LENGTH,
} from './globalSearch.js'

function roleWith(permissions) {
  return { slug: 'custom', active: true, permissions }
}

describe('normalizeSearchQuery', () => {
  it('requires a non-empty query', () => {
    assert.equal(normalizeSearchQuery(undefined).error, 'Search query is required')
    assert.equal(normalizeSearchQuery('   ').error, 'Search query is required')
  })

  it('rejects queries shorter than 2 characters', () => {
    assert.equal(normalizeSearchQuery('a').error, 'Search query is too short')
  })

  it('rejects queries that are too long', () => {
    assert.equal(normalizeSearchQuery('x'.repeat(MAX_QUERY_LENGTH + 1)).error, 'Search query is too long')
  })

  it('trims a valid query', () => {
    assert.equal(normalizeSearchQuery('  Abebe  ').q, 'Abebe')
  })
})

describe('escapeRegex', () => {
  it('escapes regex metacharacters', () => {
    assert.equal(escapeRegex('a+b'), 'a\\+b')
  })
})

describe('allowedSearchScopes', () => {
  it('does not include patients without patients.view or admissions.view', () => {
    const scopes = allowedSearchScopes(roleWith(['doctors.view']))
    assert.equal(scopes.patients, false)
    assert.equal(scopes.doctors, true)
    assert.equal(scopes.users, false)
  })

  it('includes patients when only admissions.view is granted', () => {
    assert.equal(allowedSearchScopes(roleWith(['admissions.view'])).patients, true)
  })

  it('treats Super Admin as having every search scope', () => {
    const scopes = allowedSearchScopes({ slug: 'super-admin', active: true, permissions: [] })
    assert.equal(scopes.patients, true)
    assert.equal(scopes.doctors, true)
    assert.equal(scopes.rooms, true)
    assert.equal(scopes.departments, true)
    assert.equal(scopes.wards, true)
    assert.equal(scopes.users, true)
  })
})

describe('resultRoute', () => {
  it('uses existing stay routes for Reception and Nurse only', () => {
    assert.equal(resultRoute('Reception', 'patient', 'PAT-1'), '/reception/patient/PAT-1')
    assert.equal(resultRoute('Nurse', 'patient', 'PAT-1'), '/nurse/patient/PAT-1')
    assert.equal(resultRoute('Admin', 'patient', 'PAT-1'), null)
    assert.equal(resultRoute('Manager', 'patient', 'PAT-1'), null)
  })

  it('uses existing admin catalog routes only for Admin accessRole', () => {
    assert.equal(resultRoute('Admin', 'doctor', '1'), '/admin/doctors')
    assert.equal(resultRoute('Nurse', 'doctor', '1'), null)
    assert.equal(resultRoute('Admin', 'user', '1'), '/admin/users')
  })
})

describe('search items omit sensitive fields', () => {
  it('does not include password, prices, or balances', () => {
    const row = item('doctor', '1', 'Dr. A', 'Surgeon', 'Active', '/admin/doctors')
    const raw = JSON.stringify(row)
    assert.equal(raw.includes('password'), false)
    assert.equal(raw.includes('visitPrice'), false)
    assert.equal(raw.includes('deposit'), false)
    assert.equal(raw.includes('dailyRate'), false)
  })
})

describe('buildSearchResults', () => {
  it('throws 400 for a short query', async () => {
    await assert.rejects(
      () => buildSearchResults({ role: roleWith(['patients.view']), user: { role: 'Nurse' } }, 'x'),
      (err) => err.status === 400
    )
  })

  it('does not query unauthorized collections', async () => {
    let patientCalled = false
    let userCalled = false
    await buildSearchResults(
      { role: roleWith(['doctors.view']), user: { role: 'Admin' } },
      'ab',
      {
        Doctor: {
          find: () => ({
            sort() {
              return this
            },
            limit() {
              return this
            },
            select() {
              return this
            },
            lean: async () => [],
          }),
        },
        Patient: {
          find: () => {
            patientCalled = true
            return { sort() { return this }, limit() { return this }, select() { return this }, lean: async () => [] }
          },
        },
        User: {
          find: () => {
            userCalled = true
            return { sort() { return this }, limit() { return this }, select() { return this }, lean: async () => [] }
          },
        },
      }
    )
    assert.equal(patientCalled, false)
    assert.equal(userCalled, false)
  })

  it('limits patient rows', async () => {
    const docs = Array.from({ length: SEARCH_LIMIT + 3 }, (_, i) => ({
      patientId: `PAT-${i}`,
      name: `Abebe ${i}`,
      status: 'admitted',
      mrn: null,
      room: 'A',
      bed: '1',
    }))
    const payload = await buildSearchResults(
      { role: roleWith(['patients.view']), user: { role: 'Nurse' } },
      'ab',
      {
        Patient: {
          find: () => ({
            sort() {
              return this
            },
            limit() {
              return this
            },
            select() {
              return this
            },
            lean: async () => docs.slice(0, SEARCH_LIMIT + 1),
          }),
        },
      }
    )
    assert.equal(payload.groups.patients.items.length, SEARCH_LIMIT)
    assert.equal(payload.groups.patients.hasMore, true)
    assert.equal(payload.groups.doctors, undefined)
    assert.ok(payload.results.every((row) => row.deposit === undefined && row.password === undefined))
  })
})
