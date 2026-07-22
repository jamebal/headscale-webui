import { describe, expect, it } from 'vitest'
import {
  buildPersonalNodeRecoveryCommand,
  buildTailscaleUpCommand,
} from '@/views/deploy/command'

describe('部署命令生成器', () => {
  it('按顺序序列化布尔值和字符串选项', () => {
    expect(buildTailscaleUpCommand(
      'https://headscale.example.com',
      [
        { name: '--reset', value: true },
        { name: '--accept-dns', value: false },
        { name: '--hostname', value: 'workstation' },
      ],
    )).toBe('tailscale up --login-server=https://headscale.example.com --reset --accept-dns=false --hostname=workstation')
  })

  it('保留显式空字符串选项及其顺序', () => {
    expect(buildTailscaleUpCommand(
      'https://headscale.example.com',
      [
        { name: '--advertise-routes', value: '' },
        { name: '--exit-node', value: '' },
      ],
    )).toBe('tailscale up --login-server=https://headscale.example.com --advertise-routes= --exit-node=')
  })

  it('安全转义含空格和单引号的 shell 参数', () => {
    expect(buildTailscaleUpCommand(
      'https://headscale example.com',
      [{ name: '--hostname', value: 'worker\'s host' }],
    )).toBe('tailscale up --login-server=\'https://headscale example.com\' --hostname=\'worker\'"\'"\'s host\'')
  })

  it.each([
    '--reset; malicious-command',
    '--name\nmalicious-command',
    '--$(malicious-command)',
  ])('拒绝非法参数名：%s', (name) => {
    expect(() => buildTailscaleUpCommand(
      'https://headscale.example.com',
      [{ name: name as `--${string}`, value: true }],
    )).toThrow(TypeError)
  })

  it('生成默认不含 reset 的个人节点恢复命令', () => {
    expect(buildPersonalNodeRecoveryCommand('https://headscale.example.com'))
      .toBe('tailscale up --login-server=https://headscale.example.com --force-reauth')
  })

  it('按需在个人节点恢复命令末尾追加 reset', () => {
    expect(buildPersonalNodeRecoveryCommand('https://headscale.example.com', true))
      .toBe('tailscale up --login-server=https://headscale.example.com --force-reauth --reset')
  })
})
