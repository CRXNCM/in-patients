import { BED_STATUSES, ROOM_TYPES, trimText } from './hospitalSetup.js'

export const MAX_BULK_ROOMS = 200
export const MAX_BEDS_PER_ROOM = 40
export const MAX_BULK_BEDS = 500
export const INITIAL_BED_STATUSES = ['available', 'maintenance', 'out_of_service']

export function padNumber(value, width = 2) {
  const n = Number(value)
  const size = Number(width)
  if (!Number.isInteger(n) || n < 0) return ''
  if (!Number.isInteger(size) || size < 1) return String(n)
  return String(n).padStart(size, '0')
}

export function applyPattern(pattern, { number, room = '', prefix = '', padWidth = 2 } = {}) {
  return trimText(pattern).replace(/\{(number|n|room|prefix)\}/gi, (_, token) => {
    const key = String(token).toLowerCase()
    if (key === 'number' || key === 'n') return padNumber(number, padWidth)
    if (key === 'room') return trimText(room)
    if (key === 'prefix') return trimText(prefix)
    return ''
  })
}

function parsePositiveInt(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback
  const n = Number(value)
  return Number.isInteger(n) ? n : NaN
}

export function normalizeBulkOptions(body = {}, mode = 'rooms') {
  const padWidth = parsePositiveInt(body.padWidth, 2)
  const startNumber = parsePositiveInt(body.startNumber, 1)
  const roomCount = mode === 'rooms' ? parsePositiveInt(body.roomCount, null) : 1
  const bedsPerRoom = parsePositiveInt(mode === 'rooms' ? body.bedsPerRoom : body.bedCount ?? body.bedsPerRoom, null)
  const prefix = trimText(body.roomPrefix ?? body.prefix)
  const roomPattern = trimText(body.roomPattern) || (prefix ? '{prefix}-{number}' : '')
  const bedPattern = trimText(body.bedPattern) || '{room}-B{number}'
  const status = trimText(body.status) || 'available'
  const roomType = trimText(body.roomType)
  const dailyRate = body.dailyRate === undefined || body.dailyRate === '' ? null : Number(body.dailyRate)

  return {
    mode,
    wardId: trimText(body.wardId),
    roomId: trimText(body.roomId),
    roomType,
    dailyRate,
    roomCount,
    bedsPerRoom,
    roomPrefix: prefix,
    roomPattern,
    bedPattern,
    startNumber,
    padWidth,
    status,
  }
}

export function validateBulkOptions(options, mode = 'rooms') {
  const errors = []
  const { roomCount, bedsPerRoom, startNumber, padWidth, roomPattern, bedPattern, status, roomType, dailyRate } = options

  if (mode === 'rooms') {
    if (!options.wardId) errors.push('Ward is required.')
    if (!ROOM_TYPES.some((item) => item.value === roomType)) {
      errors.push('Room type must be General Ward, Private Room, ICU, Operation, or Delivery Room.')
    }
    if (!Number.isInteger(roomCount) || roomCount < 1 || roomCount > MAX_BULK_ROOMS) {
      errors.push(`Number of rooms must be between 1 and ${MAX_BULK_ROOMS}.`)
    }
    if (!trimText(roomPattern)) errors.push('Room naming pattern is required.')
    else if (roomCount > 1 && !/\{(number|n)\}/i.test(roomPattern)) {
      errors.push('Room naming pattern must include {number} when creating more than one room.')
    }
  } else if (!options.roomId) {
    errors.push('Room is required.')
  }

  if (!Number.isInteger(bedsPerRoom) || bedsPerRoom < 1 || bedsPerRoom > MAX_BEDS_PER_ROOM) {
    errors.push(`Beds per room must be between 1 and ${MAX_BEDS_PER_ROOM}.`)
  }
  if (!Number.isInteger(startNumber) || startNumber < 1 || startNumber > 9999) {
    errors.push('Starting number must be between 1 and 9999.')
  }
  if (!Number.isInteger(padWidth) || padWidth < 1 || padWidth > 4) {
    errors.push('Number padding must be between 1 and 4 digits.')
  }
  if (!trimText(bedPattern)) errors.push('Bed naming pattern is required.')
  else if (bedsPerRoom > 1 && !/\{(number|n)\}/i.test(bedPattern)) {
    errors.push('Bed naming pattern must include {number} when creating more than one bed.')
  }
  if (!INITIAL_BED_STATUSES.includes(status)) {
    errors.push('Initial bed status must be available, maintenance, or out of service.')
  }
  if (dailyRate != null && (Number.isNaN(dailyRate) || dailyRate < 0)) {
    errors.push('Daily rate cannot be negative.')
  }

  const totalBeds = (Number.isInteger(roomCount) ? roomCount : 0) * (Number.isInteger(bedsPerRoom) ? bedsPerRoom : 0)
  if (totalBeds > MAX_BULK_BEDS) {
    errors.push(`A bulk create cannot add more than ${MAX_BULK_BEDS} beds at once.`)
  }

  return errors
}

export function buildBulkPlan(options, mode = 'rooms') {
  const errors = validateBulkOptions(options, mode)
  if (errors.length) return { errors, rooms: [], roomCount: 0, bedCount: 0 }

  const rooms = []
  const roomNames = new Set()
  const bedNames = new Set()

  const count = mode === 'rooms' ? options.roomCount : 1
  for (let i = 0; i < count; i += 1) {
    const roomNumber = options.startNumber + i
    const roomName = mode === 'rooms'
      ? applyPattern(options.roomPattern, {
          number: roomNumber,
          prefix: options.roomPrefix,
          padWidth: options.padWidth,
        })
      : trimText(options.existingRoomName)

    if (!roomName) {
      return { errors: ['Generated room name is empty. Check the room naming pattern.'], rooms: [], roomCount: 0, bedCount: 0 }
    }
    if (roomName.length > 40) {
      return { errors: [`Generated room name "${roomName}" is longer than 40 characters.`], rooms: [], roomCount: 0, bedCount: 0 }
    }
    const roomKey = roomName.toLowerCase()
    if (roomNames.has(roomKey)) {
      return { errors: [`The plan would create duplicate room "${roomName}".`], rooms: [], roomCount: 0, bedCount: 0 }
    }
    roomNames.add(roomKey)

    const beds = []
    for (let j = 0; j < options.bedsPerRoom; j += 1) {
      const bedNumber = options.startNumber + j
      const bedName = applyPattern(options.bedPattern, {
        number: bedNumber,
        room: roomName,
        prefix: options.roomPrefix,
        padWidth: options.padWidth,
      })
      if (!bedName) {
        return { errors: ['Generated bed name is empty. Check the bed naming pattern.'], rooms: [], roomCount: 0, bedCount: 0 }
      }
      if (bedName.length > 40) {
        return { errors: [`Generated bed name "${bedName}" is longer than 40 characters.`], rooms: [], roomCount: 0, bedCount: 0 }
      }
      const bedKey = `${roomKey}::${bedName.toLowerCase()}`
      if (bedNames.has(bedKey) || bedNames.has(bedName.toLowerCase())) {
        return { errors: [`The plan would create duplicate bed "${bedName}".`], rooms: [], roomCount: 0, bedCount: 0 }
      }
      bedNames.add(bedKey)
      bedNames.add(bedName.toLowerCase())
      beds.push({ name: bedName, label: bedName })
    }
    rooms.push({ name: roomName, beds })
  }

  return {
    errors: [],
    rooms,
    roomCount: mode === 'rooms' ? rooms.length : 0,
    bedCount: rooms.reduce((sum, room) => sum + room.beds.length, 0),
    status: options.status,
  }
}

export function findPlanConflicts(plan, { existingRoomNames = [], existingBedLabels = [], existingBedNamesInRoom = [] } = {}) {
  const roomKeys = new Set(existingRoomNames.map((name) => String(name).toLowerCase()))
  const labelKeys = new Set(existingBedLabels.map((name) => String(name).toLowerCase()))
  const inRoomKeys = new Set(existingBedNamesInRoom.map((name) => String(name).toLowerCase()))
  const conflicts = []

  for (const room of plan.rooms || []) {
    if (roomKeys.has(room.name.toLowerCase())) {
      conflicts.push(`Room "${room.name}" already exists in this ward.`)
    }
    for (const bed of room.beds) {
      if (labelKeys.has(bed.label.toLowerCase()) || inRoomKeys.has(bed.name.toLowerCase())) {
        conflicts.push(`Bed "${bed.label}" already exists.`)
      }
    }
  }
  return conflicts
}

export { BED_STATUSES }
