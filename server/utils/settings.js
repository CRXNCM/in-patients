import { MIN_INITIAL_DEPOSIT, NON_CASH_PAYMENT_METHODS } from './validation.js'

/** The payment methods the application already understands. Nothing new is invented here. */
export const PAYMENT_METHODS = ['Cash', ...NON_CASH_PAYMENT_METHODS]

export const DATE_FORMATS = ['locale', 'iso', 'dmy']
export const TIME_FORMATS = ['locale', '12h', '24h']

export const MIN_LIST_PAGE_SIZE = 5
export const MAX_LIST_PAGE_SIZE = 100

/**
 * Every settings key the API accepts, grouped the same way the Admin Settings page is.
 * Anything outside this list is rejected so a stray field can never reach the document.
 */
export const SETTINGS_FIELDS = {
  hospital: ['name', 'address', 'tin', 'phone', 'email'],
  billing: [
    'currency',
    'vatPercent',
    'paymentMethods',
    'defaultPaymentMethod',
    'referenceRequiredMethods',
    'dailyDoctorVisitFee',
    'dailyDoctorVisitName',
  ],
  documents: [
    'receiptHeader',
    'receiptFooter',
    'receiptPrefix',
    'receiptShowLogo',
    'receiptShowAddress',
    'receiptShowPhone',
    'receiptShowTin',
    'invoiceHeader',
    'invoiceFooter',
    'invoiceShowLogo',
    'invoiceShowAddress',
    'invoiceShowPhone',
    'invoiceShowTin',
  ],
  financial: [
    'lowBalanceThreshold',
    'minimumInitialDeposit',
    'creditAdmissionsEnabled',
    'allowDischargeWithOutstandingBalance',
  ],
  system: ['timezone', 'dateFormat', 'timeFormat', 'listPageSize'],
}

export const SETTINGS_KEYS = Object.values(SETTINGS_FIELDS).flat()

/**
 * Defaults describe what the application already does today, so resolving a document
 * that predates these fields never changes behaviour.
 */
export const SETTINGS_DEFAULTS = {
  currency: 'ETB',
  vatPercent: 0,
  paymentMethods: PAYMENT_METHODS,
  defaultPaymentMethod: 'Cash',
  referenceRequiredMethods: NON_CASH_PAYMENT_METHODS,
  receiptPrefix: 'DEP-',
  receiptShowLogo: true,
  receiptShowAddress: true,
  receiptShowPhone: false,
  receiptShowTin: true,
  invoiceShowLogo: true,
  invoiceShowAddress: true,
  invoiceShowPhone: false,
  invoiceShowTin: true,
  minimumInitialDeposit: MIN_INITIAL_DEPOSIT,
  creditAdmissionsEnabled: true,
  allowDischargeWithOutstandingBalance: true,
  dateFormat: 'locale',
  timeFormat: 'locale',
  listPageSize: 10,
}

const BOOLEAN_FIELDS = new Set([
  'receiptShowLogo',
  'receiptShowAddress',
  'receiptShowPhone',
  'receiptShowTin',
  'invoiceShowLogo',
  'invoiceShowAddress',
  'invoiceShowPhone',
  'invoiceShowTin',
  'creditAdmissionsEnabled',
  'allowDischargeWithOutstandingBalance',
])

const MONEY_FIELDS = new Set(['lowBalanceThreshold', 'minimumInitialDeposit', 'dailyDoctorVisitFee'])

const MONEY_LABELS = {
  lowBalanceThreshold: 'Low balance threshold',
  minimumInitialDeposit: 'Minimum initial deposit',
  dailyDoctorVisitFee: 'Daily doctor visit fee',
}

function trimText(value) {
  return String(value ?? '').trim()
}

function isMissing(value) {
  return value === undefined || value === null || value === ''
}

function uniqueMethods(list) {
  return [...new Set(list.map((method) => trimText(method)))].filter(Boolean)
}

/** Keeps only known keys so `$set` can never write an unexpected path. */
export function sanitizeSettingsPatch(body = {}) {
  const patch = {}
  for (const key of SETTINGS_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue
    const value = body[key]
    if (BOOLEAN_FIELDS.has(key)) {
      patch[key] = Boolean(value)
    } else if (MONEY_FIELDS.has(key) || key === 'vatPercent' || key === 'listPageSize') {
      patch[key] = isMissing(value) ? null : Number(value)
    } else if (key === 'paymentMethods' || key === 'referenceRequiredMethods') {
      patch[key] = Array.isArray(value) ? uniqueMethods(value) : []
    } else {
      const text = trimText(value)
      if (text === '') patch[key] = null
      else patch[key] = key === 'currency' ? text.toUpperCase() : text
    }
  }
  return patch
}

function isValidTimezone(value) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value })
    return true
  } catch {
    return false
  }
}

/**
 * Validates a patch on its own merits. `current` is the stored document so a patch that
 * only changes one half of a related pair (methods + default method) still validates.
 */
export function validateSettingsPatch(patch = {}, current = {}) {
  const errors = []
  const merged = { ...SETTINGS_DEFAULTS, ...stripNullish(current), ...stripNullish(patch) }

  if (Object.prototype.hasOwnProperty.call(patch, 'name') && !trimText(patch.name)) {
    errors.push('Hospital name is required.')
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'email') && trimText(patch.email)) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimText(patch.email))) {
      errors.push('Hospital email is not a valid email address.')
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'currency')) {
    const currency = trimText(patch.currency)
    if (!currency) errors.push('Currency is required.')
    // Amounts are formatted with Intl, which only accepts ISO 4217 style codes.
    else if (!/^[A-Za-z]{3}$/.test(currency)) errors.push('Currency must be a 3-letter code, for example ETB.')
  }

  for (const key of MONEY_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue
    const value = patch[key]
    if (value === null) continue
    if (!Number.isFinite(value) || value < 0) {
      errors.push(`${MONEY_LABELS[key]} must be a number of 0 or more.`)
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'vatPercent') && patch.vatPercent !== null) {
    if (!Number.isFinite(patch.vatPercent) || patch.vatPercent < 0 || patch.vatPercent > 100) {
      errors.push('VAT percent must be between 0 and 100.')
    }
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'paymentMethods')) {
    if (!patch.paymentMethods.length) errors.push('At least one payment method must be enabled.')
    const unknown = patch.paymentMethods.filter((method) => !PAYMENT_METHODS.includes(method))
    if (unknown.length) errors.push(`Unknown payment method: ${unknown.join(', ')}.`)
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'referenceRequiredMethods')) {
    const unknown = patch.referenceRequiredMethods.filter((method) => !PAYMENT_METHODS.includes(method))
    if (unknown.length) errors.push(`Unknown payment method: ${unknown.join(', ')}.`)
  }

  // Only worth cross-checking once the enabled list itself is known to be valid.
  const enabled = merged.paymentMethods || []
  const methodListValid = enabled.length && enabled.every((method) => PAYMENT_METHODS.includes(method))
  if (methodListValid && merged.defaultPaymentMethod && !enabled.includes(merged.defaultPaymentMethod)) {
    errors.push('Default payment method must be one of the enabled payment methods.')
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'dateFormat') && patch.dateFormat) {
    if (!DATE_FORMATS.includes(patch.dateFormat)) errors.push('Date format is not supported.')
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'timeFormat') && patch.timeFormat) {
    if (!TIME_FORMATS.includes(patch.timeFormat)) errors.push('Time format is not supported.')
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'timezone') && patch.timezone) {
    if (!isValidTimezone(patch.timezone)) errors.push('Timezone is not a valid IANA timezone name.')
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'listPageSize') && patch.listPageSize !== null) {
    const size = patch.listPageSize
    if (!Number.isInteger(size) || size < MIN_LIST_PAGE_SIZE || size > MAX_LIST_PAGE_SIZE) {
      errors.push(`Rows per page must be a whole number between ${MIN_LIST_PAGE_SIZE} and ${MAX_LIST_PAGE_SIZE}.`)
    }
  }

  return errors
}

function stripNullish(source = {}) {
  const out = {}
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined || value === null) continue
    out[key] = value
  }
  return out
}

/**
 * Stored settings plus the defaults that describe current behaviour. Business logic should
 * read through this so a document written before a field existed still behaves as before.
 */
export function resolveSettings(doc) {
  const stored = stripNullish(doc && typeof doc.toObject === 'function' ? doc.toObject() : doc || {})
  const resolved = { ...SETTINGS_DEFAULTS, ...stored }
  if (!Array.isArray(resolved.paymentMethods) || !resolved.paymentMethods.length) {
    resolved.paymentMethods = SETTINGS_DEFAULTS.paymentMethods
  }
  if (!Array.isArray(resolved.referenceRequiredMethods)) {
    resolved.referenceRequiredMethods = SETTINGS_DEFAULTS.referenceRequiredMethods
  }
  if (!Number.isFinite(Number(resolved.minimumInitialDeposit)) || Number(resolved.minimumInitialDeposit) < 0) {
    resolved.minimumInitialDeposit = SETTINGS_DEFAULTS.minimumInitialDeposit
  } else {
    resolved.minimumInitialDeposit = Number(resolved.minimumInitialDeposit)
  }
  return resolved
}

/** Loads settings through any Mongoose-like model, tolerating lean and plain fakes. */
export async function loadResolvedSettings(HospitalSettingsModel) {
  if (!HospitalSettingsModel?.findOne) return resolveSettings(null)
  const query = HospitalSettingsModel.findOne({ key: 'default' })
  const doc = typeof query?.lean === 'function' ? await query.lean() : await query
  return resolveSettings(doc)
}
