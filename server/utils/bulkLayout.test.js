import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  applyPattern,
  buildBulkPlan,
  findPlanConflicts,
  normalizeBulkOptions,
  validateBulkOptions,
} from './bulkLayout.js'

function plan(overrides, mode = 'rooms') {
  return buildBulkPlan(normalizeBulkOptions({
    wardId: 'ward-1',
    roomType: 'General Ward',
    roomCount: 2,
    bedsPerRoom: 2,
    roomPrefix: 'GW',
    roomPattern: '{prefix}-{number}',
    bedPattern: '{room}-B{number}',
    startNumber: 1,
    padWidth: 2,
    ...overrides,
  }, mode), mode)
}

describe('bulk naming', () => {
  it('builds 40 rooms × 2 beds', () => {
    const result = plan({ roomCount: 40, bedsPerRoom: 2, roomPrefix: 'GW' })
    assert.equal(result.errors.length, 0)
    assert.equal(result.roomCount, 40)
    assert.equal(result.bedCount, 80)
    assert.equal(result.rooms[0].name, 'GW-01')
    assert.deepEqual(result.rooms[0].beds.map((bed) => bed.name), ['GW-01-B01', 'GW-01-B02'])
    assert.equal(result.rooms[39].name, 'GW-40')
    assert.deepEqual(result.rooms[39].beds.map((bed) => bed.name), ['GW-40-B01', 'GW-40-B02'])
  })

  it('builds 20 rooms × 1 bed', () => {
    const result = plan({ roomCount: 20, bedsPerRoom: 1, roomPrefix: 'ICU', roomType: 'ICU' })
    assert.equal(result.bedCount, 20)
    assert.equal(result.rooms[0].name, 'ICU-01')
    assert.equal(result.rooms[0].beds[0].name, 'ICU-01-B01')
    assert.equal(result.rooms[19].name, 'ICU-20')
  })

  it('builds 10 rooms × 1 bed', () => {
    const result = plan({ roomCount: 10, bedsPerRoom: 1, roomPrefix: 'NICU', roomType: 'ICU' })
    assert.equal(result.roomCount, 10)
    assert.equal(result.bedCount, 10)
    assert.equal(result.rooms[9].name, 'NICU-10')
  })

  it('applies a custom start number and padding', () => {
    assert.equal(applyPattern('{prefix}-{number}', { prefix: 'GW', number: 7, padWidth: 3 }), 'GW-007')
    const result = plan({ startNumber: 5, padWidth: 2, roomCount: 2 })
    assert.equal(result.rooms[0].name, 'GW-05')
    assert.equal(result.rooms[1].name, 'GW-06')
  })
})

describe('bulk validation', () => {
  it('requires {number} when creating more than one room or bed', () => {
    const rooms = validateBulkOptions(normalizeBulkOptions({
      wardId: 'w',
      roomType: 'ICU',
      roomCount: 2,
      bedsPerRoom: 1,
      roomPattern: 'ICU',
      bedPattern: '{room}-B{number}',
    }, 'rooms'), 'rooms')
    assert.ok(rooms.some((item) => /Room naming pattern/.test(item)))

    const beds = validateBulkOptions(normalizeBulkOptions({
      roomId: 'r',
      bedCount: 2,
      bedPattern: 'BED',
    }, 'beds'), 'beds')
    assert.ok(beds.some((item) => /Bed naming pattern/.test(item)))
  })

  it('rejects occupied as an initial status', () => {
    const errors = validateBulkOptions(normalizeBulkOptions({
      wardId: 'w',
      roomType: 'ICU',
      roomCount: 1,
      bedsPerRoom: 1,
      roomPattern: 'ICU-{number}',
      status: 'occupied',
    }, 'rooms'), 'rooms')
    assert.ok(errors.some((item) => /available, maintenance/.test(item)))
  })

  it('detects duplicate names against existing rooms and beds', () => {
    const result = plan({ roomCount: 2, bedsPerRoom: 2 })
    const conflicts = findPlanConflicts(result, {
      existingRoomNames: ['GW-02'],
      existingBedLabels: ['GW-01-B01'],
    })
    assert.ok(conflicts.some((item) => /GW-02/.test(item)))
    assert.ok(conflicts.some((item) => /GW-01-B01/.test(item)))
  })
})
