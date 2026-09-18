import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  toFrontendServiceItem,
  validateCatalogItemCreate,
  validateCatalogItemPatch,
  sanitizeCatalogItemCreate,
  matchServiceCategory,
} from './catalog.js'

describe('catalog item mapping', () => {
  it('exposes id, unit, and active while treating missing active as true', () => {
    const mapped = toFrontendServiceItem({
      _id: { toString: () => 'abc123' },
      name: 'CBC',
      price: 250,
    })
    assert.deepEqual(mapped, {
      id: 'abc123',
      name: 'CBC',
      price: 250,
      unit: '',
      active: true,
    })
  })

  it('preserves explicit inactive items', () => {
    const mapped = toFrontendServiceItem({
      _id: 'id-1',
      name: 'Old test',
      price: 10,
      unit: 'test',
      active: false,
    })
    assert.equal(mapped.active, false)
    assert.equal(mapped.unit, 'test')
  })
})

describe('catalog item create validation', () => {
  it('requires name and a non-negative price', () => {
    assert.ok(validateCatalogItemCreate({}).some((e) => /name/i.test(e)))
    assert.ok(validateCatalogItemCreate({ name: 'CBC' }).some((e) => /Price is required/i.test(e)))
    assert.ok(validateCatalogItemCreate({ name: 'CBC', price: -1 }).some((e) => /0 or more/i.test(e)))
    assert.deepEqual(validateCatalogItemCreate({ name: 'CBC', price: 250, unit: 'test' }), [])
  })

  it('forces new items active and ignores client ids', () => {
    const created = sanitizeCatalogItemCreate({
      name: '  CBC  ',
      price: '250',
      unit: ' test ',
      _id: 'client-id',
      active: false,
    })
    assert.deepEqual(created, { name: 'CBC', price: 250, unit: 'test', active: true })
  })
})

describe('matchServiceCategory', () => {
  const categories = [
    { slug: 'laboratory', name: 'Laboratory' },
    { slug: 'pharmacy', name: 'Pharmacy' },
  ]

  it('matches by display name or slug without mixing categories', () => {
    assert.equal(matchServiceCategory(categories, 'Laboratory').slug, 'laboratory')
    assert.equal(matchServiceCategory(categories, 'laboratory').slug, 'laboratory')
    assert.equal(matchServiceCategory(categories, 'Pharmacy').slug, 'pharmacy')
    assert.equal(matchServiceCategory(categories, 'unknown'), null)
  })
})

describe('catalog item patch validation', () => {
  it('rejects an empty patch and invalid price or active', () => {
    assert.ok(validateCatalogItemPatch({}).length)
    assert.ok(validateCatalogItemPatch({ price: -5 }).some((e) => /0 or more/i.test(e)))
    assert.ok(validateCatalogItemPatch({ active: 'no' }).some((e) => /true or false/i.test(e)))
    assert.deepEqual(validateCatalogItemPatch({ active: false }), [])
    assert.deepEqual(validateCatalogItemPatch({ name: 'CBC', price: 0, unit: '' }), [])
  })
})
