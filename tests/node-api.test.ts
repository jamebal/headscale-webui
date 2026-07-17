import { describe, expect, it, vi } from 'vitest'
import { fetchNodeList } from '@/service/api/node'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/service/http/instances', () => ({
  getRequestInstance: () => ({ Get: mocks.get }),
}))

describe('节点 API', () => {
  it('使用结构化查询参数传递用户名', () => {
    fetchNodeList('alice&foo=bar')

    expect(mocks.get).toHaveBeenCalledWith('/api/v1/node', {
      params: { user: 'alice&foo=bar' },
    })
  })
})
