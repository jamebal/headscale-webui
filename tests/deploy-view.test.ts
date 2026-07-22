import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import enUS from '../locales/en_US.json'
import zhCN from '../locales/zh_CN.json'
import DeployView from '@/views/deploy/index.vue'
import { local } from '@/utils/storage'

enableAutoUnmount(afterEach)

const mocks = vi.hoisted(() => ({
  copy: vi.fn(),
  deriveRoutes: vi.fn(),
  fetchNodeList: vi.fn(),
  isClipboardSupported: { value: true },
  messageError: vi.fn(),
  messageSuccess: vi.fn(),
}))

vi.mock('@vueuse/core', () => ({
  useClipboard: () => ({
    copy: mocks.copy,
    isSupported: mocks.isClipboardSupported,
  }),
}))

vi.mock('@/service', () => ({
  deriveRoutes: mocks.deriveRoutes,
  fetchNodeList: mocks.fetchNodeList,
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
    clearable: { type: Boolean, default: false },
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
    <button
      v-if="clearable"
      data-testid="select-clear"
      type="button"
      @click="$emit('update:value', null)"
    >
      clear
    </button>
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

const NRadioGroupStub = defineComponent({
  name: 'NRadioGroup',
  props: {
    name: { type: String, default: undefined },
  },
  template: '<div data-testid="radio-group" :data-name="name"><slot /></div>',
})

const NRadioButtonStub = defineComponent({
  name: 'NRadioButton',
  inheritAttrs: false,
  template: '<button v-bind="$attrs" type="button"><slot /></button>',
})

const NAlertStub = defineComponent({
  name: 'NAlert',
  props: {
    title: { type: String, default: '' },
  },
  template: '<div><div>{{ title }}</div><slot /></div>',
})

const HelpInfoStub = defineComponent({
  name: 'HelpInfo',
  props: {
    message: { type: String, required: true },
  },
  template: '<span>{{ message }}</span>',
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
        RadioGroup: NRadioGroupStub,
        NRadioGroup: NRadioGroupStub,
        RadioButton: NRadioButtonStub,
        NRadioButton: NRadioButtonStub,
        Alert: NAlertStub,
        NAlert: NAlertStub,
        HelpInfo: HelpInfoStub,
        NovaIcon: true,
      },
    },
  })
}

function command(wrapper: ReturnType<typeof mountDeployView>) {
  return wrapper.get('[data-testid="command-text"]').text()
}

function availableExitRoute() {
  return {
    id: 'route-1',
    node: {
      id: 'node-1',
      name: 'exit-node.example.com',
      user: { id: 'user-1', name: 'alice', createdAt: '2026-01-01T00:00:00Z' },
      ipAddresses: ['100.64.0.1'],
      routes: [],
      online: true,
      givenName: 'exit-node-1',
      validTags: [],
      invalidTags: [],
      forcedTags: [],
      registerMethod: 'authKey',
      createdAt: '2026-01-01T00:00:00Z',
      preAuthKey: '',
      expiry: '2027-01-01T00:00:00Z',
      lastSeen: '2026-01-01T00:00:00Z',
      machineKey: 'mkey:machine',
      nodeKey: 'nodekey:node',
      discoKey: 'discokey:disco',
    },
    prefix: '0.0.0.0/0',
    approved: true,
    exitRoute: true,
    advertised: true,
    enabled: true,
    isPrimary: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: '',
  }
}

async function setBoolean(wrapper: ReturnType<typeof mountDeployView>, testId: string, value: 'unset' | 'true' | 'false') {
  await wrapper.get(`[data-testid="${testId}"] select`).setValue(value)
  await nextTick()
}

describe('常规部署参数', () => {
  beforeEach(() => {
    mocks.copy.mockReset()
    mocks.copy.mockResolvedValue(undefined)
    mocks.isClipboardSupported.value = true
    mocks.messageError.mockReset()
    mocks.messageSuccess.mockReset()
    Object.defineProperty(window, '$message', {
      configurable: true,
      value: {
        error: mocks.messageError,
        success: mocks.messageSuccess,
      },
    })
    local.set('serverUrl', 'https://headscale.example.com')
    mocks.deriveRoutes.mockReset()
    mocks.deriveRoutes.mockReturnValue([])
    mocks.fetchNodeList.mockReset()
    mocks.fetchNodeList.mockResolvedValue({
      isSuccess: true,
      data: { nodes: [] },
    })
  })

  it('切换到个人节点恢复后生成去标签并重新认证的命令', async () => {
    const wrapper = mountDeployView()

    await wrapper.get('[data-testid="scenario-recover"]').trigger('click')

    expect(command(wrapper)).toBe('tailscale up --login-server=https://headscale.example.com --advertise-tags= --force-reauth')
    expect(wrapper.text()).toContain('app.deployRecovery.disconnectWarning')
    expect(wrapper.text()).toContain('app.deployRecovery.completeFlags')
    expect(wrapper.text()).toContain('app.deployRecovery.loginAsPersonalUser')
  })

  it('个人节点恢复默认不重置，勾选后增加重置参数并显示警告', async () => {
    const wrapper = mountDeployView()

    await wrapper.get('[data-testid="scenario-recover"]').trigger('click')
    expect(command(wrapper)).not.toContain('--reset')

    await wrapper.get('[data-testid="recovery-reset"]').setValue(true)

    expect(command(wrapper)).toContain('--reset')
    expect(wrapper.text()).toContain('app.deployRecovery.resetWarning')
  })

  it('恢复重置开关在场景往返后保持启用并继续显示警告', async () => {
    const wrapper = mountDeployView()

    await wrapper.get('[data-testid="scenario-recover"]').trigger('click')
    await wrapper.get('[data-testid="recovery-reset"]').setValue(true)
    await wrapper.get('[data-testid="scenario-deploy"]').trigger('click')
    await wrapper.get('[data-testid="scenario-recover"]').trigger('click')

    expect(wrapper.get('[data-testid="recovery-reset"]').element).toHaveProperty('checked', true)
    expect(wrapper.text()).toContain('app.deployRecovery.resetWarning')
  })

  it('部署场景单选组使用稳定的表单名称', () => {
    const wrapper = mountDeployView()

    expect(wrapper.get('[data-testid="radio-group"]').attributes('data-name')).toBe('deploy-scenario')
  })

  it('启用 Accept Risk 后提供全部受支持的风险值', async () => {
    const wrapper = mountDeployView()

    await wrapper.get('[data-testid="accept-risk-enable"]').setValue(true)
    const select = wrapper.findAllComponents(NSelectStub).find((candidate) => {
      const options = candidate.props('options') as Array<{ value: string }>
      return options.some(option => option.value === 'lose-ssh')
    })

    expect(select).toBeDefined()
    expect((select!.props('options') as Array<{ value: string }>).map(option => option.value)).toEqual([
      'lose-ssh',
      'mac-app-connector',
      'all',
    ])
  })

  it('复制命令成功后仅显示成功提示', async () => {
    const wrapper = mountDeployView()

    await wrapper.get('[data-testid="command-card"]').trigger('click')
    await flushPromises()

    expect(mocks.messageSuccess).toHaveBeenCalledWith('components.copyText.message')
    expect(mocks.messageError).not.toHaveBeenCalled()
  })

  it('复制命令失败后仅显示失败提示', async () => {
    mocks.copy.mockRejectedValueOnce(new Error('剪贴板不可用'))
    const wrapper = mountDeployView()

    await wrapper.get('[data-testid="command-card"]').trigger('click')
    await flushPromises()

    expect(mocks.messageError).toHaveBeenCalledWith('components.copyText.failed')
    expect(mocks.messageSuccess).not.toHaveBeenCalled()
  })

  it('剪贴板 API 不受支持时不尝试复制并仅显示失败提示', async () => {
    mocks.isClipboardSupported.value = false
    const wrapper = mountDeployView()

    await wrapper.get('[data-testid="command-card"]').trigger('click')
    await flushPromises()

    expect(mocks.copy).not.toHaveBeenCalled()
    expect(mocks.messageError).toHaveBeenCalledWith('components.copyText.failed')
    expect(mocks.messageSuccess).not.toHaveBeenCalled()
  })

  it('恢复场景的重置状态不会污染常规部署命令', async () => {
    const wrapper = mountDeployView()

    await setBoolean(wrapper, 'accept-dns', 'false')
    const deployCommand = command(wrapper)

    await wrapper.get('[data-testid="scenario-recover"]').trigger('click')
    await wrapper.get('[data-testid="recovery-reset"]').setValue(true)
    await wrapper.get('[data-testid="scenario-deploy"]').trigger('click')

    expect(command(wrapper)).toBe(deployCommand)
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

  it('为新增部署参数接入对应的国际化帮助文案', async () => {
    const wrapper = mountDeployView()

    expect(wrapper.text()).toContain('app.deployOptions.netfilterMode')
    expect(wrapper.text()).toContain('app.deployOptions.reportPosture')
    expect(wrapper.text()).toContain('app.deployOptions.snatSubnetRoutes')
    expect(wrapper.text()).toContain('app.deployOptions.statefulFiltering')
    expect(wrapper.text()).toContain('app.deployOptions.json')

    await setBoolean(wrapper, 'qr', 'true')
    expect(wrapper.text()).toContain('app.deployOptions.qrFormat')
  })

  it('中英文部署文案结构完全对齐并包含修正后的提示', () => {
    expect(Object.keys(zhCN.app.deployScenario)).toEqual(Object.keys(enUS.app.deployScenario))
    expect(Object.keys(zhCN.app.deployOptions)).toEqual(Object.keys(enUS.app.deployOptions))
    expect(Object.keys(zhCN.app.deployRecovery)).toEqual(Object.keys(enUS.app.deployRecovery))
    expect(Object.keys(zhCN.app.acceptRiskOptions)).toEqual(Object.keys(enUS.app.acceptRiskOptions))

    expect(zhCN.app.acceptRisk).toContain('mac-app-connector')
    expect(enUS.app.acceptRisk).toContain('mac-app-connector')
    expect(zhCN.app.acceptRoutes).toContain('默认值取决于操作系统')
    expect(enUS.app.acceptRoutes).toContain('default depends on the operating system')
    expect(zhCN.app.deployOptions.netfilterMode).toContain('仅 Linux')
    expect(enUS.app.deployOptions.netfilterMode).toContain('Linux only')
    expect(zhCN.app.deployOptions.snatSubnetRoutes).toContain('仅 Linux')
    expect(enUS.app.deployOptions.snatSubnetRoutes).toContain('Linux only')
    expect(zhCN.app.deployOptions.statefulFiltering).toContain('仅 Linux')
    expect(enUS.app.deployOptions.statefulFiltering).toContain('Linux only')
    expect(zhCN.components.copyText.failed).toBe('复制失败')
    expect(enUS.components.copyText.failed).toBe('Copy failed')
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
    await wrapper.get('[data-testid="hostname-input"]').setValue('   ')

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

  it('清空出口节点后保留显式空值并移除局域网访问参数', async () => {
    mocks.fetchNodeList.mockResolvedValueOnce({
      isSuccess: true,
      data: { nodes: [] },
    })
    mocks.deriveRoutes.mockReturnValueOnce([availableExitRoute()])
    const wrapper = mountDeployView()

    await wrapper.get('[data-testid="exit-node-enable"]').setValue(true)
    await flushPromises()
    await wrapper.get('[data-testid="exit-node-select"]').setValue('exit-node-1')
    await setBoolean(wrapper, 'exit-node-allow-lan-access', 'true')

    expect(command(wrapper)).toContain('--exit-node=exit-node-1')
    expect(command(wrapper)).toContain('--exit-node-allow-lan-access')

    await wrapper.get('[data-testid="select-clear"]').trigger('click')
    await nextTick()

    expect(() => command(wrapper)).not.toThrow()
    expect(command(wrapper)).toContain('--exit-node=')
    expect(command(wrapper)).not.toContain('--exit-node-allow-lan-access')
  })

  it('出口节点列表返回失败后再次启用会重试', async () => {
    mocks.fetchNodeList
      .mockResolvedValueOnce({ isSuccess: false })
      .mockResolvedValueOnce({ isSuccess: true, data: { nodes: [] } })
    const wrapper = mountDeployView()

    await wrapper.get('[data-testid="exit-node-enable"]').setValue(true)
    await flushPromises()
    await wrapper.get('[data-testid="exit-node-enable"]').setValue(false)
    await wrapper.get('[data-testid="exit-node-enable"]').setValue(true)
    await flushPromises()

    expect(mocks.fetchNodeList).toHaveBeenCalledTimes(2)
  })

  it('出口节点列表请求拒绝后再次启用会安全重试', async () => {
    mocks.fetchNodeList
      .mockRejectedValueOnce(new Error('网络异常'))
      .mockResolvedValueOnce({ isSuccess: true, data: { nodes: [] } })
    const wrapper = mountDeployView()

    await wrapper.get('[data-testid="exit-node-enable"]').setValue(true)
    await flushPromises()
    await wrapper.get('[data-testid="exit-node-enable"]').setValue(false)
    await wrapper.get('[data-testid="exit-node-enable"]').setValue(true)
    await flushPromises()

    expect(mocks.fetchNodeList).toHaveBeenCalledTimes(2)
  })
})
