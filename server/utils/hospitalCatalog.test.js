import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeCatalogName,
  findExistingCatalogItem,
  planHospitalCatalogPopulation,
  HOSPITAL_STARTER_CATALOG,
} from './hospitalCatalog.js'

describe('hospital starter catalog matching', () => {
  it('treats CBC aliases as the same laboratory item', () => {
    const existing = [{ name: 'Complete Blood Count (CBC)', price: 450, active: true }]
    const item = HOSPITAL_STARTER_CATALOG
      .find((c) => c.slug === 'laboratory')
      .items.find((i) => i.name === 'CBC')
    const match = findExistingCatalogItem(existing, item)
    assert.equal(match.name, 'Complete Blood Count (CBC)')
    assert.equal(normalizeCatalogName('Complete Blood Count (CBC)'), 'complete blood count cbc')
  })

  it('does not treat syringe sizes as duplicates', () => {
    const existing = [{ name: 'Syringe 2ml', price: 10, active: true }]
    const item = { name: 'Syringe 20ml', unit: 'piece', price: 25 }
    assert.equal(findExistingCatalogItem(existing, item), null)
  })

  it('plans additions without renaming or repricing existing items', () => {
    const categories = {
      laboratory: {
        name: 'Laboratory',
        services: [{ name: 'Complete Blood Count (CBC)', price: 450, active: true }],
      },
    }
    const [lab] = planHospitalCatalogPopulation(categories).filter((row) => row.slug === 'laboratory')
    assert.equal(lab.preserved[0].existing, 'Complete Blood Count (CBC)')
    assert.equal(lab.preserved[0].price, 450)
    assert.ok(lab.added.some((item) => item.name === 'Creatinine'))
    assert.ok(!lab.added.some((item) => item.name === 'CBC'))
  })

  it('is idempotent once starter items already exist', () => {
    const bySlug = {}
    for (const spec of HOSPITAL_STARTER_CATALOG) {
      bySlug[spec.slug] = {
        name: spec.slug,
        services: spec.items.map((item) => ({ name: item.name, price: item.price, active: true })),
      }
    }
    const plan = planHospitalCatalogPopulation(bySlug)
    assert.ok(plan.every((row) => row.added.length === 0))
    assert.ok(plan.every((row) => row.preserved.length === specCount(row.slug)))
  })

  it('reports inactive matches without planning a new insert or reactivation', () => {
    const categories = {
      radiology: {
        name: 'Radiology',
        services: [{ name: 'Chest X-Ray', price: 800, active: false }],
      },
    }
    const [row] = planHospitalCatalogPopulation(categories).filter((r) => r.slug === 'radiology')
    assert.equal(row.added.filter((item) => item.name === 'Chest X-Ray').length, 0)
    assert.equal(row.inactiveMatches[0].existing, 'Chest X-Ray')
  })
})

function specCount(slug) {
  return HOSPITAL_STARTER_CATALOG.find((c) => c.slug === slug).items.length
}
