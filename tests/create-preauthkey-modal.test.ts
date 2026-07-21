import { flushPromises, shallowMount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import CreatePreAuthKeyModal from '@/views/preAuthKey/createPreAuthKeyModal.vue'

const mocks = vi.hoisted(() => ({
  createPreAuthKey: vi.fn(),
  copy: vi.fn(),
}))

vi.mock('@/service/http/instances', () => ({
  getRequestInstance: () => ({
    Get: vi.fn(),
    Post: vi.fn(),
    Delete: vi.fn(),
  }),
}))

vi.mock('@/service/api/preAuthKeys', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/service/api/preAuthKeys')>()
  return { ...actual, createPreAuthKey: mocks.createPreAuthKey }
})

vi.mock('@vueuse/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vueuse/core')>()
  return { ...actual, useClipboard: () => ({ copy: mocks.copy }) }
})

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const users = [{ id: '12', name: 'alice', createdAt: '' }]

function mountModal() {
  return shallowMount(CreatePreAuthKeyModal, {
    props: { show: true, users },
    global: {
      stubs: {
        Modal: { template: '<div><slot /><slot name="action" /></div>' },
        Form: { template: '<form><slot /></form>' },
        FormItem: { template: '<label><slot /></label>' },
        Select: true,
        DatePicker: true,
        Switch: true,
        DynamicTags: true,
        Space: { template: '<div><slot /></div>' },
        NButton: { template: '<button><slot /></button>' },
        Alert: { template: '<div><slot /></div>' },
      },
    },
  })
}

describe('创建 PreAuthKey 的一次性完整值', () => {
  it('只展示并复制 POST 响应中的完整 key，关闭后清空', async () => {
    window.$message = { success: vi.fn() } as typeof window.$message
    mocks.createPreAuthKey.mockResolvedValue({
      isSuccess: true,
      data: {
        preAuthKey: {
          id: '99',
          key: 'hskey-auth-full-secret',
          user: users[0],
        },
      },
    })
    const wrapper = mountModal()
    const vm = wrapper.vm as unknown as {
      form: { user: string }
      createdKey: string
      handleSubmit: () => Promise<void>
      copyCreatedKey: () => void
      closeModal: () => void
    }
    vm.form.user = '12'

    await vm.handleSubmit()
    await flushPromises()

    expect(vm.createdKey).toBe('hskey-auth-full-secret')
    vm.copyCreatedKey()
    expect(mocks.copy).toHaveBeenCalledWith('hskey-auth-full-secret')

    vm.closeModal()
    expect(vm.createdKey).toBe('')
    await wrapper.setProps({ show: false })
    await wrapper.setProps({ show: true })
    expect(vm.createdKey).toBe('')
  })
})
