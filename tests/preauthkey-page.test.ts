import { flushPromises, shallowMount } from '@vue/test-utils'
import { defineComponent, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { staticRoutes } from '@/router/routes.static'
import PreAuthKeyPage from '@/views/preAuthKey/index.vue'

const mocks = vi.hoisted(() => ({
  fetchPreAuthKeyList: vi.fn(),
  fetchUserList: vi.fn(),
}))

vi.mock('@/service/api/preAuthKeys', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/api/preAuthKeys')>()
  return { ...actual, fetchPreAuthKeyList: mocks.fetchPreAuthKeyList }
})

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

const NSelectStub = defineComponent({
  name: 'NSelect',
  props: { value: { type: String, default: '' } },
  emits: ['update:value'],
  template: '<button data-testid="user-filter" />',
})

const NDataTableStub = defineComponent({
  name: 'NDataTable',
  props: {
    data: { type: Array, default: () => [] },
    columns: { type: Array, default: () => [] },
  },
  template: '<div data-testid="preauthkey-table" />',
})

const keys = [
  {
    id: '91',
    user: { id: '12', name: 'alice', createdAt: '' },
    key: 'hskey-auth-********alice',
    reusable: false,
    ephemeral: false,
    used: false,
    expiration: '2099-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    aclTags: [],
  },
  {
    id: '92',
    user: { id: '13', name: 'bob', createdAt: '' },
    key: 'hskey-auth-********bob',
    reusable: true,
    ephemeral: false,
    used: false,
    expiration: '2099-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    aclTags: [],
  },
]

async function mountPage() {
  const wrapper = shallowMount(PreAuthKeyPage, {
    global: {
      stubs: {
        Select: NSelectStub,
        DataTable: NDataTableStub,
        Space: { template: '<div><slot /></div>' },
        NSpace: { template: '<div><slot /></div>' },
        NButton: { template: '<button><slot /></button>' },
        NTag: { template: '<span><slot /></span>' },
        NSwitch: true,
        NovaIcon: true,
      },
    },
  })
  await flushPromises()
  return wrapper
}

describe('preAuthKey 独立管理页面', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.fetchPreAuthKeyList.mockResolvedValue({
      isSuccess: true,
      data: { preAuthKeys: keys },
    })
    mocks.fetchUserList.mockResolvedValue({
      isSuccess: true,
      data: { users: keys.map(key => key.user) },
    })
  })

  it('注册独立导航路由', () => {
    expect(staticRoutes).toContainEqual(expect.objectContaining({
      name: 'preAuthKeys',
      path: '/preauthkeys',
      componentPath: '/preAuthKey/index.vue',
    }))
  })

  it('将 GET 返回的脱敏 key 作为普通文本展示', async () => {
    const wrapper = await mountPage()
    const table = wrapper.getComponent(NDataTableStub)
    const keyColumn = table.props('columns').find((column: { key: string }) => column.key === 'key')

    expect(keyColumn.render(keys[0])).toBe('hskey-auth-********alice')
    expect(wrapper.findComponent({ name: 'CopyText' }).exists()).toBe(false)
  })

  it('按用户 ID 过滤全量列表', async () => {
    const wrapper = await mountPage()

    wrapper.getComponent(NSelectStub).vm.$emit('update:value', '12')
    await flushPromises()

    expect(wrapper.getComponent(NDataTableStub).props('data')).toEqual([keys[0]])
  })
})
