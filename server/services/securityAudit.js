import { SecurityEvent } from '../models/SecurityEvent.js'

export async function recordSecurityEvent({
  action,
  actor,
  targetType,
  targetId,
  targetName,
  added = [],
  removed = [],
  note = '',
}) {
  try {
    await SecurityEvent.create({
      action,
      actorId: actor?.id || actor?._id?.toString() || '',
      actorName: actor?.name || '',
      targetType: targetType || '',
      targetId: targetId ? String(targetId) : '',
      targetName: targetName || '',
      added,
      removed,
      note,
      at: new Date(),
    })
  } catch (err) {
    console.error('Failed to record security event:', err.message)
  }
}
