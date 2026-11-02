import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  loadCatalogSeed,
  planCatalogSnapshotApply,
  serializeCatalogCategories,
} from './catalogSnapshot.js'

describe('catalog snapshot seed', () => {
  it('loads every category and item from this project snapshot', () => {
    const seed = loadCatalogSeed()
    assert.equal(seed.categoryCount, 16)
    assert.equal(seed.itemCount, 1145)
    assert.ok(seed.categories.some((category) => category.slug === 'therapeutic-procedures'))
    assert.ok(seed.categories.some((category) => category.slug === 'laboratory'))
  })

  it('creates missing categories and only adds unknown items', () => {
    const seed = serializeCatalogCategories([
      {
        slug: 'laboratory',
        name: 'Laboratory',
        billingType: 'selection',
        services: [
          { name: 'CBC', price: 300, unit: 'test' },
          { name: 'Creatinine', price: 250, unit: 'test' },
        ],
      },
      {
        slug: 'x-ray',
        name: 'X-RAY',
        billingType: 'quantity',
        services: [{ name: 'Chest X-Ray', price: 500, unit: 'study' }],
      },
    ])
    const plan = planCatalogSnapshotApply(
      [{ slug: 'laboratory', name: 'Laboratory', services: [{ name: 'CBC', price: 450 }] }],
      seed
    )
    assert.equal(plan[0].action, 'update')
    assert.deepEqual(plan[0].added.map((item) => item.name), ['Creatinine'])
    assert.deepEqual(plan[0].preserved, ['CBC'])
    assert.equal(plan[1].action, 'create')
    assert.equal(plan[1].added.length, 1)
  })
})
