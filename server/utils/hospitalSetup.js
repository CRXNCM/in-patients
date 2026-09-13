function trimText(value) {
  return String(value ?? '').trim()
}

export function validateDepartmentBody(body, { partial = false } = {}) {
  const errors = []
  if (!partial || body.name !== undefined) {
    const name = trimText(body?.name)
    if (!name) errors.push('Department name is required.')
    else if (name.length < 2) errors.push('Department name must be at least 2 characters.')
    else if (name.length > 80) errors.push('Department name must be 80 characters or fewer.')
  }
  if (body?.description !== undefined && String(body.description).length > 500) {
    errors.push('Description must be 500 characters or fewer.')
  }
  if (body?.active !== undefined && typeof body.active !== 'boolean') {
    errors.push('Status must be active or inactive.')
  }
  return errors
}

export function validateWardBody(body, { partial = false } = {}) {
  const errors = []
  if (!partial || body.name !== undefined) {
    const name = trimText(body?.name)
    if (!name) errors.push('Ward name is required.')
    else if (name.length < 2) errors.push('Ward name must be at least 2 characters.')
    else if (name.length > 80) errors.push('Ward name must be 80 characters or fewer.')
  }
  if (!partial || body.departmentId !== undefined) {
    if (!trimText(body?.departmentId)) errors.push('Department is required.')
  }
  if (body?.description !== undefined && String(body.description).length > 500) {
    errors.push('Description must be 500 characters or fewer.')
  }
  if (body?.active !== undefined && typeof body.active !== 'boolean') {
    errors.push('Status must be active or inactive.')
  }
  return errors
}

export function toFrontendDepartment(doc, wardCount = 0) {
  if (!doc) return null
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description || '',
    status: doc.active === false ? 'inactive' : 'active',
    active: doc.active !== false,
    wardCount,
    createdAt: doc.createdAt?.toISOString?.() || null,
    updatedAt: doc.updatedAt?.toISOString?.() || null,
    createdBy: doc.createdBy || null,
    updatedBy: doc.updatedBy || null,
  }
}

export const ROOM_TYPES = [
  { value: 'General Ward', dailyRate: 1500 },
  { value: 'Private Room', dailyRate: 5000 },
  { value: 'ICU', dailyRate: 8000 },
  { value: 'Operation', dailyRate: 10000 },
  { value: 'Delivery Room', dailyRate: 1500 },
]

export const BED_STATUSES = ['available', 'occupied', 'maintenance', 'out_of_service']

export function defaultRateForRoomType(roomType) {
  return ROOM_TYPES.find((item) => item.value === roomType)?.dailyRate ?? 0
}

export function validateRoomBody(body, { partial = false } = {}) {
  const errors = []
  if (!partial || body.name !== undefined) {
    const name = trimText(body?.name)
    if (!name) errors.push('Room number is required.')
    else if (name.length > 40) errors.push('Room number must be 40 characters or fewer.')
  }
  if (!partial || body.wardId !== undefined) {
    if (!trimText(body?.wardId)) errors.push('Ward is required.')
  }
  if (!partial || body.roomType !== undefined) {
    if (!ROOM_TYPES.some((item) => item.value === body.roomType)) {
      errors.push('Room type must be General Ward, Private Room, ICU, Operation, or Delivery Room.')
    }
  }
  if (!partial || body.capacity !== undefined) {
    const capacity = Number(body.capacity)
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 40) {
      errors.push('Capacity must be a whole number between 1 and 40.')
    }
  }
  if (body?.dailyRate !== undefined && body.dailyRate !== '') {
    const rate = Number(body.dailyRate)
    if (Number.isNaN(rate) || rate < 0) errors.push('Daily rate cannot be negative.')
  }
  if (body?.active !== undefined && typeof body.active !== 'boolean') {
    errors.push('Status must be active or inactive.')
  }
  return errors
}

export function validateBedBody(body, { partial = false } = {}) {
  const errors = []
  if (!partial || body.name !== undefined) {
    const name = trimText(body?.name)
    if (!name) errors.push('Bed identifier is required.')
    else if (name.length > 40) errors.push('Bed identifier must be 40 characters or fewer.')
  }
  if (!partial || body.roomId !== undefined) {
    if (!trimText(body?.roomId)) errors.push('Room is required.')
  }
  if (body?.status !== undefined && !BED_STATUSES.includes(body.status)) {
    errors.push('Bed status is not valid.')
  }
  if (body?.dailyRate !== undefined && body.dailyRate !== '') {
    const rate = Number(body.dailyRate)
    if (Number.isNaN(rate) || rate < 0) errors.push('Daily rate cannot be negative.')
  }
  return errors
}

export function toFrontendWard(doc, departmentDoc = null, roomCount = 0) {
  if (!doc) return null
  const department = departmentDoc || doc.departmentId
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description || '',
    departmentId: department?._id ? String(department._id) : String(doc.departmentId),
    departmentName: department?.name || '',
    departmentActive: department?.active !== false,
    roomCount,
    status: doc.active === false ? 'inactive' : 'active',
    active: doc.active !== false,
    createdAt: doc.createdAt?.toISOString?.() || null,
    updatedAt: doc.updatedAt?.toISOString?.() || null,
    createdBy: doc.createdBy || null,
    updatedBy: doc.updatedBy || null,
  }
}

export function toFrontendRoom(doc, extras = {}) {
  if (!doc) return null
  const ward = extras.ward || doc.wardId
  const department = extras.department || doc.departmentId
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description || '',
    wardId: ward?._id ? String(ward._id) : String(doc.wardId),
    wardName: ward?.name || extras.wardName || '',
    departmentId: department?._id ? String(department._id) : String(doc.departmentId),
    departmentName: department?.name || extras.departmentName || '',
    roomType: doc.roomType,
    capacity: doc.capacity,
    dailyRate: doc.dailyRate || 0,
    bedCount: extras.bedCount ?? 0,
    occupiedCount: extras.occupiedCount ?? 0,
    status: doc.active === false ? 'inactive' : 'active',
    active: doc.active !== false,
    createdAt: doc.createdAt?.toISOString?.() || null,
    updatedAt: doc.updatedAt?.toISOString?.() || null,
  }
}

export function toFrontendBed(doc, extras = {}) {
  if (!doc) return null
  const room = extras.room || doc.roomId
  const ward = extras.ward || doc.wardId
  return {
    id: doc._id.toString(),
    label: doc.label,
    name: doc.name || doc.label,
    roomId: room?._id ? String(room._id) : doc.roomId ? String(doc.roomId) : null,
    roomName: room?.name || extras.roomName || '',
    wardId: ward?._id ? String(ward._id) : doc.wardId ? String(doc.wardId) : null,
    wardName: ward?.name || extras.wardName || '',
    departmentId: doc.departmentId ? String(doc.departmentId) : null,
    roomType: doc.roomType,
    dailyRate: doc.dailyRate,
    status: doc.status,
    patientId: doc.patientId || null,
    createdAt: doc.createdAt?.toISOString?.() || null,
    updatedAt: doc.updatedAt?.toISOString?.() || null,
  }
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function nameEqualsFilter(name) {
  return { name: { $regex: `^${escapeRegex(trimText(name))}$`, $options: 'i' } }
}

export { trimText }
