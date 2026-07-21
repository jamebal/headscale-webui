import { buildCompletedURL } from '@alova/shared'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchNodeList,
  registerNode,
  renameNode,
  setApprovedRoutes,
} from '@/service/api/node'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/service/http/instances', () => ({
  getRequestInstance: () => ({
    Get: mocks.get,
    Post: mocks.post,
    Delete: mocks.delete,
  }),
}))

describe('节点 API', () => {
  it('对用户名中的查询字符串特殊字符进行编码', () => {
    mocks.get.mockImplementation((url, config) => {
      return buildCompletedURL('', url, config.params)
    })

    const url = fetchNodeList('alice&foo=bar') as unknown as string

    expect(url).toBe('/api/v1/node?user=alice%26foo%3Dbar')
  })

  it('编码节点注册参数', () => {
    registerNode({ user: 'alice+ops', key: 'key:a&b' })

    expect(mocks.post).toHaveBeenCalledWith(
      '/api/v1/node/register?user=alice%2Bops&key=key%3Aa%26b',
    )
  })

  it('编码节点重命名路径并提交完整路由审批集合', () => {
    renameNode({ nodeId: '42', newName: 'office / one' })
    setApprovedRoutes('42', ['10.0.0.0/24', '::/0'])

    expect(mocks.post).toHaveBeenNthCalledWith(
      1,
      '/api/v1/node/42/rename/office%20%2F%20one',
    )
    expect(mocks.post).toHaveBeenNthCalledWith(
      2,
      '/api/v1/node/42/approve_routes',
      { routes: ['10.0.0.0/24', '::/0'] },
    )
  })

  it('不再导出 v0.29 已移除的节点变更所有者 API', async () => {
    const nodeApi = await import('@/service/api/node')

    expect(nodeApi).not.toHaveProperty('moveNode')
  })
})
