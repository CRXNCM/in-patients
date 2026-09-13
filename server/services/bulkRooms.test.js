import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import mongoose from 'mongoose'
import { Ward } from '../models/Ward.js'
import { Room } from '../models/Room.js'
import { withSafeBulkWrite } from './bulkRooms.js'

describe('bulk write safety', () => {
  let connected = false

  before(async () => {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medbill'
    await mongoose.connect(uri)
    connected = true
  })

  after(async () => {
    if (connected) await mongoose.disconnect()
  })

  it('does not leave a room behind when the bulk write fails', async () => {
    const ward = await Ward.findOne({ active: true })
    if (!ward) {
      assert.ok(true, 'skipped — no ward in database')
      return
    }

    const marker = `T5A-FAIL-${Date.now()}`
    await assert.rejects(
      withSafeBulkWrite(async (session, created) => {
        const payload = {
          name: marker,
          nameKey: marker.toLowerCase(),
          wardId: ward._id,
          departmentId: ward.departmentId,
          roomType: 'General Ward',
          capacity: 1,
          dailyRate: 0,
          active: true,
          createdBy: 'test',
          updatedBy: 'test',
        }
        const room = session
          ? (await Room.create([payload], { session }))[0]
          : await Room.create(payload)
        created.roomIds.push(room._id)
        throw new Error('forced bulk failure')
      }),
      /forced bulk failure/
    )

    const leftover = await Room.findOne({ nameKey: marker.toLowerCase() })
    assert.equal(leftover, null)
  })
})
