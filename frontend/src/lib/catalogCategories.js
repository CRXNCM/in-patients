export const CATALOG_CATEGORIES = [
  { slug: 'consumables', name: 'Consumables' },
  { slug: 'laboratory', name: 'Laboratory' },
  { slug: 'medical-supplies', name: 'Medical Supplies' },
  { slug: 'pharmacy', name: 'Pharmacy' },
  { slug: 'procedures', name: 'Procedures' },
  { slug: 'radiology', name: 'Radiology' },
]

const CATEGORY_ALIASES = {
  consumables: ['consumables', 'consumable', 'disposable', 'disposables'],
  laboratory: ['laboratory', 'lab', 'labs', 'laboratory tests', 'lab tests'],
  'medical-supplies': ['medical-supplies', 'medical supplies', 'medical supply'],
  pharmacy: ['pharmacy', 'medicine', 'medicines', 'medication', 'medications', 'drugs'],
  procedures: ['procedures', 'procedure'],
  radiology: ['radiology', 'imaging', 'x-ray', 'xray', 'x ray'],
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9%]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function slugifyCategoryName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function toCatalogTab(category) {
  return {
    slug: category.slug || category.id,
    name: category.name,
    billingType: category.billingType,
  }
}

export function manualCatalogTabs(categories = []) {
  return categories
    .filter((category) => {
      const slug = category.slug || category.id
      return slug !== 'room' && slug !== 'doctor' && category.billingType !== 'automatic_daily'
    })
    .map(toCatalogTab)
}

export function matchCatalogCategoryValue(value, liveCategories = []) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const lower = raw.toLowerCase()
  const pool = [
    ...liveCategories.map(toCatalogTab),
    ...CATALOG_CATEGORIES,
  ]
  const exact = pool.find(
    (category) => category.slug === raw || category.slug === lower || category.name === raw || String(category.name || '').toLowerCase() === lower
  )
  if (exact) return exact
  const normalized = normalize(raw)
  const slug = Object.keys(CATEGORY_ALIASES).find((key) =>
    CATEGORY_ALIASES[key].some((alias) => normalize(alias) === normalized)
  )
  return pool.find((category) => category.slug === slug) || null
}
