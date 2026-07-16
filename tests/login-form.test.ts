import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Login from '@/views/login/components/Login/index.vue'
import { local } from '@/utils/storage'

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
}))

vi.mock('@/store', () => ({
  useAuthStore: () => ({ login: mocks.login }),
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
    }),
  }
})

function mountLogin() {
  return mount(Login, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        NForm: {
          template: '<form><slot /></form>',
          methods: {
            validate(callback: (errors?: unknown) => void) {
              callback()
            },
          },
        },
        NFormItem: { template: '<div><slot /></div>' },
        NInput: {
          props: ['value'],
          emits: ['update:value'],
          template: '<input :value="value" @input="$emit(\'update:value\', $event.target.value)" />',
        },
        NSpace: { template: '<div><slot /></div>' },
        NButton: { template: '<button type="button" @click="$emit(\'click\')"><slot /></button>' },
      },
    },
  })
}

describe('login form', () => {
  beforeEach(() => {
    mocks.login.mockReset()
  })

  it('显示 Server URL、Base Domain 和 API Key 三个输入框', () => {
    const wrapper = mountLogin()
    expect(wrapper.findAll('input')).toHaveLength(3)
  })

  it('恢复连接配置但不恢复 API Key', () => {
    local.set('serverUrl', 'https://headscale.example.com')
    local.set('baseDomain', 'example.internal')

    const wrapper = mountLogin()
    const inputs = wrapper.findAll('input')

    expect(inputs[0].element.value).toBe('https://headscale.example.com')
    expect(inputs[1].element.value).toBe('example.internal')
    expect(inputs[2].element.value).toBe('')
  })

  it('提交标准化后的三个登录参数', async () => {
    const wrapper = mountLogin()
    const inputs = wrapper.findAll('input')
    await inputs[0].setValue('https://headscale.example.com')
    await inputs[1].setValue(' .Example.Internal. ')
    await inputs[2].setValue('secret-key')
    await wrapper.find('button').trigger('click')

    expect(mocks.login).toHaveBeenCalledWith(
      'https://headscale.example.com',
      'example.internal',
      'secret-key',
    )
  })
})
