const DOMAIN_MAX_LENGTH = 253
const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function normalizeBaseDomain(value: string) {
  return value.trim().replace(/^\.+|\.+$/g, '').toLowerCase()
}

export function isValidBaseDomain(value: string) {
  const normalized = normalizeBaseDomain(value)
  if (!normalized)
    return true

  if (normalized.length > DOMAIN_MAX_LENGTH)
    return false

  return normalized.split('.').every(label => LABEL_PATTERN.test(label))
}

export function buildNodeFqdn(givenName: string, baseDomain: string) {
  const normalizedName = givenName.trim().replace(/\.+$/g, '')
  const normalizedDomain = normalizeBaseDomain(baseDomain)

  if (!normalizedName || !normalizedDomain || !isValidBaseDomain(normalizedDomain))
    return null

  return `${normalizedName}.${normalizedDomain}`
}
