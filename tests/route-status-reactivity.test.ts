import { flushPromises, shallowMount } from '@vue/test-utils'
import { defineComponent, reactive } from 'vue'
import type { VNode } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import RouteTable from '@/views/route/routeTable.vue'
import NodeSubNetDetails from '@/views/node/nodeSubNetDetails.vue'
import ExitNodeDetails from '@/views/node/exitNodeDetails.vue'
import type { RouteData } from '@/service/api/route'

const mocks = vi.hoisted(() => ({
  setApprovedRoutes: vi.fn(),
}))

vi.mock('@/service/http/instances', () => ({
  getRequestInstance: () => ({
    Get: vi.fn(),
    Post: vi.fn(),
    Delete: vi.fn(),
  }),
}))

vi.mock('@/service/api/node', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/api/node')>()
  return {
    ...actual,
    fetchNodeList: vi.fn(),
    setApprovedRoutes: mocks.setApprovedRoutes,
  }
})

vi.mock('@/store', () => ({
  useAppStore: () => reactive({ message: null, sendMessage: vi.fn() }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const DataTableStub = defineComponent({
  name: 'DataTable',
  props: {
    columns: { type: Array, default: () => [] },
    data: { type: Array, default: () => [] },
  },
  template: '<div />',
})

const RouteTableStub = defineComponent({
  name: 'RouteTable',
  props: { routes: { type: Array, default: () => [] } },
  emits: ['routesUpdated'],
  template: '<div />',
})

const node = {
  id: '7',
  givenName: 'office',
  approvedRoutes: ['10.1.0.0/24'],
} as any

function createRoutes(): RouteData[] {
  return [
    {
      key: '7:10.0.0.0/24',
      node,
      prefix: '10.0.0.0/24',
      approved: false,
      exitRoute: false,
    },
    {
      key: '7:10.1.0.0/24',
      node,
      prefix: '10.1.0.0/24',
      approved: true,
      exitRoute: false,
    },
  ]
}

function mountRouteTable(routes = createRoutes()) {
  return shallowMount(RouteTable, {
    props: { routes },
    global: {
      stubs: {
        Space: { template: '<div><slot /></div>' },
        DataTable: DataTableStub,
      },
    },
  })
}

async function clickFirstRoute(wrapper: ReturnType<typeof mountRouteTable>) {
  const columns = wrapper.getComponent(DataTableStub).props('columns') as unknown as Array<{
    key?: string
    render?: (row: RouteData) => VNode
  }>
  const actionColumn = columns.find(column => column.key === 'actions')
  const button = actionColumn?.render?.(createRoutes()[0])
  button?.props?.onClick()
  await flushPromises()
}

describe('路由表更新事件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.$message = { success: vi.fn() } as unknown as typeof window.$message
  })

  it('接口成功后发布新的完整路由数组', async () => {
    mocks.setApprovedRoutes.mockResolvedValue({ isSuccess: true, data: { node } })
    const routes = createRoutes()
    const wrapper = mountRouteTable(routes)

    await clickFirstRoute(wrapper)

    const updated = wrapper.emitted('routesUpdated')?.[0]?.[0] as RouteData[]
    expect(updated).not.toBe(routes)
    expect(updated.map(route => route.approved)).toEqual([true, true])
  })

  it('接口失败时不发布路由更新', async () => {
    mocks.setApprovedRoutes.mockResolvedValue({ isSuccess: false })
    const wrapper = mountRouteTable()

    await clickFirstRoute(wrapper)

    expect(wrapper.emitted('routesUpdated')).toBeUndefined()
  })
})

describe('节点路由汇总响应式更新', () => {
  const commonStubs = {
    Popover: { template: '<div><slot name="trigger" /><slot /></div>' },
    Tag: { template: '<span><slot /></span>' },
    RouteTable: RouteTableStub,
  }

  it('子网审批事件后立即更新启用数量', async () => {
    const wrapper = shallowMount(NodeSubNetDetails, {
      props: { routes: createRoutes() },
      global: { stubs: commonStubs },
    })
    expect(wrapper.text()).toContain('app.subnets 1/2')

    const updated = createRoutes().map(route => ({ ...route, approved: true }))
    wrapper.getComponent(RouteTableStub).vm.$emit('routesUpdated', updated)
    await flushPromises()

    expect(wrapper.text()).toContain('app.subnets 2/2')
  })

  it('出口审批事件后立即移除未启用警告并同步新 props', async () => {
    const exitRoute = {
      ...createRoutes()[0],
      prefix: '0.0.0.0/0',
      exitRoute: true,
    }
    const wrapper = shallowMount(ExitNodeDetails, {
      props: { routes: [exitRoute] },
      global: {
        stubs: {
          ...commonStubs,
          NovaIcon: { template: '<i data-testid="warning" />' },
        },
      },
    })
    expect(wrapper.find('[data-testid="warning"]').exists()).toBe(true)

    wrapper.getComponent(RouteTableStub).vm.$emit('routesUpdated', [
      { ...exitRoute, approved: true },
    ])
    await flushPromises()
    expect(wrapper.find('[data-testid="warning"]').exists()).toBe(false)

    await wrapper.setProps({ routes: [{ ...exitRoute, approved: false }] })
    expect(wrapper.find('[data-testid="warning"]').exists()).toBe(true)
  })
})
