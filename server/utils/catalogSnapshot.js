import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeCatalogName } from './hospitalCatalog.js'

const DEFAULT_SEED_PATH = join(dirname(fileURLToPath(import.meta.url)), '../data/catalogSeed.json')

export function catalogSeedPath() {
  return DEFAULT_SEED_PATH
}

export function serializeCatalogCategories(docs = []) {
  return docs.map((category) => ({
    slug: category.slug,
    name: category.name,
    description: category.description || '',
    billingType: category.billingType || 'quantity',
    services: (category.services || []).map((item) => ({
      name: item.name,
      subcategory: item.subcategory || '',
      price: Number(item.price) || 0,
      unit: item.unit || '',
      active: item.active !== false,
    })),
  }))
}

export function loadCatalogSeed(path = DEFAULT_SEED_PATH) {
  const payload = JSON.parse(readFileSync(path, 'utf8'))
  const categories = serializeCatalogCategories(payload.categories || payload)
  return {
    exportedAt: payload.exportedAt || null,
    categoryCount: categories.length,
    itemCount: categories.reduce((sum, category) => sum + category.services.length, 0),
    categories,
  }
}

function itemKey(item) {
  return normalizeCatalogName(item?.name)
}

export function planCatalogSnapshotApply(existingDocs = [], seedCategories = []) {
  const bySlug = new Map((existingDocs || []).map((doc) => [doc.slug, doc]))
  return (seedCategories || []).map((seed) => {
    const existing = bySlug.get(seed.slug)
    if (!existing) {
      return {
        slug: seed.slug,
        name: seed.name,
        action: 'create',
        added: seed.services,
        preserved: [],
      }
    }
    const known = new Set((existing.services || []).map(itemKey).filter(Boolean))
    const added = []
    const preserved = []
    for (const item of seed.services) {
      const key = itemKey(item)
      if (key && known.has(key)) preserved.push(item.name)
      else {
        added.push(item)
        if (key) known.add(key)
      }
    }
    return {
      slug: seed.slug,
      name: existing.name || seed.name,
      action: added.length ? 'update' : 'unchanged',
      added,
      preserved,
    }
  })
}
