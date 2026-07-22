import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import BooleanOption from '@/views/deploy/BooleanOption.vue'

enableAutoUnmount(afterEach)

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  }
})

const NSelectStub = defineComponent({
  name: 'NSelect',
  props: {
    value: { type: String, required: true },
    options: { type: Array, required: true },
  },
  emits: ['update:value'],
  template: '<button data-testid="boolean-select" />',
})

const HelpInfoStub = defineComponent({
  name: 'HelpInfo',
  props: {
    message: { type: String, required: true },
  },
  template: '<span data-testid="help-info" />',
})

function mountBooleanOption(modelValue: boolean | null, help?: string) {
  return mount(BooleanOption, {
    props: {
      label: '测试选项',
      help,
      modelValue,
    },
    global: {
      stubs: {
        Select: NSelectStub,
        HelpInfo: HelpInfoStub,
      },
    },
  })
}

describe('部署参数三态控件', () => {
  it('向下拉框提供字符串状态和国际化标签', () => {
    const wrapper = mountBooleanOption(null)
    const options = wrapper.getComponent(NSelectStub).props('options') as Array<{
      label: string
      value: string
    }>

    expect(options.map(option => option.value)).toEqual(['unset', 'true', 'false'])
    expect(options.map(option => option.label)).toEqual([
      'app.deployOptions.unspecified',
      'common.enable',
      'common.disable',
    ])
  })

  it.each([
    [null, 'unset'],
    [true, 'true'],
    [false, 'false'],
  ] as const)('将对外值 %s 映射为下拉框状态 %s', (modelValue, expectedState) => {
    const wrapper = mountBooleanOption(modelValue)

    expect(wrapper.getComponent(NSelectStub).props('value')).toBe(expectedState)
  })

  it.each([
    ['unset', null],
    ['true', true],
    ['false', false],
  ] as const)('将下拉框状态 %s 映射为对外值 %s', (state, expectedValue) => {
    const wrapper = mountBooleanOption(null)

    wrapper.getComponent(NSelectStub).vm.$emit('update:value', state)

    expect(wrapper.emitted('update:modelValue')).toEqual([[expectedValue]])
  })

  it('显示标签并仅在提供帮助文本时显示帮助信息', () => {
    const withHelp = mountBooleanOption(null, '帮助文本')

    expect(withHelp.text()).toContain('测试选项')
    expect(withHelp.getComponent(HelpInfoStub).props('message')).toBe('帮助文本')

    const withoutHelp = mountBooleanOption(null)
    expect(withoutHelp.findComponent(HelpInfoStub).exists()).toBe(false)
  })
})
