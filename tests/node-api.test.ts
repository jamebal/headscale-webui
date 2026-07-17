import { buildCompletedURL } from '@alova/shared'
import { describe, expect, it, vi } from 'vitest'
import { fetchNodeList } from '@/service/api/node'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/service/http/instances', () => ({
  getRequestInstance: () => ({ Get: mocks.get }),
}))

describe('节点 API', () => {
  it('对用户名中的查询字符串特殊字符进行编码', () => {
    mocks.get.mockImplementation((url, config) => {
      return buildCompletedURL('', url, config.params)
    })

    const url = fetchNodeList('alice&foo=bar') as unknown as string

    expect(url).toBe('/api/v1/node?user=alice%26foo%3Dbar')
  })
})
