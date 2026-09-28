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
  RESERVED_CATEGORY_SLUGS,
  sanitizeCatalogItemCreate,
  sanitizeCategoryCreate,
  toFrontendServiceItem,
  validateCatalogItemCreate,
  validateCatalogItemPatch,
  validateCategoryCreate,
} from '../utils/catalog.js'
import {
  applyCatalogImport,
  buildCatalogImportTemplateCsv,
  previewCatalogImport,
} from '../utils/catalogImport.js'

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

router.get('/catalog/import/template', authRequired, requirePermission('system.view_settings'), (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename="catalog-import-template.csv"')
  res.send(buildCatalogImportTemplateCsv())
})

router.post('/catalog/import/preview', authRequired, requirePermission('system.modify_settings'), async (req, res) => {
  try {
    const plan = await previewCatalogImport(req.body, ensureAllCatalogItemShapes)
    if (plan.error) return res.status(400).json({ error: plan.error })
    res.json(plan)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to preview catalog import' })
  }
})

router.post('/catalog/import', authRequired, requirePermission('system.modify_settings'), async (req, res) => {
  try {
    const result = await applyCatalogImport(req.body, ensureAllCatalogItemShapes)
    if (result.error) return res.status(400).json({ error: result.error })
    res.json(result)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to import catalog items' })
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

router.post('/categories', authRequired, requirePermission('system.modify_settings'), async (req, res) => {
  try {
    const errors = validateCategoryCreate(req.body)
    if (errors.length) return res.status(400).json({ error: errors[0], errors })

    const payload = sanitizeCategoryCreate(req.body)
    if (!payload.slug) return res.status(400).json({ error: 'Category slug must use letters or numbers.' })
    if (RESERVED_CATEGORY_SLUGS.includes(payload.slug)) {
      return res.status(400).json({ error: 'Room and doctor categories cannot be created here.' })
    }

    const existing = await ServiceCategory.find({
      $or: [{ slug: payload.slug }, { name: new RegExp(`^${payload.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }],
    }).lean()
    if (existing.some((category) => category.slug === payload.slug)) {
      return res.status(409).json({ error: `Category slug "${payload.slug}" already exists.` })
    }
    if (existing.some((category) => String(category.name).toLowerCase() === payload.name.toLowerCase())) {
      return res.status(409).json({ error: `Category "${payload.name}" already exists.` })
    }

    const category = await ServiceCategory.create(payload)
    res.status(201).json(toFrontendCategory(category))
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: 'A category with this slug already exists.' })
    }
    console.error(err)
    res.status(500).json({ error: 'Failed to create category' })
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
