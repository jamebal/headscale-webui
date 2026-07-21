import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createPreAuthKey,
  expirePreAuthKey,
  fetchPreAuthKeyList,
  filterPreAuthKeysByUser,
} from '@/service/api/preAuthKeys'
import type { PreAuthKeyData } from '@/service/api/preAuthKeys'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('@/service/http/instances', () => ({
  getRequestInstance: () => ({
    Get: mocks.get,
    Post: mocks.post,
  }),
}))

const keys = [
  { id: '91', user: { id: '12', name: 'alice' } },
  { id: '92', user: { id: '13', name: 'bob' } },
] as PreAuthKeyData[]

describe('v0.29 PreAuthKey API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('列表请求不再发送 user query', () => {
    fetchPreAuthKeyList()

    expect(mocks.get).toHaveBeenCalledWith('/api/v1/preauthkey')
  })

  it('创建使用用户 ID，过期使用 key ID', () => {
    createPreAuthKey({
      user: '12',
      reusable: false,
      ephemeral: false,
      expiration: null,
      aclTags: [],
    })
    expirePreAuthKey('99')

    expect(mocks.post).toHaveBeenNthCalledWith(
      1,
      '/api/v1/preauthkey',
      {
        user: '12',
        reusable: false,
        ephemeral: false,
        expiration: null,
        aclTags: [],
      },
    )
    expect(mocks.post).toHaveBeenNthCalledWith(
      2,
      '/api/v1/preauthkey/expire',
      { id: '99' },
    )
  })

  it('按用户 ID 过滤全量 key', () => {
    expect(filterPreAuthKeysByUser(keys, '12')).toEqual([keys[0]])
  })
})
