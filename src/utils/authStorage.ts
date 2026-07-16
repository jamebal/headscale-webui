import { normalizeBaseDomain } from './baseDomain'
import { local, session } from './storage'

const STORAGE_PREFIX = import.meta.env.VITE_STORAGE_PREFIX || ''
const LEGACY_AUTH_KEYS = ['accessToken', 'refreshToken', 'loginAccount'] as const

export function getSessionApiKey() {
  return session.get('accessToken') || ''
}

export function setSessionApiKey(apiKey: string) {
  session.set('accessToken', apiKey)
}

export function clearSessionApiKey() {
  session.remove('accessToken')
}

export function getSessionAuthorizationHeader() {
  const apiKey = getSessionApiKey()
  return apiKey ? `Bearer ${apiKey}` : undefined
}

export function saveConnectionConfig(serverUrl: string, baseDomain: string) {
  local.set('serverUrl', serverUrl.trim())
  local.set('baseDomain', normalizeBaseDomain(baseDomain))
}

export function migrateLegacyAuthStorage(
  storage: { removeItem: (key: string) => void } = window.localStorage,
) {
  for (const key of LEGACY_AUTH_KEYS)
    storage.removeItem(`${STORAGE_PREFIX}${key}`)

  try {
    if (local.get('baseDomain') === null)
      local.set('baseDomain', '')
  }
  catch {
    storage.removeItem(`${STORAGE_PREFIX}baseDomain`)
    local.set('baseDomain', '')
  }
}
