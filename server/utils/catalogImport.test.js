import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  CATALOG_IMPORT_MAX_ROWS,
  buildCatalogImportTemplateCsv,
  extractImportRows,
  findMatchingCatalogItem,
  parseCatalogCsv,
  parseImportPrice,
  planCatalogBulkImport,
  resolveImportCategory,
} from './catalogImport.js'

const categories = [
  {
    slug: 'laboratory',
    name: 'Laboratory',
    services: [{ name: 'Complete Blood Count (CBC)', price: 450, active: true }],
  },
  {
    slug: 'pharmacy',
    name: 'Pharmacy',
    services: [{ name: 'Paracetamol 500mg', price: 15, active: false }],
  },
  {
    slug: 'procedures',
    name: 'Procedures',
    services: [],
  },
  {
    slug: 'radiology',
    name: 'Radiology',
    services: [],
  },
  {
    slug: 'room',
    name: 'Room Services',
    billingType: 'automatic_daily',
    services: [],
  },
]

describe('catalog CSV parsing', () => {
  it('reads quoted cells and alternate headers', () => {
    const parsed = parseCatalogCsv(
      'Category,Sub Category,Item Name,Unit,Price (ETB)\nLaboratory,Wound Care,"Wound, dressing",procedure,"1,200"\n'
    )
    assert.equal(parsed.error, null)
    assert.equal(parsed.rows.length, 1)
    assert.equal(parsed.rows[0].category, 'Laboratory')
    assert.equal(parsed.rows[0].subcategory, 'Wound Care')
    assert.equal(parsed.rows[0].name, 'Wound, dressing')
    assert.equal(parsed.rows[0].unit, 'procedure')
    assert.equal(parsed.rows[0].price, '1,200')
    assert.equal(parsed.rows[0].rowNumber, 2)
  })

  it('rejects a file without the required columns', () => {
    const parsed = parseCatalogCsv('name,price\nCBC,300\n')
    assert.match(parsed.error, /category/)
    assert.deepEqual(parsed.rows, [])
  })
})

describe('catalog import planning', () => {
  it('adds new items, skips existing names, and rejects room or doctor rows', () => {
    const plan = planCatalogBulkImport(
      [
        { category: 'Lab', subcategory: 'Chemistry', name: 'Creatinine', unit: 'test', price: '250 ETB' },
        { category: 'laboratory', name: 'CBC', unit: 'test', price: 999 },
        { category: 'pharmacy', name: 'Paracetamol 500mg', unit: 'tablet', price: 20 },
        { category: 'room', name: 'ICU Daily', unit: 'day', price: 8000 },
        { category: 'Physiotherapy', name: 'Session', unit: 'session', price: 400 },
        { category: 'procedures', name: '', unit: 'procedure', price: 100 },
      ],
      categories
    )

    assert.equal(plan.error, null)
    assert.equal(plan.counts.add, 1)
    assert.equal(plan.counts.skip, 2)
    assert.equal(plan.counts.error, 3)
    assert.equal(plan.rows.filter((row) => row.action === 'skip').length, 2)
    assert.equal(plan.rows[0].action, 'add')
    assert.equal(plan.rows[0].slug, 'laboratory')
    assert.equal(plan.rows[0].subcategory, 'Chemistry')
    assert.equal(plan.rows[0].price, 250)
    assert.equal(plan.rows[1].action, 'skip')
    assert.equal(plan.rows[1].existingName, 'Complete Blood Count (CBC)')
    assert.equal(plan.rows[1].existingPrice, 450)
    assert.match(plan.rows[2].message, /inactive/)
    assert.match(plan.rows[3].message, /beds/)
    assert.match(plan.rows[4].message, /Add it in Catalog first/)
    assert.match(plan.rows[5].message, /name is required/i)
  })

  it('rejects a duplicate name in the same file', () => {
    const plan = planCatalogBulkImport(
      [
        { category: 'procedures', name: 'Wound Dressing', unit: 'procedure', price: 800 },
        { category: 'Procedures', name: 'wound dressing', unit: 'procedure', price: 900 },
      ],
      categories
    )
    assert.equal(plan.rows[0].action, 'add')
    assert.equal(plan.rows[1].action, 'error')
    assert.match(plan.rows[1].message, /Duplicate name/)
  })

  it('caps the number of rows', () => {
    const rows = Array.from({ length: CATALOG_IMPORT_MAX_ROWS + 1 }, (_, i) => ({
      category: 'procedures',
      name: `Item ${i}`,
      price: 10,
    }))
    const plan = planCatalogBulkImport(rows, categories)
    assert.match(plan.error, /limited/)
    assert.equal(plan.rows.length, 0)
  })

  it('matches CBC to Complete Blood Count (CBC) without matching different items that share a word', () => {
    const existing = [
      { name: 'Complete Blood Count (CBC)', price: 450 },
      { name: 'X-Ray (Chest)', price: 800 },
    ]
    assert.equal(findMatchingCatalogItem(existing, { name: 'CBC' }).name, 'Complete Blood Count (CBC)')
    assert.equal(findMatchingCatalogItem(existing, { name: 'Ultrasound (Chest)' }), null)
  })

  it('parses template CSV into importable rows', () => {
    const extracted = extractImportRows({ csv: buildCatalogImportTemplateCsv() })
    assert.equal(extracted.error, null)
    assert.equal(extracted.rows.length, 3)
    assert.equal(extracted.rows[0].category, 'laboratory')
    assert.equal(extracted.rows[0].subcategory, 'Hematology')
    assert.equal(parseImportPrice('1,200').price, 1200)
    assert.equal(resolveImportCategory('imaging', categories).category.slug, 'radiology')
  })
})
