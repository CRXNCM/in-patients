import { Router } from 'express'
import { authRequired, requireAnyPermission } from '../middleware/auth.js'
import { ADMIN_DASHBOARD_PERMISSIONS, buildAdminDashboard } from '../services/adminDashboard.js'

const router = Router()

router.get(
  '/dashboard',
  authRequired,
  requireAnyPermission(...ADMIN_DASHBOARD_PERMISSIONS),
  async (req, res) => {
    try {
      res.json(await buildAdminDashboard(req.auth))
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to load dashboard' })
    }
  }
)

export default router
