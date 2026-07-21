import { flushPromises, shallowMount } from '@vue/test-utils'
import { defineComponent, nextTick, reactive } from 'vue'
import type { VNode } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserPage from '@/views/user/index.vue'
import DeployPage from '@/views/deploy/index.vue'

const SlotStub = { template: '<div><slot /></div>' }
const DataTableStub = defineComponent({
  name: 'DataTable',
  props: { columns: { type: Array, default: () => [] } },
  template: '<div />',
})
const InputStub = defineComponent({
  name: 'Input',
  props: { type: { type: String, default: 'text' } },
  template: '<input />',
})

const mocks = vi.hoisted(() => ({
  fetchUserList: vi.fn(),
}))

vi.mock('@/service/http/instances', () => ({
  getRequestInstance: () => ({
    Get: vi.fn(),
    Post: vi.fn(),
    Put: vi.fn(),
    Delete: vi.fn(),
  }),
}))

vi.mock('@/service/api/user', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/api/user')>()
  return { ...actual, fetchUserList: mocks.fetchUserList }
})

vi.mock('@/store', () => ({
  useAppStore: () => reactive({ message: null }),
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

describe('preAuthKey 管理入口', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchUserList.mockResolvedValue({ isSuccess: true, data: { users: [] } })
  })

  it('用户管理页不再挂载 PreAuthKey 弹窗', async () => {
    const wrapper = shallowMount(UserPage, {
      global: {
        stubs: {
          Space: SlotStub,
          NSpace: SlotStub,
          DataTable: DataTableStub,
        },
      },
    })
    await flushPromises()
    const columns = wrapper.getComponent(DataTableStub).props('columns') as Array<{
      key?: string
      render?: (row: unknown, index: number) => unknown
    }>
    const actionColumn = columns.find(column => column.key === 'actions')
    const actionVNode = actionColumn?.render?.({
      id: '12',
      name: 'alice',
      createdAt: '',
    }, 0) as VNode
    const labels = (actionVNode.children as VNode[]).map((child) => {
      const slots = child.children as { default?: () => unknown }
      return slots.default?.()
    })

    expect(labels).not.toContain('app.preAuthKeys')
  })

  it('部署页使用手动密码输入而不是 PreAuthKey 级联选择器', async () => {
    const wrapper = shallowMount(DeployPage, {
      global: {
        stubs: {
          Space: SlotStub,
          Flex: SlotStub,
          Card: SlotStub,
          CheckboxGroup: SlotStub,
          Checkbox: SlotStub,
          Grid: SlotStub,
          Gi: SlotStub,
          GridItem: SlotStub,
          Input: InputStub,
          HelpInfo: true,
          Code: true,
        },
      },
    })
    const vm = wrapper.vm as unknown as { options: string[] }
    vm.options = [...vm.options, '--auth-key']
    await nextTick()

    expect(wrapper.findComponent({ name: 'AuthKeyCascader' }).exists()).toBe(false)
    expect(wrapper.getComponent(InputStub).props('type')).toBe('password')
  })
})
