import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteApiKey } from '@/service/api/apiKey'
import { createUser, renameUser } from '@/service/api/user'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/service/http/instances', () => ({
  getRequestInstance: () => ({
    Get: vi.fn(),
    Post: mocks.post,
    Put: vi.fn(),
    Delete: mocks.delete,
  }),
}))

describe('headscale v0.29 其余 API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('编码用户重命名和 ApiKey 删除路径', () => {
    renameUser('7', 'alice / ops')
    deleteApiKey('abc/def')

    expect(mocks.post).toHaveBeenCalledWith(
      '/api/v1/user/7/rename/alice%20%2F%20ops',
    )
    expect(mocks.delete).toHaveBeenCalledWith('/api/v1/apikey/abc%2Fdef')
  })

  it('创建用户保留 v0.29 支持的可选资料字段', () => {
    createUser({
      name: 'alice',
      displayName: 'Alice Chen',
      email: 'alice@example.com',
      pictureUrl: 'https://example.com/alice.png',
    })

    expect(mocks.post).toHaveBeenCalledWith('/api/v1/user', {
      name: 'alice',
      displayName: 'Alice Chen',
      email: 'alice@example.com',
      pictureUrl: 'https://example.com/alice.png',
    })
  })
})
