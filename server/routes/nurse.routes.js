import { Router } from 'express'
import { authRequired, requirePermission } from '../middleware/auth.js'
import { NURSE_DASHBOARD_PERMISSION, buildNurseDashboard } from '../services/nurseDashboard.js'

const router = Router()

router.get(
  '/dashboard',
  authRequired,
  requirePermission(NURSE_DASHBOARD_PERMISSION),
  async (req, res) => {
    try {
      res.json(await buildNurseDashboard(req.user))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to load dashboard' })
    }
  }
)

export default router
