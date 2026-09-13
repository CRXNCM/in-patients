import { Router } from 'express'
import { SecurityEvent } from '../models/SecurityEvent.js'
import { authRequired, requirePermission } from '../middleware/auth.js'

const router = Router()

router.use(authRequired, requirePermission('system.view_audit_logs'))

router.get('/', async (_req, res) => {
  try {
    const events = await SecurityEvent.find().sort({ at: -1 }).limit(200)
    res.json(
      events.map((event) => ({
        id: event._id.toString(),
        action: event.action,
        actorName: event.actorName,
        targetType: event.targetType,
        targetId: event.targetId,
        targetName: event.targetName,
        added: event.added || [],
        removed: event.removed || [],
        note: event.note || '',
        at: event.at?.toISOString?.() || null,
      }))
    )
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load audit log' })
  }
})

export default router
