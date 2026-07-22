import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import DeployView from '@/views/deploy/index.vue'
import { local } from '@/utils/storage'

enableAutoUnmount(afterEach)

const mocks = vi.hoisted(() => ({
  copy: vi.fn(),
  fetchRouteList: vi.fn(),
}))

vi.mock('@vueuse/core', () => ({
  useClipboard: () => ({ copy: mocks.copy }),
}))

vi.mock('@/service', () => ({
  fetchRouteList: mocks.fetchRouteList,
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const LayoutStub = defineComponent({
  template: '<div><slot /><slot name="icon" /></div>',
})

const NCheckboxStub = defineComponent({
  name: 'NCheckbox',
  inheritAttrs: false,
  props: {
    checked: { type: Boolean, default: false },
  },
  emits: ['update:checked'],
  template: `
    <label>
      <input
        v-bind="$attrs"
        type="checkbox"
        :checked="checked"
        @change="$emit('update:checked', $event.target.checked)"
      >
      <slot />
    </label>
  `,
})

const NInputStub = defineComponent({
  name: 'NInput',
  inheritAttrs: false,
  props: {
    value: { type: String, default: '' },
    status: { type: String, default: undefined },
  },
  emits: ['update:value'],
  template: `
    <input
      v-bind="$attrs"
      :value="value"
      :data-status="status"
      @input="$emit('update:value', $event.target.value)"
    >
  `,
})

const NSelectStub = defineComponent({
  name: 'NSelect',
  inheritAttrs: false,
  props: {
    value: { type: [String, Number], default: '' },
    options: { type: Array, default: () => [] },
  },
  emits: ['update:value'],
  template: `
    <select
      v-bind="$attrs"
      :value="value"
      @change="$emit('update:value', $event.target.value)"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
  `,
})

const NCodeStub = defineComponent({
  name: 'NCode',
  props: {
    code: { type: String, required: true },
  },
  template: '<pre data-testid="command-text">{{ code }}</pre>',
})

const NDynamicTagsStub = defineComponent({
  name: 'NDynamicTags',
  inheritAttrs: false,
  props: {
    value: { type: Array, default: () => [] },
  },
  emits: ['update:value'],
  template: '<div v-bind="$attrs" />',
})

function mountDeployView() {
  return mount(DeployView, {
    global: {
      stubs: {
        Space: LayoutStub,
        NSpace: LayoutStub,
        Flex: LayoutStub,
        NFlex: LayoutStub,
        Grid: LayoutStub,
        NGrid: LayoutStub,
        GridItem: LayoutStub,
        NGi: LayoutStub,
        Card: LayoutStub,
        NCard: LayoutStub,
        Button: LayoutStub,
        NButton: LayoutStub,
        Checkbox: NCheckboxStub,
        NCheckbox: NCheckboxStub,
        Input: NInputStub,
        NInput: NInputStub,
        Select: NSelectStub,
        NSelect: NSelectStub,
        Code: NCodeStub,
        NCode: NCodeStub,
        DynamicTags: NDynamicTagsStub,
        NDynamicTags: NDynamicTagsStub,
        AuthKeyCascader: NInputStub,
        HelpInfo: true,
        NovaIcon: true,
      },
    },
  })
}

function command(wrapper: ReturnType<typeof mountDeployView>) {
  return wrapper.get('[data-testid="command-text"]').text()
}

async function setBoolean(wrapper: ReturnType<typeof mountDeployView>, testId: string, value: 'unset' | 'true' | 'false') {
  await wrapper.get(`[data-testid="${testId}"] select`).setValue(value)
  await nextTick()
}

describe('常规部署参数', () => {
  beforeEach(() => {
    local.set('serverUrl', 'https://headscale.example.com')
    mocks.fetchRouteList.mockResolvedValue({
      isSuccess: true,
      data: { routes: [] },
    })
  })

  it('将 Accept DNS 显式关闭写入命令', async () => {
    const wrapper = mountDeployView()

    await setBoolean(wrapper, 'accept-dns', 'false')

    expect(command(wrapper)).toContain('--accept-dns=false')
  })

  it('显示新增的常用部署参数', () => {
    const wrapper = mountDeployView()

    expect(wrapper.text()).toContain('Netfilter Mode')
    expect(wrapper.text()).toContain('Report Posture')
    expect(wrapper.text()).toContain('SNAT Subnet Routes')
    expect(wrapper.text()).toContain('Stateful Filtering')
    expect(wrapper.text()).toContain('JSON Output')
  })

  it.each([
    ['advertise-tags-enable', '--advertise-tags='],
    ['advertise-routes-enable', '--advertise-routes='],
    ['exit-node-enable', '--exit-node='],
  ])('启用可清空参数 %s 时保留显式空值', async (testId, expected) => {
    const wrapper = mountDeployView()

    await wrapper.get(`[data-testid="${testId}"]`).setValue(true)

    expect(command(wrapper)).toContain(expected)
  })

  it('仅在 QR 启用时写入默认 qr-format', async () => {
    const wrapper = mountDeployView()

    expect(command(wrapper)).not.toContain('--qr-format')

    await setBoolean(wrapper, 'qr', 'true')
    expect(command(wrapper)).toContain('--qr-format=auto')

    await setBoolean(wrapper, 'qr', 'false')
    expect(command(wrapper)).not.toContain('--qr-format')
  })

  it('普通字符串参数启用但为空时提示必填且不进入命令', async () => {
    const wrapper = mountDeployView()

    await wrapper.get('[data-testid="hostname-enable"]').setValue(true)

    expect(command(wrapper)).not.toContain('--hostname=')
    expect(wrapper.get('[data-testid="hostname-input"]').attributes('data-status')).toBe('error')
    expect(wrapper.get('[data-testid="hostname-error"]').text()).toBe('app.deployOptions.valueRequired')
  })

  it('将新增字符串和 Boolean 参数按三态组合写入命令', async () => {
    const wrapper = mountDeployView()

    await wrapper.get('[data-testid="netfilter-mode-enable"]').setValue(true)
    await wrapper.get('[data-testid="netfilter-mode-select"]').setValue('nodivert')
    await setBoolean(wrapper, 'report-posture', 'true')
    await setBoolean(wrapper, 'snat-subnet-routes', 'false')
    await setBoolean(wrapper, 'stateful-filtering', 'true')
    await setBoolean(wrapper, 'json', 'false')

    expect(command(wrapper)).toContain('--netfilter-mode=nodivert')
    expect(command(wrapper)).toContain('--report-posture')
    expect(command(wrapper)).toContain('--snat-subnet-routes=false')
    expect(command(wrapper)).toContain('--stateful-filtering')
    expect(command(wrapper)).toContain('--json=false')
  })
})
