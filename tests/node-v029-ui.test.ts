import { shallowMount } from '@vue/test-utils'
import { NDropdown } from 'naive-ui'
import { describe, expect, it, vi } from 'vitest'
import NodeActions from '@/views/node/nodeActions.vue'
import SetTagsModel from '@/views/node/setTagsModel.vue'
import type { NodeData } from '@/service/api/node'

vi.mock('@/service/http/instances', () => ({
  getRequestInstance: () => ({
    Get: vi.fn(),
    Post: vi.fn(),
    Delete: vi.fn(),
  }),
}))

vi.mock('@/store/app', () => ({
  useAppStore: () => ({ sendMessage: vi.fn() }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

vi.mock('naive-ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('naive-ui')>()
  return { ...actual, useDialog: () => ({}) }
})

const node = {
  id: '7',
  givenName: 'office',
  name: 'office.example',
  user: { id: '1', name: 'alice', createdAt: '' },
  tags: ['tag:server'],
  approvedRoutes: [],
  availableRoutes: [],
  subnetRoutes: [],
} as unknown as NodeData

describe('v0.29 节点操作界面', () => {
  it('不再提供节点变更所有者操作', () => {
    const wrapper = shallowMount(NodeActions, {
      props: { nodeData: node },
      global: {
        stubs: {
          NDropdown: { props: ['options'], template: '<div />' },
          NButton: { template: '<button />' },
          NovaIcon: true,
        },
      },
    })

    const options = wrapper.getComponent(NDropdown).props('options') ?? []
    const labels = (options as unknown as Array<{ label?: string }>)
      .map((option: { label?: string }) => option.label)
    expect(labels).not.toContain('app.changeOwner')
  })

  it('标签弹窗从 node.tags 初始化', async () => {
    const wrapper = shallowMount(SetTagsModel, {
      props: { show: false, nodeData: node },
      global: {
        stubs: {
          NModal: { template: '<div><slot /></div>' },
          NDynamicTags: { name: 'NDynamicTags', props: ['value'], template: '<div />' },
          NSpace: { template: '<div><slot /></div>' },
          NButton: { template: '<button><slot /></button>' },
        },
      },
    })

    await wrapper.setProps({ show: true })

    expect((wrapper.vm as unknown as { tags: Array<{ label: string, value: string }> }).tags).toEqual([
      { label: 'tag:server', value: 'tag:server' },
    ])
  })
})
