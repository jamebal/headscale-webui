import { describe, expect, it } from 'vitest'
import {
  clearSessionApiKey,
  getSessionApiKey,
  getSessionAuthorizationHeader,
  migrateLegacyAuthStorage,
  saveConnectionConfig,
  setSessionApiKey,
} from '@/utils/authStorage'
import { local } from '@/utils/storage'

describe('authStorage', () => {
  it('确保 API Key 只写入 sessionStorage', () => {
    setSessionApiKey('secret-key')

    expect(getSessionApiKey()).toBe('secret-key')
    expect(window.localStorage.getItem('accessToken')).toBeNull()
    expect(window.localStorage.getItem('refreshToken')).toBeNull()
  })

  it('清理当前 tab 的 API Key', () => {
    setSessionApiKey('secret-key')
    clearSessionApiKey()

    expect(getSessionApiKey()).toBe('')
  })

  it('只在 Session API Key 存在时生成 Authorization header', () => {
    expect(getSessionAuthorizationHeader()).toBeUndefined()

    setSessionApiKey('secret-key')

    expect(getSessionAuthorizationHeader()).toBe('Bearer secret-key')
  })

  it('保存 serverUrl 和标准化 baseDomain', () => {
    saveConnectionConfig('https://headscale.example.com', ' .Example.Internal. ')

    expect(local.get('serverUrl')).toBe('https://headscale.example.com')
    expect(local.get('baseDomain')).toBe('example.internal')
  })

  it('迁移时删除旧 Token 和 loginAccount，但保留 serverUrl', () => {
    local.set('serverUrl', 'https://headscale.example.com')
    window.localStorage.setItem('accessToken', 'legacy-access-token')
    window.localStorage.setItem('refreshToken', 'legacy-refresh-token')
    window.localStorage.setItem('loginAccount', 'legacy-login')

    migrateLegacyAuthStorage()

    expect(window.localStorage.getItem('accessToken')).toBeNull()
    expect(window.localStorage.getItem('refreshToken')).toBeNull()
    expect(window.localStorage.getItem('loginAccount')).toBeNull()
    expect(local.get('serverUrl')).toBe('https://headscale.example.com')
    expect(local.get('baseDomain')).toBe('')
  })

  it('迁移可重复执行', () => {
    expect(() => {
      migrateLegacyAuthStorage()
      migrateLegacyAuthStorage()
    }).not.toThrow()
  })

  it('损坏的旧 baseDomain 不阻塞启动', () => {
    window.localStorage.setItem('baseDomain', 'not-json')

    expect(() => migrateLegacyAuthStorage()).not.toThrow()
    expect(local.get('baseDomain')).toBe('')
  })
})
