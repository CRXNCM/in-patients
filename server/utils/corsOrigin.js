const PRIVATE_HOST = /^(localhost|127\.0\.0\.1)$/i
const IPV4_10 = /^10(?:\.\d{1,3}){3}$/
const IPV4_192 = /^192\.168(?:\.\d{1,3}){2}$/
const IPV4_172 = /^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/

export function extraCorsOrigins(value = process.env.CORS_ORIGIN) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

export function isPrivateLanHost(host) {
  const name = String(host || '').replace(/^\[|\]$/g, '')
  return PRIVATE_HOST.test(name) || IPV4_10.test(name) || IPV4_192.test(name) || IPV4_172.test(name)
}

export function isAllowedBrowserOrigin(origin, extras = extraCorsOrigins()) {
  if (!origin) return true
  if (extras.includes(origin)) return true
  try {
    const url = new URL(origin)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    return isPrivateLanHost(url.hostname)
  } catch {
    return false
  }
}

export function corsOriginDelegate(origin, callback) {
  if (isAllowedBrowserOrigin(origin)) callback(null, true)
  else callback(new Error('Not allowed by CORS'))
}
