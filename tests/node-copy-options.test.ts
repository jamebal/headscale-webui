import { describe, expect, it } from 'vitest'
import { buildNodeCopyValues } from '@/utils/baseDomain'

describe('buildNodeCopyValues', () => {
  it('有 baseDomain 时把 FQDN 放在第一项', () => {
    expect(buildNodeCopyValues(
      'node-1',
      ['100.64.0.1', 'fd7a:115c:a1e0::1'],
      'example.internal',
    )).toEqual([
      'node-1.example.internal',
      'node-1',
      '100.64.0.1',
      'fd7a:115c:a1e0::1',
    ])
  })

  it('baseDomain 为空时保持现有顺序', () => {
    expect(buildNodeCopyValues(
      'node-1',
      ['100.64.0.1'],
      '',
    )).toEqual([
      'node-1',
      '100.64.0.1',
    ])
  })

  it('避免重复的完整域名或 IP 值', () => {
    expect(buildNodeCopyValues(
      'node-1',
      ['node-1', '100.64.0.1', '100.64.0.1'],
      'example.internal',
    )).toEqual([
      'node-1.example.internal',
      'node-1',
      '100.64.0.1',
    ])
  })
})
