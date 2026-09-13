export const DATE_FORMATS = ['locale', 'iso', 'dmy']
export const TIME_FORMATS = ['locale', '12h', '24h']
export const DEFAULT_LIST_PAGE_SIZE = 10

export const DEFAULT_CURRENCY = 'ETB'

const state = {
  currency: DEFAULT_CURRENCY,
  timezone: null,
  dateFormat: 'locale',
  timeFormat: 'locale',
  listPageSize: DEFAULT_LIST_PAGE_SIZE,
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
 * Applied once hospital settings load, so date/time rendering and list sizes follow the
 * System / General Settings section instead of hard-coded values.
 */
export function setDisplayPrefs(settings = {}) {
  if (typeof settings.currency === 'string' && /^[A-Za-z]{3}$/.test(settings.currency.trim())) {
    state.currency = settings.currency.trim().toUpperCase()
  }

  if (settings.timezone && isValidTimezone(settings.timezone)) state.timezone = settings.timezone
  else if (settings.timezone === null || settings.timezone === '') state.timezone = null

  if (DATE_FORMATS.includes(settings.dateFormat)) state.dateFormat = settings.dateFormat
  if (TIME_FORMATS.includes(settings.timeFormat)) state.timeFormat = settings.timeFormat

  const size = Number(settings.listPageSize)
  if (Number.isInteger(size) && size > 0) state.listPageSize = size
}

export function getDisplayPrefs() {
  return { ...state }
}

export function getCurrency() {
  return state.currency || DEFAULT_CURRENCY
}

export function getListPageSize() {
  return state.listPageSize
}
