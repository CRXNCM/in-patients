import { Router } from 'express'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { ServiceCategory } from '../models/ServiceCategory.js'
import { authRequired, requireRole } from '../middleware/auth.js'
import { toFrontendCategory, toFrontendSettings } from '../utils/mappers.js'

const router = Router()

router.get('/', authRequired, async (_req, res) => {
  try {
    const settings = await HospitalSettings.findOne({ key: 'default' })
    res.json(toFrontendSettings(settings))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load settings' })
  }
})

router.put('/', authRequired, requireRole('Admin'), async (req, res) => {
  try {
    const settings = await HospitalSettings.findOneAndUpdate(
      { key: 'default' },
      { $set: req.body },
      { new: true, upsert: true }
    )
    res.json(toFrontendSettings(settings))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

router.get('/categories', authRequired, async (_req, res) => {
  try {
    const categories = await ServiceCategory.find().sort({ name: 1 })
    res.json(categories.map(toFrontendCategory))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load categories' })
  }
})

router.patch('/categories/:slug/billing-type', authRequired, requireRole('Admin'), async (req, res) => {
  try {
    const { billingType } = req.body
    const category = await ServiceCategory.findOneAndUpdate(
      { slug: req.params.slug },
      { billingType },
      { new: true }
    )
    if (!category) return res.status(404).json({ error: 'Category not found' })
    res.json(toFrontendCategory(category))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update category' })
  }
})

export default router
