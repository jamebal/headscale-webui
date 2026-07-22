import { describe, expect, it } from 'vitest'
import { buildApprovedRoutes, deriveRoutes } from '@/service/api/route'
import type { NodeData } from '@/service/api/node'

const node = {
  id: '7',
  givenName: 'office',
  availableRoutes: ['10.0.0.0/24', '0.0.0.0/0', '::/0'],
  approvedRoutes: ['10.0.0.0/24', '::/0'],
} as NodeData

describe('v0.29 路由领域模型', () => {
  it('从节点字段派生审批状态与出口路由', () => {
    expect(deriveRoutes([node])).toEqual([
      {
        key: '7:10.0.0.0/24',
        node,
        prefix: '10.0.0.0/24',
        approved: true,
        exitRoute: false,
      },
      {
        key: '7:0.0.0.0/0',
        node,
        prefix: '0.0.0.0/0',
        approved: false,
        exitRoute: true,
      },
      {
        key: '7:::/0',
        node,
        prefix: '::/0',
        approved: true,
        exitRoute: true,
      },
    ])
  })

  it('启用单条路由时保留其他审批项并去重', () => {
    expect(buildApprovedRoutes(node, '0.0.0.0/0', true)).toEqual([
      '10.0.0.0/24',
      '::/0',
      '0.0.0.0/0',
    ])
    expect(buildApprovedRoutes(node, '10.0.0.0/24', true)).toEqual([
      '10.0.0.0/24',
      '::/0',
    ])
  })

  it('停用单条路由时只移除目标前缀', () => {
    expect(buildApprovedRoutes(node, '10.0.0.0/24', false)).toEqual(['::/0'])
  })
})
