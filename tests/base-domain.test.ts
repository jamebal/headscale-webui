import { describe, expect, it } from 'vitest'
import {
  buildNodeFqdn,
  isValidBaseDomain,
  normalizeBaseDomain,
} from '@/utils/baseDomain'

describe('baseDomain', () => {
  it('标准化大小写、空白和首尾点', () => {
    expect(normalizeBaseDomain(' .EXAMPLE.Internal. ')).toBe('example.internal')
  })

  it('允许空值和合法 DNS domain', () => {
    expect(isValidBaseDomain('')).toBe(true)
    expect(isValidBaseDomain('example.internal')).toBe(true)
    expect(isValidBaseDomain('tailnet.example.com')).toBe(true)
  })

  it.each([
    'https://example.internal',
    'example.internal:443',
    'example.internal/path',
    'bad_domain.example',
    '-invalid.example',
    'invalid-.example',
    '中文.example',
  ])('拒绝非法 domain：%s', (value) => {
    expect(isValidBaseDomain(value)).toBe(false)
  })

  it('拒绝超长 label 和超长 domain', () => {
    expect(isValidBaseDomain(`${'a'.repeat(64)}.example`)).toBe(false)
    expect(isValidBaseDomain(`${'a.'.repeat(126)}abcd`)).toBe(false)
  })

  it('生成标准化 FQDN', () => {
    expect(buildNodeFqdn(' node-1. ', ' .Example.Internal. ')).toBe('node-1.example.internal')
  })

  it('节点名或 baseDomain 为空时不生成 FQDN', () => {
    expect(buildNodeFqdn('', 'example.internal')).toBeNull()
    expect(buildNodeFqdn('node-1', '')).toBeNull()
  })
})
