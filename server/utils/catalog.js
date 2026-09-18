import mongoose from 'mongoose'
import { ServiceCategory } from '../models/ServiceCategory.js'

function trimText(value) {
  return String(value ?? '').trim()
}

export function toFrontendServiceItem(item) {
  if (!item) return null
  return {
    id: item._id ? String(item._id) : item.id || null,
    name: item.name,
    price: Number(item.price) || 0,
    unit: item.unit || '',
    active: item.active !== false,
  }
}

export function validateCatalogItemCreate(body = {}) {
  const errors = []
  if (!trimText(body.name)) errors.push('Service name is required.')

  if (body.price === undefined || body.price === null || body.price === '') {
    errors.push('Price is required.')
  } else {
    const price = Number(body.price)
    if (!Number.isFinite(price) || price < 0) errors.push('Price must be a number of 0 or more.')
  }

  if (body.unit !== undefined && body.unit !== null && typeof body.unit !== 'string') {
    errors.push('Unit must be text.')
  }

  return errors
}

export function validateCatalogItemPatch(body = {}) {
  const errors = []
  const known = ['name', 'price', 'unit', 'active']
  const hasKnown = known.some((key) => body[key] !== undefined)
  if (!hasKnown) errors.push('No catalog fields were provided.')

  if (body.name !== undefined && !trimText(body.name)) {
    errors.push('Service name is required.')
  }

  if (body.price !== undefined) {
    const price = Number(body.price)
    if (!Number.isFinite(price) || price < 0) errors.push('Price must be a number of 0 or more.')
  }

  if (body.unit !== undefined && body.unit !== null && typeof body.unit !== 'string') {
    errors.push('Unit must be text.')
  }

  if (body.active !== undefined && typeof body.active !== 'boolean') {
    errors.push('Active must be true or false.')
  }

  return errors
}

export function sanitizeCatalogItemCreate(body = {}) {
  return {
    name: trimText(body.name),
    price: Number(body.price),
    unit: trimText(body.unit),
    active: true,
  }
}

export function applyCatalogItemPatch(item, body = {}) {
  if (body.name !== undefined) item.name = trimText(body.name)
  if (body.price !== undefined) item.price = Number(body.price)
  if (body.unit !== undefined) item.unit = trimText(body.unit)
  if (body.active !== undefined) item.active = body.active
  return item
}

function needsCatalogBackfill(rawServices = []) {
  return rawServices.some((item) => !item?._id || item.active === undefined)
}

function shapedServices(rawServices = []) {
  return rawServices.map((item) => ({
    _id: item._id || new mongoose.Types.ObjectId(),
    name: item.name,
    price: item.price,
    unit: typeof item.unit === 'string' ? item.unit : '',
    active: item.active !== false,
  }))
}

async function backfillCategoryDoc(raw) {
  if (!raw || !needsCatalogBackfill(raw.services)) return false
  await ServiceCategory.updateOne({ _id: raw._id }, { $set: { services: shapedServices(raw.services) } })
  return true
}

/** Assigns persistent `_id` / `active` to legacy `{ name, price }` lines without deleting them. */
export async function ensureCatalogItemShape(slug) {
  const raw = await ServiceCategory.findOne({ slug }).lean()
  if (!raw) return null
  await backfillCategoryDoc(raw)
  return ServiceCategory.findOne({ slug })
}

export async function ensureAllCatalogItemShapes() {
  const docs = await ServiceCategory.find().lean()
  for (const raw of docs) {
    await backfillCategoryDoc(raw)
  }
  return ServiceCategory.find().sort({ name: 1 })
}

export const MANUAL_CATALOG_SLUGS = [
  'consumables',
  'laboratory',
  'medical-supplies',
  'pharmacy',
  'procedures',
  'radiology',
]

const AUTO_CATEGORY_NAMES = new Set(['Room Services', 'Doctor Visits'])

export function matchServiceCategory(categories, categoryValue) {
  const raw = String(categoryValue || '').trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  return (
    categories.find(
      (c) => c.slug === raw || c.slug === lower || c.name === raw || String(c.name || '').toLowerCase() === lower
    ) || null
  )
}

function isAutomaticChargeCategory(category, categoryValue) {
  if (AUTO_CATEGORY_NAMES.has(String(categoryValue || '').trim())) return true
  if (!category) return false
  return category.billingType === 'automatic_daily' || category.slug === 'room' || category.slug === 'doctor'
}

function findItemInCategory(category, id) {
  if (!category || !id) return null
  const key = String(id)
  try {
    if (typeof category.services?.id === 'function') {
      const byId = category.services.id(key)
      if (byId) return byId
    }
  } catch {
    // Invalid ObjectId strings fall through to a string compare.
  }
  return (category.services || []).find((item) => String(item._id) === key) || null
}

function findItemAnywhere(categories, id) {
  for (const category of categories) {
    const item = findItemInCategory(category, id)
    if (item) return { category, item }
  }
  return null
}

function safeQuantity(value) {
  const qty = Number(value)
  if (!Number.isFinite(qty) || qty <= 0) return null
  return qty
}

function snapshotFromCatalogItem(item, category, { id, quantity, notes } = {}) {
  const price = Number(item.price) || 0
  const qty = quantity
  return {
    id: id || `svc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    catalogItemId: String(item._id),
    category: category.name,
    serviceName: item.name,
    unit: item.unit || '',
    quantity: qty,
    unitPrice: price,
    total: qty * price,
    notes: notes || '',
  }
}

/** Resolve catalog-backed lines. Client name/price/unit are ignored. Auto room/doctor lines pass through. */
export async function resolveCatalogServiceLines(services = []) {
  const categories = await ServiceCategory.find()
  const lines = []

  for (let i = 0; i < services.length; i += 1) {
    const s = services[i]
    const qty = safeQuantity(s?.quantity)
    if (qty == null) return { error: 'Quantity must be greater than 0.', lines: [] }

    const category = matchServiceCategory(categories, s?.category)
    if (isAutomaticChargeCategory(category, s?.category)) {
      const price = Number(s.unitPrice)
      lines.push({
        id: s.id || `svc-${Date.now()}-${i}`,
        category: s.category,
        serviceName: s.serviceName,
        quantity: qty,
        unitPrice: price,
        total: Number(s.total ?? qty * price),
        notes: s.notes || '',
        doctorId: s.doctorId || undefined,
        specialty: s.specialty || undefined,
      })
      continue
    }

    if (!category || !MANUAL_CATALOG_SLUGS.includes(category.slug)) {
      return { error: 'Category is not valid.', lines: [] }
    }

    const catalogItemId = trimText(s?.catalogItemId)
    if (!catalogItemId) return { error: 'Catalog item is required.', lines: [] }

    const item = findItemInCategory(category, catalogItemId)
    if (!item) {
      const elsewhere = findItemAnywhere(categories, catalogItemId)
      return {
        error: elsewhere ? 'Catalog item does not belong to this category.' : 'Catalog item was not found.',
        lines: [],
      }
    }
    if (item.active === false) {
      return { error: 'This catalog item is inactive and cannot be billed.', lines: [] }
    }

    lines.push(snapshotFromCatalogItem(item, category, { id: s.id, quantity: qty, notes: s.notes }))
  }

  return { error: null, lines }
}

export async function resolveCatalogReturnLines(returnItems = []) {
  const pharmacy = await ServiceCategory.findOne({ slug: 'pharmacy' })
  if (!pharmacy) return { error: 'Pharmacy catalog was not found.', lines: [] }

  const lines = []
  for (let i = 0; i < returnItems.length; i += 1) {
    const r = returnItems[i]
    const qty = safeQuantity(r?.quantity)
    if (qty == null) return { error: 'Return quantity must be greater than 0.', lines: [] }

    const catalogItemId = trimText(r?.catalogItemId)
    if (!catalogItemId) return { error: 'Catalog item is required.', lines: [] }

    const item = findItemInCategory(pharmacy, catalogItemId)
    if (!item) return { error: 'Catalog item was not found.', lines: [] }
    if (item.active === false) {
      return { error: 'This catalog item is inactive and cannot be billed.', lines: [] }
    }

    const price = Number(item.price) || 0
    lines.push({
      id: r.id || `ret-${Date.now()}-${i}`,
      catalogItemId: String(item._id),
      serviceName: item.name,
      unit: item.unit || '',
      quantity: qty,
      unitPrice: price,
      total: qty * price,
      reason: r.reason || '',
    })
  }

  return { error: null, lines }
}
