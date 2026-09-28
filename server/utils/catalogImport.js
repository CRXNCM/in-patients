import { isManualCatalogCategory, matchServiceCategory, sanitizeCatalogItemCreate } from './catalog.js'
import { normalizeCatalogName } from './hospitalCatalog.js'

export const CATALOG_IMPORT_MAX_ROWS = 2000

export const IMPORTABLE_CATEGORY_ALIASES = {
  consumables: ['consumables', 'consumable', 'disposable', 'disposables'],
  laboratory: ['laboratory', 'lab', 'labs', 'laboratory tests', 'lab tests'],
  'medical-supplies': ['medical-supplies', 'medical supplies', 'medical supply'],
  pharmacy: ['pharmacy', 'medicine', 'medicines', 'medication', 'medications', 'drugs'],
  procedures: ['procedures', 'procedure'],
  radiology: ['radiology', 'imaging', 'x-ray', 'xray', 'x ray'],
}

const BLOCKED_CATEGORY_MESSAGES = {
  room: 'Room daily rates are set on beds, not the catalog import.',
  rooms: 'Room daily rates are set on beds, not the catalog import.',
  'room services': 'Room daily rates are set on beds, not the catalog import.',
  doctor: 'Doctor visit fees are set on doctors, not the catalog import.',
  doctors: 'Doctor visit fees are set on doctors, not the catalog import.',
  'doctor visits': 'Doctor visit fees are set on doctors, not the catalog import.',
}

const HEADER_ALIASES = {
  category: ['category', 'cat'],
  subcategory: ['subcategory', 'sub category', 'sub cat', 'subcat', 'group'],
  name: ['name', 'item', 'item name', 'service', 'service name', 'description'],
  unit: ['unit', 'uom', 'units'],
  price: ['price', 'price etb', 'unit price', 'amount', 'rate'],
}

function trimText(value) {
  return String(value ?? '').trim()
}

function emptyCounts() {
  return { add: 0, skip: 0, error: 0, total: 0 }
}

function countActions(rows) {
  return rows.reduce(
    (counts, row) => {
      counts.total += 1
      if (row.action === 'add') counts.add += 1
      else if (row.action === 'skip') counts.skip += 1
      else counts.error += 1
      return counts
    },
    emptyCounts()
  )
}

export function normalizeImportHeader(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function headerIndex(headers, aliases) {
  return headers.findIndex((header) => aliases.includes(header))
}

export function mapImportHeaders(rawHeaders = []) {
  const headers = rawHeaders.map(normalizeImportHeader)
  const category = headerIndex(headers, HEADER_ALIASES.category)
  const subcategory = headerIndex(headers, HEADER_ALIASES.subcategory)
  const name = headerIndex(headers, HEADER_ALIASES.name)
  const unit = headerIndex(headers, HEADER_ALIASES.unit)
  const price = headerIndex(headers, HEADER_ALIASES.price)
  const missing = []
  if (category < 0) missing.push('category')
  if (name < 0) missing.push('name')
  if (price < 0) missing.push('price')
  if (missing.length) {
    return {
      error: `The file needs ${missing.join(', ')} column(s). Use category, subcategory, name, unit, and price.`,
      index: null,
    }
  }
  return { error: null, index: { category, subcategory, name, unit, price } }
}

export function parseCsvRecords(text) {
  const source = String(text || '').replace(/^\uFEFF/, '')
  const rows = []
  let current = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    const next = source[i + 1]
    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"'
        i += 1
      } else if (char === '"') {
        inQuotes = false
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      current.push(field)
      field = ''
      continue
    }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && next === '\n') i += 1
      current.push(field)
      rows.push(current)
      current = []
      field = ''
      continue
    }
    field += char
  }

  if (field.length || current.length) {
    current.push(field)
    rows.push(current)
  }

  return rows.filter((row) => row.some((cell) => trimText(cell)))
}

export function parseImportPrice(value) {
  if (value === '' || value === null || value === undefined) {
    return { error: 'Price is required.', price: null }
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      return { error: 'Price must be a number of 0 or more.', price: null }
    }
    return { error: null, price: value }
  }

  const text = String(value)
    .replace(/,/g, '')
    .replace(/\b(etb|br|birr)\b/gi, '')
    .trim()
  if (!text) return { error: 'Price is required.', price: null }
  const price = Number(text)
  if (!Number.isFinite(price) || price < 0) {
    return { error: 'Price must be a number of 0 or more.', price: null }
  }
  return { error: null, price }
}

function parentheticalKeys(name) {
  const keys = new Set()
  for (const match of String(name || '').matchAll(/\(([^)]+)\)/g)) {
    const inner = normalizeCatalogName(match[1])
    if (inner) keys.add(inner)
  }
  return keys
}

function isAbbreviation(normalized) {
  return Boolean(normalized) && !normalized.includes(' ') && normalized.length <= 12
}

export function findMatchingCatalogItem(existingServices = [], item) {
  const incoming = normalizeCatalogName(item?.name)
  if (!incoming) return null
  const incomingParens = parentheticalKeys(item?.name)

  return (
    (existingServices || []).find((svc) => {
      const existing = normalizeCatalogName(svc.name)
      if (existing === incoming) return true
      const existingParens = parentheticalKeys(svc.name)
      if (isAbbreviation(incoming) && existingParens.has(incoming)) return true
      if (isAbbreviation(existing) && incomingParens.has(existing)) return true
      return false
    }) || null
  )
}

function aliasSlugFor(value) {
  const normalized = normalizeCatalogName(value)
  if (!normalized) return null
  return (
    Object.keys(IMPORTABLE_CATEGORY_ALIASES).find((slug) =>
      IMPORTABLE_CATEGORY_ALIASES[slug].some((alias) => normalizeCatalogName(alias) === normalized)
    ) || null
  )
}

export function resolveImportCategory(value, categories = []) {
  const raw = trimText(value)
  const blocked = BLOCKED_CATEGORY_MESSAGES[normalizeCatalogName(raw)]
  if (blocked) return { error: blocked, category: null }

  const matched = matchServiceCategory(categories, raw)
  if (matched) {
    if (!isManualCatalogCategory(matched)) {
      return { error: `${matched.name} is not imported from Excel.`, category: null }
    }
    return { error: null, category: matched }
  }

  const aliasSlug = aliasSlugFor(raw)
  if (aliasSlug) {
    const category = matchServiceCategory(categories, aliasSlug)
    if (category) return { error: null, category }
    return { error: `Category ${aliasSlug} was not found.`, category: null }
  }

  if (!raw) return { error: 'Category is required.', category: null }
  return {
    error:
      `Unknown category "${raw}". Add it in Catalog first, or use an existing category name.`,
    category: null,
  }
}

export function parseCatalogCsv(text) {
  const records = parseCsvRecords(text)
  if (!records.length) return { error: 'The file is empty.', rows: [] }

  const mapped = mapImportHeaders(records[0])
  if (mapped.error) return { error: mapped.error, rows: [] }

  const rows = []
  for (let i = 1; i < records.length; i += 1) {
    const cells = records[i]
    rows.push({
      rowNumber: i + 1,
      category: cells[mapped.index.category] ?? '',
      subcategory: mapped.index.subcategory >= 0 ? cells[mapped.index.subcategory] ?? '' : '',
      name: cells[mapped.index.name] ?? '',
      unit: mapped.index.unit >= 0 ? cells[mapped.index.unit] ?? '' : '',
      price: cells[mapped.index.price] ?? '',
    })
  }
  return { error: null, rows }
}

export function extractImportRows(body = {}) {
  if (typeof body.csv === 'string') return parseCatalogCsv(body.csv)
  if (!Array.isArray(body.rows)) {
    return { error: 'Upload a CSV string or a rows array.', rows: [] }
  }
  return {
    error: null,
    rows: body.rows.map((row, index) => ({
      rowNumber: Number(row?.rowNumber) || index + 2,
      sheet: trimText(row?.sheet),
      category: row?.category,
      subcategory: row?.subcategory,
      name: row?.name,
      unit: row?.unit,
      price: row?.price,
    })),
  }
}

function plannedRow(base, extra) {
  return {
    rowNumber: base.rowNumber,
    sheet: base.sheet || '',
    action: extra.action,
    slug: extra.slug || '',
    categoryName: extra.categoryName || '',
    subcategory: extra.subcategory || trimText(base.subcategory),
    name: extra.name || trimText(base.name),
    unit: extra.unit || trimText(base.unit),
    price: extra.price ?? null,
    existingName: extra.existingName || '',
    existingPrice: extra.existingPrice ?? null,
    existingActive: extra.existingActive,
    message: extra.message || extra.error || '',
  }
}

export function planCatalogBulkImport(rawRows = [], categories = []) {
  if (!Array.isArray(rawRows)) {
    return { error: 'Rows must be an array.', rows: [], counts: emptyCounts() }
  }
  if (rawRows.length > CATALOG_IMPORT_MAX_ROWS) {
    return {
      error: `Import is limited to ${CATALOG_IMPORT_MAX_ROWS} rows.`,
      rows: [],
      counts: emptyCounts(),
    }
  }

  const seen = new Set()
  const rows = []

  for (const raw of rawRows) {
    const name = trimText(raw?.name)
    const subcategory = trimText(raw?.subcategory)
    const unit = trimText(raw?.unit)
    const resolved = resolveImportCategory(raw?.category, categories)
    const parsedPrice = parseImportPrice(raw?.price)

    if (resolved.error) {
      rows.push(plannedRow(raw, { action: 'error', name, subcategory, unit, error: resolved.error }))
      continue
    }
    if (!name) {
      rows.push(
        plannedRow(raw, {
          action: 'error',
          slug: resolved.category.slug,
          categoryName: resolved.category.name,
          subcategory,
          unit,
          error: 'Item name is required.',
        })
      )
      continue
    }
    if (parsedPrice.error) {
      rows.push(
        plannedRow(raw, {
          action: 'error',
          slug: resolved.category.slug,
          categoryName: resolved.category.name,
          name,
          subcategory,
          unit,
          error: parsedPrice.error,
        })
      )
      continue
    }

    const key = `${resolved.category.slug}::${normalizeCatalogName(name)}`
    if (seen.has(key)) {
      rows.push(
        plannedRow(raw, {
          action: 'error',
          slug: resolved.category.slug,
          categoryName: resolved.category.name,
          name,
          subcategory,
          unit,
          price: parsedPrice.price,
          error: 'Duplicate name in this file.',
        })
      )
      continue
    }
    seen.add(key)

    const existing = findMatchingCatalogItem(resolved.category.services, { name })
    if (existing) {
      const active = existing.active !== false
      rows.push(
        plannedRow(raw, {
          action: 'skip',
          slug: resolved.category.slug,
          categoryName: resolved.category.name,
          name,
          subcategory: existing.subcategory || subcategory,
          unit: existing.unit || unit,
          price: parsedPrice.price,
          existingName: existing.name,
          existingPrice: Number(existing.price) || 0,
          existingActive: active,
          message: active
            ? `Already in ${resolved.category.name} as "${existing.name}". Price ${Number(existing.price) || 0} was kept.`
            : `Already in ${resolved.category.name} as "${existing.name}" (inactive). Price was not changed.`,
        })
      )
      continue
    }

    rows.push(
      plannedRow(raw, {
        action: 'add',
        slug: resolved.category.slug,
        categoryName: resolved.category.name,
        name,
        subcategory,
        unit,
        price: parsedPrice.price,
        message: subcategory
          ? `Will add to ${resolved.category.name} / ${subcategory}.`
          : `Will add to ${resolved.category.name}.`,
      })
    )
  }

  return { error: null, rows, counts: countActions(rows) }
}

export function buildCatalogImportTemplateCsv() {
  return [
    'category,subcategory,name,unit,price',
    'laboratory,Hematology,CBC,test,300',
    'pharmacy,Analgesics,Paracetamol 500mg Tablet,tablet,15',
    'procedures,Wound Care,Wound Dressing,procedure,800',
  ].join('\n')
}

export async function previewCatalogImport(body, loadCategories) {
  const extracted = extractImportRows(body)
  if (extracted.error) return { error: extracted.error, rows: [], counts: emptyCounts() }
  if (!extracted.rows.length) return { error: 'No catalog rows were found.', rows: [], counts: emptyCounts() }

  const categories = await loadCategories()
  return planCatalogBulkImport(extracted.rows, categories)
}

export async function applyCatalogImport(body, loadCategories) {
  const plan = await previewCatalogImport(body, loadCategories)
  if (plan.error) return plan

  const adds = plan.rows.filter((row) => row.action === 'add')
  const categories = await loadCategories()
  const bySlug = new Map(categories.map((category) => [category.slug, category]))
  const created = []

  for (const row of adds) {
    const category = bySlug.get(row.slug)
    if (!category) continue
    const fresh = findMatchingCatalogItem(category.services, { name: row.name })
    if (fresh) continue
    category.services.push(
      sanitizeCatalogItemCreate({
        name: row.name,
        subcategory: row.subcategory,
        unit: row.unit,
        price: row.price,
      })
    )
    const item = category.services[category.services.length - 1]
    created.push({
      id: item._id ? String(item._id) : null,
      slug: category.slug,
      name: item.name,
      subcategory: item.subcategory || '',
      unit: item.unit || '',
      price: Number(item.price) || 0,
    })
  }

  await Promise.all(
    categories
      .filter((category) => adds.some((row) => row.slug === category.slug))
      .map((category) => category.save())
  )

  return {
    error: null,
    rows: plan.rows,
    counts: plan.counts,
    added: created.length,
    items: created,
  }
}
