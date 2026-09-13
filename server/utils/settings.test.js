import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  PAYMENT_METHODS,
  SETTINGS_DEFAULTS,
  resolveSettings,
  sanitizeSettingsPatch,
  validateSettingsPatch,
} from './settings.js'
import { MIN_INITIAL_DEPOSIT, validateAdmitBody, validateDepositBody } from './validation.js'

const legacyDoc = {
  key: 'default',
  name: 'Central City Hospital',
  address: 'Konel, Dire Dawa, Ethiopia',
  tin: '0001234567',
  currency: 'ETB',
  lowBalanceThreshold: 3000,
  receiptFooter: 'Thank you for choosing Central City Hospital. Get well soon!',
  vatPercent: 0,
  dailyDoctorVisitFee: 1000,
  dailyDoctorVisitName: 'Daily Doctor Visit',
}

describe('settings sanitizing', () => {
  it('keeps only known keys', () => {
    const patch = sanitizeSettingsPatch({ name: 'X', key: 'other', _id: 'abc', role: 'Admin', nope: 1 })
    assert.deepEqual(Object.keys(patch), ['name'])
  })

  it('coerces booleans, numbers, and method lists', () => {
    const patch = sanitizeSettingsPatch({
      receiptShowLogo: 'yes',
      creditAdmissionsEnabled: 0,
      vatPercent: '15',
      lowBalanceThreshold: '4000',
      listPageSize: '25',
      paymentMethods: ['Cash', 'Cash', ' Ebirr '],
      referenceRequiredMethods: 'not-an-array',
      currency: 'usd',
    })
    assert.equal(patch.receiptShowLogo, true)
    assert.equal(patch.creditAdmissionsEnabled, false)
    assert.equal(patch.vatPercent, 15)
    assert.equal(patch.lowBalanceThreshold, 4000)
    assert.equal(patch.listPageSize, 25)
    assert.deepEqual(patch.paymentMethods, ['Cash', 'Ebirr'])
    assert.deepEqual(patch.referenceRequiredMethods, [])
    assert.equal(patch.currency, 'USD')
  })

  it('turns cleared text fields into null instead of empty strings', () => {
    const patch = sanitizeSettingsPatch({ receiptHeader: '   ', timezone: '' })
    assert.equal(patch.receiptHeader, null)
    assert.equal(patch.timezone, null)
  })
})

describe('settings validation', () => {
  it('rejects invalid monetary values', () => {
    assert.deepEqual(validateSettingsPatch({ lowBalanceThreshold: -1 }), [
      'Low balance threshold must be a number of 0 or more.',
    ])
    assert.deepEqual(validateSettingsPatch({ minimumInitialDeposit: Number.NaN }), [
      'Minimum initial deposit must be a number of 0 or more.',
    ])
    assert.equal(validateSettingsPatch({ dailyDoctorVisitFee: 0 }).length, 0)
  })

  it('rejects invalid configuration values', () => {
    assert.deepEqual(validateSettingsPatch({ vatPercent: 120 }), ['VAT percent must be between 0 and 100.'])
    assert.deepEqual(validateSettingsPatch({ name: '  ' }), ['Hospital name is required.'])
    assert.deepEqual(validateSettingsPatch({ email: 'nope' }), ['Hospital email is not a valid email address.'])
    assert.deepEqual(validateSettingsPatch({ currency: 'Birr' }), [
      'Currency must be a 3-letter code, for example ETB.',
    ])
    assert.equal(validateSettingsPatch({ currency: 'ETB' }).length, 0)
    assert.deepEqual(validateSettingsPatch({ paymentMethods: [] }), ['At least one payment method must be enabled.'])
    assert.deepEqual(validateSettingsPatch({ paymentMethods: ['Bitcoin'] }), ['Unknown payment method: Bitcoin.'])
    assert.deepEqual(validateSettingsPatch({ dateFormat: 'swedish' }), ['Date format is not supported.'])
    assert.deepEqual(validateSettingsPatch({ timeFormat: '36h' }), ['Time format is not supported.'])
    assert.deepEqual(validateSettingsPatch({ timezone: 'Mars/Olympus' }), [
      'Timezone is not a valid IANA timezone name.',
    ])
    assert.equal(validateSettingsPatch({ timezone: 'Africa/Addis_Ababa' }).length, 0)
    assert.equal(validateSettingsPatch({ listPageSize: 3 }).length, 1)
    assert.equal(validateSettingsPatch({ listPageSize: 25 }).length, 0)
  })

  it('checks the default payment method against the enabled list, including the stored one', () => {
    assert.deepEqual(validateSettingsPatch({ defaultPaymentMethod: 'Ebirr' }, { paymentMethods: ['Cash'] }), [
      'Default payment method must be one of the enabled payment methods.',
    ])
    assert.deepEqual(validateSettingsPatch({ paymentMethods: ['Cash'] }, { defaultPaymentMethod: 'Ebirr' }), [
      'Default payment method must be one of the enabled payment methods.',
    ])
    assert.equal(validateSettingsPatch({ paymentMethods: ['Cash', 'Ebirr'] }, { defaultPaymentMethod: 'Ebirr' }).length, 0)
  })
})

describe('resolving stored settings', () => {
  it('preserves every existing value from a document written before the new fields existed', () => {
    const resolved = resolveSettings(legacyDoc)
    for (const [key, value] of Object.entries(legacyDoc)) {
      if (key === 'key') continue
      assert.equal(resolved[key], value, `${key} must survive`)
    }
  })

  it('fills new fields with the behaviour the app already had', () => {
    const resolved = resolveSettings(legacyDoc)
    assert.deepEqual(resolved.paymentMethods, PAYMENT_METHODS)
    assert.equal(resolved.defaultPaymentMethod, 'Cash')
    assert.deepEqual(resolved.referenceRequiredMethods, ['Bank Transfer', 'Ebirr', 'Other'])
    assert.equal(resolved.minimumInitialDeposit, MIN_INITIAL_DEPOSIT)
    assert.equal(resolved.creditAdmissionsEnabled, true)
    assert.equal(resolved.allowDischargeWithOutstandingBalance, true)
    assert.equal(resolved.receiptPrefix, 'DEP-')
    assert.equal(resolved.receiptShowLogo, true)
    assert.equal(resolved.receiptShowPhone, false)
    assert.equal(resolved.dateFormat, 'locale')
    assert.equal(resolved.timeFormat, 'locale')
    assert.equal(resolved.listPageSize, 10)
  })

  it('does not let a blank or broken stored value win over the safe default', () => {
    const resolved = resolveSettings({ ...legacyDoc, paymentMethods: [], minimumInitialDeposit: -5 })
    assert.deepEqual(resolved.paymentMethods, PAYMENT_METHODS)
    assert.equal(resolved.minimumInitialDeposit, MIN_INITIAL_DEPOSIT)
  })

  it('resolves an empty document to the documented defaults', () => {
    const resolved = resolveSettings(null)
    assert.equal(resolved.currency, SETTINGS_DEFAULTS.currency)
    assert.equal(resolved.vatPercent, 0)
  })
})

describe('financial rules drive real validation', () => {
  const base = {
    name: 'Test Patient',
    gender: 'Female',
    address: 'Addis Ababa',
    bedId: 'BED-GW-01',
    age: 30,
  }

  it('uses the configured minimum initial deposit', () => {
    const errors = validateAdmitBody({ ...base, depositAmount: 6000 }, { minimumInitialDeposit: 8000 })
    assert.ok(errors.some((e) => e.includes('at least 8000')))
    assert.equal(validateAdmitBody({ ...base, depositAmount: 8000 }, { minimumInitialDeposit: 8000 }).length, 0)
  })

  it('falls back to the hard-coded minimum when settings are absent', () => {
    const errors = validateAdmitBody({ ...base, depositAmount: 100 })
    assert.ok(errors.some((e) => e.includes(`at least ${MIN_INITIAL_DEPOSIT}`)))
  })

  it('blocks credit admissions when they are disabled', () => {
    const body = { ...base, depositAmount: 0, admissionPaymentMode: 'credit' }
    assert.equal(validateAdmitBody(body, { creditAdmissionsEnabled: true }).length, 0)
    assert.deepEqual(validateAdmitBody(body, { creditAdmissionsEnabled: false }), [
      'Credit admissions are disabled in hospital settings.',
    ])
  })

  it('rejects a payment method that is not enabled', () => {
    const rules = { paymentMethods: ['Cash'] }
    assert.ok(
      validateAdmitBody({ ...base, depositAmount: 20000, depositMethod: 'Ebirr' }, rules).includes(
        'Ebirr is not an enabled payment method.'
      )
    )
    assert.ok(
      validateDepositBody({ amount: 100, method: 'Ebirr', referenceNumber: 'R-1' }, [], rules).includes(
        'Ebirr is not an enabled payment method.'
      )
    )
  })

  it('requires a reference only for the configured methods', () => {
    const cashNeedsRef = validateDepositBody({ amount: 100, method: 'Cash' }, [], {
      referenceRequiredMethods: ['Cash'],
    })
    assert.ok(cashNeedsRef.includes('Reference number is required for Cash payments.'))
    const ebirrFree = validateDepositBody({ amount: 100, method: 'Ebirr' }, [], {
      referenceRequiredMethods: [],
    })
    assert.equal(ebirrFree.length, 0)
  })

  it('keeps the existing non-cash reference rule when no settings are passed', () => {
    const errors = validateDepositBody({ amount: 100, method: 'Bank Transfer' }, [])
    assert.ok(errors.some((e) => e.startsWith('Reference number is required')))
    assert.equal(validateDepositBody({ amount: 100, method: 'Cash' }, []).length, 0)
  })
})
