import { flushPromises, shallowMount } from '@vue/test-utils'
import { defineComponent, reactive } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NodeIndex from '@/views/node/index.vue'

const mocks = vi.hoisted(() => ({
  fetchNodeList: vi.fn(),
  fetchRouteList: vi.fn(),
  fetchUserList: vi.fn(),
}))

vi.mock('@/service/api/node', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/api/node')>()
  return { ...actual, fetchNodeList: mocks.fetchNodeList }
})

vi.mock('@/service/api/route', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/api/route')>()
  return { ...actual, fetchRouteList: mocks.fetchRouteList }
})

vi.mock('@/service/api/user', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/api/user')>()
  return { ...actual, fetchUserList: mocks.fetchUserList }
})

vi.mock('@/store', () => ({
  useAppStore: () => reactive({ message: null }),
}))

vi.mock('@/views/node/registerNodeModal.vue', () => ({
  default: { name: 'RegisterNodeModal', template: '<div />' },
}))

vi.mock('@/views/node/nodeDetails.vue', () => ({
  default: { name: 'NodeDetails', template: '<div />' },
}))

vi.mock('@/views/node/nodeActions.vue', () => ({
  default: { name: 'NodeActions', template: '<div />' },
}))

vi.mock('@/views/node/nodeSubNetDetails.vue', () => ({
  default: { name: 'NodeSubNetDetails', template: '<div />' },
}))

vi.mock('@/views/node/exitNodeDetails.vue', () => ({
  default: { name: 'ExitNodeDetails', template: '<div />' },
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

const NSelectStub = defineComponent({
  name: 'NSelect',
  props: {
    value: { type: String, default: '' },
  },
  emits: ['update:value'],
  template: '<button data-testid="user-filter" />',
})

async function mountNodePage(query: Record<string, string | string[]> = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/node', component: { template: '<div />' } }],
  })
  await router.push({ path: '/node', query })
  await router.isReady()

  const wrapper = shallowMount(NodeIndex, {
    global: {
      plugins: [router],
      stubs: {
        Space: { template: '<div><slot /></div>' },
        Select: NSelectStub,
      },
    },
  })
  await flushPromises()
  return { router, wrapper }
}

const invalidUserQueries: Array<Record<string, string | string[]>> = [
  {},
  { user: '' },
  { user: ['alice', 'bob'] },
]

describe('节点用户筛选 URL 同步', () => {
  beforeEach(() => {
    mocks.fetchNodeList.mockResolvedValue({ isSuccess: true, data: { nodes: [] } })
    mocks.fetchRouteList.mockResolvedValue({ isSuccess: true, data: { routes: [] } })
    mocks.fetchUserList.mockResolvedValue({ isSuccess: true, data: { users: [] } })
  })

  it('从 URL 恢复用户筛选并请求对应节点', async () => {
    const { wrapper } = await mountNodePage({ user: 'alice' })

    expect(wrapper.getComponent(NSelectStub).props('value')).toBe('alice')
    expect(mocks.fetchNodeList).toHaveBeenCalledWith('alice')
  })

  it.each(invalidUserQueries)('将缺失、空值或数组形式的用户参数视为 All', async (query) => {
    const { wrapper } = await mountNodePage(query)

    expect(wrapper.getComponent(NSelectStub).props('value')).toBe('')
    expect(mocks.fetchNodeList).toHaveBeenCalledWith('')
  })

  it('路由用户参数变化时同步筛选并重新请求节点', async () => {
    const { router, wrapper } = await mountNodePage({ user: 'alice' })
    mocks.fetchNodeList.mockClear()

    await router.push({ path: '/node', query: { user: 'bob' } })
    await flushPromises()

    expect(wrapper.getComponent(NSelectStub).props('value')).toBe('bob')
    expect(mocks.fetchNodeList).toHaveBeenCalledTimes(1)
    expect(mocks.fetchNodeList).toHaveBeenCalledWith('bob')
  })

  it('选择用户时替换 URL 并保留其他查询参数', async () => {
    const { router, wrapper } = await mountNodePage({ tab: 'details' })
    const replace = vi.spyOn(router, 'replace')

    wrapper.getComponent(NSelectStub).vm.$emit('update:value', 'alice')
    await flushPromises()

    expect(replace).toHaveBeenCalledWith({
      query: { tab: 'details', user: 'alice' },
    })
    expect(router.currentRoute.value.query).toEqual({
      tab: 'details',
      user: 'alice',
    })
  })

  it('选择 All 时移除 user 并保留其他查询参数', async () => {
    const { router, wrapper } = await mountNodePage({ user: 'alice', tab: 'details' })
    const replace = vi.spyOn(router, 'replace')

    wrapper.getComponent(NSelectStub).vm.$emit('update:value', '')
    await flushPromises()

    expect(replace).toHaveBeenCalledWith({
      query: { tab: 'details' },
    })
    expect(router.currentRoute.value.query).toEqual({ tab: 'details' })
  })
})
