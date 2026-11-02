import { Router } from 'express'
import { authRequired, requirePermission, requireAnyPermission } from '../middleware/auth.js'
import { createCreditCompany, listCreditCompanies, updateCreditCompany } from '../services/creditCompanies.js'

const router = Router()

router.get(
  '/',
  authRequired,
  requireAnyPermission(
    'credit.view',
    'credit.create_admission',
    'credit.manage_companies',
    'admissions.convert_inpatient',
    'admissions.convert_inpatient_self',
    'admissions.request_inpatient'
  ),
  async (req, res) => {
    try {
      res.json({ companies: await listCreditCompanies(req.query) })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Failed to load credit companies.' })
    }
  }
)

router.post('/', authRequired, requirePermission('credit.manage_companies'), async (req, res) => {
  try {
    const result = await createCreditCompany(req.body || {}, req.user.name)
    if (result.error) return res.status(result.status || 400).json({ error: result.error })
    res.status(201).json(result.company)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create the credit company.' })
  }
})

router.patch('/:id', authRequired, requirePermission('credit.manage_companies'), async (req, res) => {
  try {
    const result = await updateCreditCompany(req.params.id, req.body || {}, req.user.name)
    if (result.error) return res.status(result.status || 400).json({ error: result.error })
    res.json(result.company)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update the credit company.' })
  }
})

export default router
