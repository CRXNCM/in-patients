import mongoose from 'mongoose'
import { ServiceCategory } from '../models/ServiceCategory.js'
import { applyEmergencyPrice, roundMoney } from './admissions.js'

function trimText(value) {
  return String(value ?? '').trim()
}

export function toFrontendServiceItem(item) {
  if (!item) return null
  return {
    id: item._id ? String(item._id) : item.id || null,
    name: item.name,
    subcategory: item.subcategory || '',
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

  if (body.subcategory !== undefined && body.subcategory !== null && typeof body.subcategory !== 'string') {
    errors.push('Subcategory must be text.')
  }

  return errors
}

export function validateCatalogItemPatch(body = {}) {
  const errors = []
  const known = ['name', 'price', 'unit', 'subcategory', 'active']
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

  if (body.subcategory !== undefined && body.subcategory !== null && typeof body.subcategory !== 'string') {
    errors.push('Subcategory must be text.')
  }

  if (body.active !== undefined && typeof body.active !== 'boolean') {
    errors.push('Active must be true or false.')
  }

  return errors
}

export function sanitizeCatalogItemCreate(body = {}) {
  return {
    name: trimText(body.name),
    subcategory: trimText(body.subcategory),
    price: Number(body.price),
    unit: trimText(body.unit),
    active: true,
  }
}

export function applyCatalogItemPatch(item, body = {}) {
  if (body.name !== undefined) item.name = trimText(body.name)
  if (body.subcategory !== undefined) item.subcategory = trimText(body.subcategory)
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
    subcategory: typeof item.subcategory === 'string' ? item.subcategory : '',
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

export const RESERVED_CATEGORY_SLUGS = ['room', 'doctor']
const MANUAL_BILLING_TYPES = new Set(['quantity', 'selection'])

const AUTO_CATEGORY_NAMES = new Set(['Room Services', 'Doctor Visits'])

export function slugifyCategoryName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function isManualCatalogCategory(category) {
  if (!category) return false
  if (RESERVED_CATEGORY_SLUGS.includes(category.slug)) return false
  return category.billingType !== 'automatic_daily'
}

export function validateCategoryCreate(body = {}) {
  const errors = []
  if (!trimText(body.name)) errors.push('Category name is required.')

  if (body.billingType !== undefined && body.billingType !== null && body.billingType !== '') {
    if (!MANUAL_BILLING_TYPES.has(body.billingType)) {
      errors.push('Billing type must be quantity or selection.')
    }
  }

  if (body.description !== undefined && body.description !== null && typeof body.description !== 'string') {
    errors.push('Description must be text.')
  }

  if (body.slug !== undefined && body.slug !== null && body.slug !== '') {
    const slug = slugifyCategoryName(body.slug)
    if (!slug) errors.push('Category slug must use letters or numbers.')
  }

  return errors
}

export function sanitizeCategoryCreate(body = {}) {
  const name = trimText(body.name)
  const slug = slugifyCategoryName(body.slug) || slugifyCategoryName(name)
  return {
    slug,
    name,
    description: trimText(body.description),
    billingType: body.billingType === 'selection' ? 'selection' : 'quantity',
    services: [],
  }
}

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

function snapshotFromCatalogItem(item, category, { id, quantity, notes, emergencyPricing } = {}) {
  const priced = applyEmergencyPrice(item.price, { emergencyPricing })
  const qty = quantity
  return {
    id: id || `svc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    catalogItemId: String(item._id),
    category: category.name,
    serviceName: item.name,
    unit: item.unit || '',
    quantity: qty,
    baseUnitPrice: priced.baseUnitPrice,
    priceMultiplier: priced.priceMultiplier,
    unitPrice: priced.unitPrice,
    total: roundMoney(qty * priced.unitPrice),
    notes: notes || '',
  }
}

function passthroughAutomaticLine(s, qty, index) {
  const price = Number(s.unitPrice)
  return {
    id: s.id || `svc-${Date.now()}-${index}`,
    category: s.category,
    serviceName: s.serviceName,
    quantity: qty,
    baseUnitPrice: Number.isFinite(Number(s.baseUnitPrice)) ? Number(s.baseUnitPrice) : price,
    priceMultiplier: 1,
    unitPrice: price,
    total: Number(s.total ?? qty * price),
    notes: s.notes || '',
    doctorId: s.doctorId || undefined,
    specialty: s.specialty || undefined,
  }
}

/** Resolve catalog-backed lines. Client name/price/unit are ignored. Auto room/doctor lines pass through. */
export async function resolveCatalogServiceLines(services = [], { emergencyPricing = false } = {}) {
  const categories = await ServiceCategory.find()
  const lines = []

  for (let i = 0; i < services.length; i += 1) {
    const s = services[i]
    const qty = safeQuantity(s?.quantity)
    if (qty == null) return { error: 'Quantity must be greater than 0.', lines: [] }

    const category = matchServiceCategory(categories, s?.category)
    if (isAutomaticChargeCategory(category, s?.category)) {
      lines.push(passthroughAutomaticLine(s, qty, i))
      continue
    }

    if (!category || !isManualCatalogCategory(category)) {
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

    lines.push(snapshotFromCatalogItem(item, category, { id: s.id, quantity: qty, notes: s.notes, emergencyPricing }))
  }

  return { error: null, lines }
}

export async function resolveCatalogReturnLines(returnItems = [], { emergencyPricing = false } = {}) {
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

    const priced = applyEmergencyPrice(item.price, { emergencyPricing })
    lines.push({
      id: r.id || `ret-${Date.now()}-${i}`,
      catalogItemId: String(item._id),
      serviceName: item.name,
      unit: item.unit || '',
      quantity: qty,
      baseUnitPrice: priced.baseUnitPrice,
      priceMultiplier: priced.priceMultiplier,
      unitPrice: priced.unitPrice,
      total: roundMoney(qty * priced.unitPrice),
      reason: r.reason || '',
    })
  }

  return { error: null, lines }
}
