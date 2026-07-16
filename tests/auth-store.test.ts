import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/auth'
import { getSessionApiKey } from '@/utils/authStorage'

const mocks = vi.hoisted(() => ({
  fetchLogin: vi.fn(),
  initAuthRoute: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('@/service', () => ({
  fetchLogin: mocks.fetchLogin,
}))

vi.mock('@/router', () => ({
  router: {
    currentRoute: { meta: {}, query: {}, fullPath: '/' },
    push: mocks.routerPush,
  },
}))

vi.mock('@/store/router', () => ({
  useRouteStore: () => ({
    initAuthRoute: mocks.initAuthRoute,
    resetRouteStore: vi.fn(),
  }),
}))

vi.mock('@/store/tab', () => ({
  useTabStore: () => ({
    clearAllTabs: vi.fn(),
  }),
}))

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.fetchLogin.mockReset()
    mocks.initAuthRoute.mockReset()
    mocks.routerPush.mockReset()
  })

  it('登录成功后 API Key 只存在于 sessionStorage', async () => {
    mocks.fetchLogin.mockResolvedValue({
      isSuccess: true,
      data: { users: [{ id: 1, name: 'admin' }] },
    })
    const store = useAuthStore()

    await store.login('https://headscale.example.com', 'example.internal', 'secret-key')

    expect(getSessionApiKey()).toBe('secret-key')
    expect(window.localStorage.getItem('accessToken')).toBeNull()
    expect(store.isLogin).toBe(true)
  })

  it('登录失败时清理 Session API Key 并保留连接配置', async () => {
    mocks.fetchLogin.mockResolvedValue({ isSuccess: false })
    const { local } = await import('@/utils/storage')
    const store = useAuthStore()

    await store.login('https://headscale.example.com', 'example.internal', 'secret-key')

    expect(getSessionApiKey()).toBe('')
    expect(local.get('serverUrl')).toBe('https://headscale.example.com')
    expect(local.get('baseDomain')).toBe('example.internal')
  })

  it('退出时清理 Session API Key', async () => {
    const { setSessionApiKey } = await import('@/utils/authStorage')
    const store = useAuthStore()
    setSessionApiKey('secret-key')

    await store.logout()

    expect(getSessionApiKey()).toBe('')
  })
})
