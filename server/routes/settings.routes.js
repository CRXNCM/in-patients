import { Router } from 'express'
import { HospitalSettings } from '../models/HospitalSettings.js'
import { ServiceCategory } from '../models/ServiceCategory.js'
import { authRequired, requirePermission, requireAnyPermission } from '../middleware/auth.js'
import { toFrontendCategory, toFrontendSettings } from '../utils/mappers.js'
import { sanitizeSettingsPatch, validateSettingsPatch } from '../utils/settings.js'
import {
  applyCatalogItemPatch,
  ensureAllCatalogItemShapes,
  ensureCatalogItemShape,
  sanitizeCatalogItemCreate,
  toFrontendServiceItem,
  validateCatalogItemCreate,
  validateCatalogItemPatch,
} from '../utils/catalog.js'

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
    const categories = await ensureAllCatalogItemShapes()
    res.json(categories.map(toFrontendCategory))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load categories' })
  }
})

router.get('/categories/:slug/services', authRequired, requirePermission('system.view_settings'), async (req, res) => {
  try {
    const category = await ensureCatalogItemShape(req.params.slug)
    if (!category) return res.status(404).json({ error: 'Category not found' })
    res.json((category.services || []).map(toFrontendServiceItem))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to load category services' })
  }
})

router.post('/categories/:slug/services', authRequired, requirePermission('system.modify_settings'), async (req, res) => {
  try {
    const errors = validateCatalogItemCreate(req.body)
    if (errors.length) return res.status(400).json({ error: errors[0], errors })

    const category = await ensureCatalogItemShape(req.params.slug)
    if (!category) return res.status(404).json({ error: 'Category not found' })

    category.services.push(sanitizeCatalogItemCreate(req.body))
    await category.save()
    const created = category.services[category.services.length - 1]
    res.status(201).json(toFrontendServiceItem(created))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to create catalog item' })
  }
})

router.patch('/categories/:slug/services/:serviceId', authRequired, requirePermission('system.modify_settings'), async (req, res) => {
  try {
    const errors = validateCatalogItemPatch(req.body)
    if (errors.length) return res.status(400).json({ error: errors[0], errors })

    const category = await ensureCatalogItemShape(req.params.slug)
    if (!category) return res.status(404).json({ error: 'Category not found' })

    const item = category.services.id(req.params.serviceId)
    if (!item) return res.status(404).json({ error: 'Service not found' })

    applyCatalogItemPatch(item, req.body)
    await category.save()
    res.json(toFrontendServiceItem(item))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to update catalog item' })
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
