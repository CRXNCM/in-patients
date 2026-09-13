import { Router } from 'express'
import { authRequired, requireAnyPermission } from '../middleware/auth.js'
import { runDailyChargesForActivePatients } from '../services/autoCharges.js'

const router = Router()

router.post('/daily', authRequired, requireAnyPermission('admissions.edit', 'system.modify_settings'), async (req, res) => {
  try {
    const result = await runDailyChargesForActivePatients(req.body?.throughDate)
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to generate daily charges' })
  }
})

export default router
