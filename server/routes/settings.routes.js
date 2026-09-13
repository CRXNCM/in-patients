import { Router } from 'express'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { ServiceCategory } from '../models/ServiceCategory.js'
import { authRequired, requirePermission, requireAnyPermission } from '../middleware/auth.js'
import { toFrontendCategory, toFrontendSettings } from '../utils/mappers.js'
import { sanitizeSettingsPatch, validateSettingsPatch } from '../utils/settings.js'

const router = Router()

router.get('/', authRequired, requireAnyPermission('system.view_settings', 'patients.view', 'admissions.view'), async (_req, res) => {
  try {
    const settings = await HospitalSettings.findOne({ key: 'default' })
    res.json(toFrontendSettings(settings))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load settings' })
  }
})

router.put('/', authRequired, requirePermission('system.modify_settings'), async (req, res) => {
  try {
    const patch = sanitizeSettingsPatch(req.body)
    if (!Object.keys(patch).length) {
      return res.status(400).json({ error: 'No known settings were provided.' })
    }

    const current = await HospitalSettings.findOne({ key: 'default' }).lean()
    const errors = validateSettingsPatch(patch, current || {})
    if (errors.length) return res.status(400).json({ error: errors[0], errors })

    const settings = await HospitalSettings.findOneAndUpdate(
      { key: 'default' },
      { $set: patch },
      { new: true, upsert: true }
    )
    res.json(toFrontendSettings(settings))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update settings' })
  }
})

router.get('/categories', authRequired, requireAnyPermission('system.view_settings', 'patients.view', 'admissions.view'), async (_req, res) => {
  try {
    const categories = await ServiceCategory.find().sort({ name: 1 })
    res.json(categories.map(toFrontendCategory))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load categories' })
  }
})

router.patch('/categories/:slug/billing-type', authRequired, requirePermission('system.modify_settings'), async (req, res) => {
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
