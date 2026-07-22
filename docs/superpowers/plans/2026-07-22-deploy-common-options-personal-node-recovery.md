# 部署常用参数与个人节点恢复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完善部署页对常用 `tailscale up` 参数的精确表达，并增加安全、可复制的个人节点恢复场景。

**Architecture:** 把 Shell 命令序列化提取到无 UI 依赖的纯函数，将 Boolean 参数统一交给可复用的三态控件，部署页只维护常规部署与个人节点恢复两套独立状态。恢复场景不调用 Headscale API，仅生成官方重新认证命令并呈现断连和重置风险。

**Tech Stack:** Vue 3、TypeScript、Naive UI、Vue I18n、Vitest、Vue Test Utils、ESLint

---

## 文件结构

- 创建 `src/views/deploy/command.ts`：定义参数类型、Shell 值转义、普通命令与恢复命令生成函数。
- 创建 `src/views/deploy/BooleanOption.vue`：封装“未指定 / 启用 / 禁用”三态控件。
- 修改 `src/views/deploy/index.vue`：管理场景、参数状态、条件参数、风险提示和复制结果。
- 修改 `locales/zh_CN.json`：增加场景、三态、新参数和风险提示中文文案，并修正旧默认值。
- 修改 `locales/en_US.json`：保持英文文案键与中文完全对齐。
- 创建 `tests/deploy-command.test.ts`：验证参数序列化、空值、转义、顺序和恢复命令。
- 创建 `tests/deploy-boolean-option.test.ts`：验证三态控件的值映射。
- 创建 `tests/deploy-view.test.ts`：验证场景隔离、条件参数、新参数和风险提示。

### Task 1: 建立命令生成纯函数

**Files:**
- Create: `src/views/deploy/command.ts`
- Test: `tests/deploy-command.test.ts`

- [ ] **Step 1: 编写失败的命令生成测试**

创建 `tests/deploy-command.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import {
  buildPersonalNodeRecoveryCommand,
  buildTailscaleUpCommand,
} from '@/views/deploy/command'

describe('tailscale up 命令生成', () => {
  it('按传入顺序生成 Boolean 和字符串参数', () => {
    expect(buildTailscaleUpCommand('https://headscale.example.com', [
      { name: '--reset', value: true },
      { name: '--accept-dns', value: false },
      { name: '--hostname', value: 'workstation' },
    ])).toBe(
      'tailscale up --login-server=https://headscale.example.com --reset --accept-dns=false --hostname=workstation',
    )
  })

  it('保留可清空参数的显式空值', () => {
    expect(buildTailscaleUpCommand('https://headscale.example.com', [
      { name: '--advertise-tags', value: '' },
      { name: '--advertise-routes', value: '' },
      { name: '--exit-node', value: '' },
    ])).toBe(
      'tailscale up --login-server=https://headscale.example.com --advertise-routes= --exit-node=',
    )
  })

  it('对 Shell 特殊字符和单引号执行安全转义', () => {
    expect(buildTailscaleUpCommand('https://hs.example.com/base path', [
      { name: '--hostname', value: "worker's host" },
    ])).toBe(
      `tailscale up --login-server='https://hs.example.com/base path' --hostname='worker'"'"'s host'`,
    )
  })

  it('生成默认个人节点恢复命令且不重置其他设置', () => {
    expect(buildPersonalNodeRecoveryCommand('https://headscale.example.com')).toBe(
      'tailscale up --login-server=https://headscale.example.com --force-reauth',
    )
  })

  it('仅在用户明确选择时给恢复命令添加 reset', () => {
    expect(buildPersonalNodeRecoveryCommand('https://headscale.example.com', true)).toBe(
      'tailscale up --login-server=https://headscale.example.com --force-reauth --reset',
    )
  })
})
```

- [ ] **Step 2: 运行测试并确认按预期失败**

Run: `npm test -- tests/deploy-command.test.ts`

Expected: FAIL，提示无法解析 `@/views/deploy/command`。

- [ ] **Step 3: 实现最小命令生成器**

创建 `src/views/deploy/command.ts`：

```ts
export interface TailscaleUpOption {
  name: `--${string}`
  value: boolean | string
}

function quoteShellValue(value: string): string {
  if (value === '')
    return ''

  if (/^[A-Za-z0-9_./:@%+,=-]+$/.test(value))
    return value

  return `'${value.replace(/'/g, `'"'"'`)}'`
}

function serializeOption(option: TailscaleUpOption): string {
  if (typeof option.value === 'boolean')
    return option.value ? option.name : `${option.name}=false`

  return `${option.name}=${quoteShellValue(option.value)}`
}

export function buildTailscaleUpCommand(
  serverUrl: string,
  options: TailscaleUpOption[],
): string {
  return [
    'tailscale up',
    `--login-server=${quoteShellValue(serverUrl)}`,
    ...options.map(serializeOption),
  ].join(' ')
}

export function buildPersonalNodeRecoveryCommand(
  serverUrl: string,
  reset = false,
): string {
  const options: TailscaleUpOption[] = [
    { name: '--advertise-tags', value: '' },
    { name: '--force-reauth', value: true },
  ]

  if (reset)
    options.push({ name: '--reset', value: true })

  return buildTailscaleUpCommand(serverUrl, options)
}
```

- [ ] **Step 4: 运行测试并确认通过**

Run: `npm test -- tests/deploy-command.test.ts`

Expected: PASS，5 个测试全部通过。

- [ ] **Step 5: 提交命令生成器**

```bash
git add src/views/deploy/command.ts tests/deploy-command.test.ts
git commit -m "feat: 添加 Tailscale 命令生成器"
```

### Task 2: 增加 Boolean 三态控件

**Files:**
- Create: `src/views/deploy/BooleanOption.vue`
- Test: `tests/deploy-boolean-option.test.ts`

- [ ] **Step 1: 编写失败的三态控件测试**

创建 `tests/deploy-boolean-option.test.ts`：

```ts
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import BooleanOption from '@/views/deploy/BooleanOption.vue'

const NSelectStub = {
  props: ['value', 'options'],
  emits: ['update:value'],
  template: '<button data-testid="state" @click="$emit(\'update:value\', false)">{{ value }}</button>',
}

describe('BooleanOption', () => {
  it('提供未指定、启用和禁用三个选项', () => {
    const wrapper = mount(BooleanOption, {
      props: { label: 'Accept DNS', modelValue: null },
      global: { stubs: { NSelect: NSelectStub } },
    })

    const options = wrapper.getComponent(NSelectStub).props('options')
    expect(options.map((item: { value: unknown }) => item.value)).toEqual([null, true, false])
  })

  it('把选择结果发送给父组件', async () => {
    const wrapper = mount(BooleanOption, {
      props: { label: 'Accept DNS', modelValue: null },
      global: { stubs: { NSelect: NSelectStub } },
    })

    await wrapper.get('[data-testid="state"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })
})
```

- [ ] **Step 2: 运行测试并确认按预期失败**

Run: `npm test -- tests/deploy-boolean-option.test.ts`

Expected: FAIL，提示无法解析 `BooleanOption.vue`。

- [ ] **Step 3: 实现三态控件**

创建 `src/views/deploy/BooleanOption.vue`：

```vue
<script setup lang="ts">
defineProps<{
  label: string
  help?: string
  modelValue: boolean | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean | null]
}>()

const { t } = useI18n()

const stateOptions = computed(() => [
  { label: t('app.deployOptions.unspecified'), value: null },
  { label: t('common.enable'), value: true },
  { label: t('common.disable'), value: false },
])
</script>

<template>
  <n-flex vertical>
    <div class="option-command">
      {{ label }}
      <div v-if="help" class="help-footnote">
        <help-info :message="help" />
      </div>
    </div>
    <n-select
      :value="modelValue"
      :options="stateOptions"
      @update:value="emit('update:modelValue', $event)"
    />
  </n-flex>
</template>

<style scoped>
.option-command {
  display: flex;
  flex-flow: wrap;
}
</style>
```

- [ ] **Step 4: 在测试中提供 I18n stub 并确认通过**

在测试的两个 `mount` 配置中加入：

```ts
global: {
  mocks: { $t: (key: string) => key },
  stubs: { NSelect: NSelectStub },
},
```

并在测试文件顶部加入：

```ts
import { vi } from 'vitest'

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})
```

Run: `npm test -- tests/deploy-boolean-option.test.ts`

Expected: PASS，2 个测试全部通过。

- [ ] **Step 5: 提交三态控件**

```bash
git add src/views/deploy/BooleanOption.vue tests/deploy-boolean-option.test.ts
git commit -m "feat: 添加部署参数三态控件"
```

### Task 3: 用结构化状态接管常规部署命令

**Files:**
- Modify: `src/views/deploy/index.vue:1-180`
- Modify: `src/views/deploy/index.vue:214-443`
- Test: `tests/deploy-view.test.ts`

- [ ] **Step 1: 编写失败的常规部署组件测试**

创建 `tests/deploy-view.test.ts` 的基础挂载和首组断言：

```ts
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Deploy from '@/views/deploy/index.vue'
import { local } from '@/utils/storage'

const mocks = vi.hoisted(() => ({
  copy: vi.fn().mockResolvedValue(undefined),
  fetchRouteList: vi.fn().mockResolvedValue({ isSuccess: true, data: { routes: [] } }),
}))

vi.mock('@vueuse/core', () => ({ useClipboard: () => ({ copy: mocks.copy }) }))
vi.mock('@/service', () => ({ fetchRouteList: mocks.fetchRouteList }))
vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>()
  return { ...actual, useI18n: () => ({ t: (key: string) => key }) }
})

const BooleanOptionStub = {
  props: ['modelValue', 'label'],
  emits: ['update:modelValue'],
  template: '<button class="boolean-option" :data-label="label" @click="$emit(\'update:modelValue\', false)">{{ label }}</button>',
}

function mountDeploy() {
  return mount(Deploy, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        BooleanOption: BooleanOptionStub,
        AuthKeyCascader: true,
        HelpInfo: true,
        NovaIcon: true,
        NAlert: { template: '<div class="alert"><slot /></div>' },
        NButton: { template: '<button @click="$emit(\'click\')"><slot /></button>' },
        NCard: { template: '<section><slot /></section>' },
        NCode: { props: ['code'], template: '<pre data-testid="command">{{ code }}</pre>' },
        NDynamicTags: true,
        NFlex: { template: '<div><slot /></div>' },
        NGi: { template: '<div><slot /></div>' },
        NGrid: { template: '<div><slot /></div>' },
        NInput: true,
        NRadioButton: { template: '<button><slot /></button>' },
        NRadioGroup: { template: '<div><slot /></div>' },
        NSelect: true,
        NSpace: { template: '<div><slot /></div>' },
        NSwitch: true,
      },
    },
  })
}

describe('部署页', () => {
  beforeEach(() => {
    local.set('serverUrl', 'https://headscale.example.com')
  })

  it('支持显式关闭 Boolean 参数', async () => {
    const wrapper = mountDeploy()
    await wrapper.get('[data-label="Accept DNS"]').trigger('click')
    expect(wrapper.get('[data-testid="command"]').text()).toContain('--accept-dns=false')
  })

  it('提供常用新版参数', () => {
    const text = mountDeploy().text()
    expect(text).toContain('Netfilter Mode')
    expect(text).toContain('Report Posture')
    expect(text).toContain('SNAT Subnet Routes')
    expect(text).toContain('Stateful Filtering')
  })
})
```

- [ ] **Step 2: 运行组件测试并确认失败**

Run: `npm test -- tests/deploy-view.test.ts`

Expected: FAIL，页面仍使用 Checkbox，且没有新增参数。

- [ ] **Step 3: 重构脚本状态和 computed 命令**

在 `src/views/deploy/index.vue` 中：

1. 导入 `BooleanOption.vue`、命令生成函数和类型。
2. 删除 `code`、`options`、`renderCodeText` 及所有只为手动刷新命令存在的 update handler。
3. 增加以下状态和计算逻辑：

```ts
import type { TailscaleUpOption } from './command'
import BooleanOption from './BooleanOption.vue'
import {
  buildPersonalNodeRecoveryCommand,
  buildTailscaleUpCommand,
} from './command'

type Scenario = 'deploy' | 'recover'
type BooleanOptionName =
  | 'reset'
  | 'shieldsUp'
  | 'qr'
  | 'forceReauth'
  | 'ssh'
  | 'acceptDns'
  | 'acceptRoutes'
  | 'exitNodeAllowLanAccess'
  | 'advertiseConnector'
  | 'advertiseExitNode'
  | 'reportPosture'
  | 'snatSubnetRoutes'
  | 'statefulFiltering'
  | 'json'

const scenario = ref<Scenario>('deploy')
const recoveryReset = ref(false)

const booleanValues = reactive<Record<BooleanOptionName, boolean | null>>({
  reset: true,
  shieldsUp: null,
  qr: null,
  forceReauth: null,
  ssh: null,
  acceptDns: true,
  acceptRoutes: true,
  exitNodeAllowLanAccess: null,
  advertiseConnector: null,
  advertiseExitNode: null,
  reportPosture: null,
  snatSubnetRoutes: null,
  statefulFiltering: null,
  json: null,
})

const enabledValues = reactive({
  operator: false,
  authKey: false,
  hostname: false,
  timeout: false,
  acceptRisk: false,
  exitNode: false,
  advertiseTags: false,
  advertiseRoutes: false,
  netfilterMode: false,
})

const operator = ref('')
const hostname = ref('')
const timeout = ref('')
const authKey = ref('')
const acceptRisk = ref('')
const exitNode = ref('')
const netfilterMode = ref<'on' | 'nodivert' | 'off'>('on')
const qrFormat = ref<'auto' | 'ascii' | 'large' | 'small'>('auto')

function appendBoolean(
  result: TailscaleUpOption[],
  name: TailscaleUpOption['name'],
  value: boolean | null,
) {
  if (value !== null)
    result.push({ name, value })
}

const deployOptions = computed<TailscaleUpOption[]>(() => {
  const result: TailscaleUpOption[] = []
  appendBoolean(result, '--reset', booleanValues.reset)
  appendBoolean(result, '--shields-up', booleanValues.shieldsUp)
  appendBoolean(result, '--qr', booleanValues.qr)
  if (booleanValues.qr === true)
    result.push({ name: '--qr-format', value: qrFormat.value })
  appendBoolean(result, '--force-reauth', booleanValues.forceReauth)
  appendBoolean(result, '--ssh', booleanValues.ssh)
  if (enabledValues.operator && operator.value)
    result.push({ name: '--operator', value: operator.value })
  if (enabledValues.authKey && authKey.value)
    result.push({ name: '--auth-key', value: authKey.value })
  if (enabledValues.hostname && hostname.value)
    result.push({ name: '--hostname', value: hostname.value })
  if (enabledValues.timeout && timeout.value)
    result.push({ name: '--timeout', value: timeout.value })
  appendBoolean(result, '--accept-dns', booleanValues.acceptDns)
  appendBoolean(result, '--accept-routes', booleanValues.acceptRoutes)
  if (enabledValues.acceptRisk && acceptRisk.value)
    result.push({ name: '--accept-risk', value: acceptRisk.value })
  if (enabledValues.exitNode)
    result.push({ name: '--exit-node', value: exitNode.value })
  if (enabledValues.exitNode && exitNode.value)
    appendBoolean(result, '--exit-node-allow-lan-access', booleanValues.exitNodeAllowLanAccess)
  appendBoolean(result, '--advertise-connector', booleanValues.advertiseConnector)
  appendBoolean(result, '--advertise-exit-node', booleanValues.advertiseExitNode)
  if (enabledValues.advertiseTags)
    result.push({ name: '--advertise-tags', value: advertiseTagsValues.value })
  if (enabledValues.advertiseRoutes)
    result.push({ name: '--advertise-routes', value: advertiseRoutesValues.value })
  if (enabledValues.netfilterMode)
    result.push({ name: '--netfilter-mode', value: netfilterMode.value })
  appendBoolean(result, '--report-posture', booleanValues.reportPosture)
  appendBoolean(result, '--snat-subnet-routes', booleanValues.snatSubnetRoutes)
  appendBoolean(result, '--stateful-filtering', booleanValues.statefulFiltering)
  appendBoolean(result, '--json', booleanValues.json)
  return result
})

const code = computed(() => scenario.value === 'recover'
  ? buildPersonalNodeRecoveryCommand(serverUrl.value, recoveryReset.value)
  : buildTailscaleUpCommand(serverUrl.value, deployOptions.value))
```

`serverUrl` 必须在脚本中初始化为：

```ts
const serverUrl = ref(local.get('serverUrl') ?? '')
```

- [ ] **Step 4: 把现有 Boolean Checkbox 替换为三态控件并加入常用参数**

在常规部署模板中把 `n-checkbox-group` 替换为普通容器，并按现有 General、Accept、Advertise 分组使用：

```vue
<BooleanOption v-model="booleanValues.shieldsUp" label="Shields Up" :help="t('app.shieldsUp')" />
<BooleanOption v-model="booleanValues.qr" label="Generate QR Code" :help="t('app.qr')" />
<BooleanOption v-model="booleanValues.reset" label="Reset" :help="t('app.rest')" />
<BooleanOption v-model="booleanValues.forceReauth" label="Force Reauthentication" :help="t('app.forceReauth')" />
<BooleanOption v-model="booleanValues.ssh" label="SSH Server" :help="t('app.ssh')" />
<BooleanOption v-model="booleanValues.acceptDns" label="Accept DNS" :help="t('app.acceptDns')" />
<BooleanOption v-model="booleanValues.acceptRoutes" label="Accept Routes" :help="t('app.acceptRoutes')" />
<BooleanOption v-model="booleanValues.advertiseConnector" label="Advertise Connector" :help="t('app.advertiseConnector')" />
<BooleanOption v-model="booleanValues.advertiseExitNode" label="Advertise Exit Node" :help="t('app.advertiseExitNode')" />
<BooleanOption v-model="booleanValues.reportPosture" label="Report Posture" :help="t('app.deployOptions.reportPosture')" />
<BooleanOption v-model="booleanValues.snatSubnetRoutes" label="SNAT Subnet Routes" :help="t('app.deployOptions.snatSubnetRoutes')" />
<BooleanOption v-model="booleanValues.statefulFiltering" label="Stateful Filtering" :help="t('app.deployOptions.statefulFiltering')" />
<BooleanOption v-model="booleanValues.json" label="JSON Output" :help="t('app.deployOptions.json')" />
```

保留现有字符串输入和动态标签控件，但把 Checkbox 的 `v-model` 改为对应的 `enabledValues`。加入：

```vue
<n-select
  v-if="booleanValues.qr === true"
  v-model:value="qrFormat"
  :options="qrFormatOptions"
/>

<n-checkbox v-model:checked="enabledValues.netfilterMode">
  Netfilter Mode
</n-checkbox>
<n-select
  v-if="enabledValues.netfilterMode"
  v-model:value="netfilterMode"
  :options="netfilterModeOptions"
/>
```

并定义固定候选值：

```ts
const netfilterModeOptions = ['on', 'nodivert', 'off'].map(value => ({ label: value, value }))
const qrFormatOptions = ['auto', 'ascii', 'large', 'small'].map(value => ({ label: value, value }))
```

依赖项关闭时清理条件状态，避免再次启用时恢复已经失效的旧值：

```ts
watch(() => booleanValues.qr, (enabled) => {
  if (enabled !== true)
    qrFormat.value = 'auto'
})

watch([() => enabledValues.exitNode, exitNode], ([enabled, node]) => {
  if (!enabled || !node)
    booleanValues.exitNodeAllowLanAccess = null
})
```

命令预览卡片增加稳定测试标识：

```vue
<n-card
  data-testid="command-card"
  size="small"
  hoverable
  embedded
  style="cursor: pointer"
  @click="copyCode"
>
  <n-code :code="code" language="shell" class="code" word-wrap />
</n-card>
```

普通字符串控件启用但没有值时显示错误且不进入命令。`operator`、`hostname`、`timeout`、`authKey` 和 `acceptRisk` 均应用该模式；例如：

```vue
<n-input
  v-if="enabledValues.hostname"
  v-model:value="hostname"
  :status="!hostname ? 'error' : undefined"
/>
<n-text v-if="enabledValues.hostname && !hostname" type="error">
  {{ t('app.deployOptions.valueRequired') }}
</n-text>
```

- [ ] **Step 5: 运行常规部署组件测试并确认通过**

Run: `npm test -- tests/deploy-view.test.ts`

Expected: PASS，2 个测试全部通过。

- [ ] **Step 6: 提交常规部署重构**

```bash
git add src/views/deploy/index.vue tests/deploy-view.test.ts
git commit -m "feat: 完善常用 Tailscale 部署参数"
```

### Task 4: 增加个人节点恢复场景

**Files:**
- Modify: `src/views/deploy/index.vue`
- Modify: `tests/deploy-view.test.ts`

- [ ] **Step 1: 编写失败的恢复场景组件测试**

在 `tests/deploy-view.test.ts` 增加：

```ts
it('恢复场景生成清空标签和强制认证命令', async () => {
  const wrapper = mountDeploy()
  await wrapper.get('[data-testid="scenario-recover"]').trigger('click')

  expect(wrapper.get('[data-testid="command"]').text()).toBe(
    'tailscale up --login-server=https://headscale.example.com --force-reauth',
  )
  expect(wrapper.text()).toContain('app.deployRecovery.disconnectWarning')
  expect(wrapper.text()).toContain('app.deployRecovery.loginAsPersonalUser')
})

it('恢复场景只有明确选择后才加入 reset', async () => {
  const wrapper = mountDeploy()
  await wrapper.get('[data-testid="scenario-recover"]').trigger('click')
  expect(wrapper.get('[data-testid="command"]').text()).not.toContain('--reset')

  await wrapper.get('[data-testid="recovery-reset"]').trigger('click')
  expect(wrapper.get('[data-testid="command"]').text()).toContain('--reset')
  expect(wrapper.text()).toContain('app.deployRecovery.resetWarning')
})

it('切换场景不会污染常规部署状态', async () => {
  const wrapper = mountDeploy()
  const deployCommand = wrapper.get('[data-testid="command"]').text()
  await wrapper.get('[data-testid="scenario-recover"]').trigger('click')
  await wrapper.get('[data-testid="scenario-deploy"]').trigger('click')
  expect(wrapper.get('[data-testid="command"]').text()).toBe(deployCommand)
})
```

- [ ] **Step 2: 运行恢复场景测试并确认失败**

Run: `npm test -- tests/deploy-view.test.ts`

Expected: FAIL，找不到恢复场景和 reset 控件。

- [ ] **Step 3: 添加场景选择和恢复说明**

在命令预览之前加入场景选择：

```vue
<n-radio-group v-model:value="scenario" name="deploy-scenario">
  <n-radio-button
    value="deploy"
    data-testid="scenario-deploy"
    @click="scenario = 'deploy'"
  >
    {{ t('app.deployScenario.deploy') }}
  </n-radio-button>
  <n-radio-button
    value="recover"
    data-testid="scenario-recover"
    @click="scenario = 'recover'"
  >
    {{ t('app.deployScenario.recover') }}
  </n-radio-button>
</n-radio-group>
```

把常规参数卡片包在 `v-if="scenario === 'deploy'"` 中，并增加恢复卡片：

```vue
<n-card v-else>
  <n-space vertical>
    <n-alert type="warning" :title="t('app.deployRecovery.disconnectTitle')">
      {{ t('app.deployRecovery.disconnectWarning') }}
    </n-alert>
    <p>{{ t('app.deployRecovery.clearTags') }}</p>
    <p>{{ t('app.deployRecovery.loginAsPersonalUser') }}</p>
    <p>{{ t('app.deployRecovery.verifyOwner') }}</p>
    <n-checkbox
      v-model:checked="recoveryReset"
      data-testid="recovery-reset"
    >
      {{ t('app.deployRecovery.resetOtherSettings') }}
    </n-checkbox>
    <n-alert v-if="recoveryReset" type="error">
      {{ t('app.deployRecovery.resetWarning') }}
    </n-alert>
  </n-space>
</n-card>
```

测试中的 `NCheckbox` stub 使用：

```ts
NCheckbox: {
  props: ['checked'],
  emits: ['update:checked'],
  template: '<button v-bind="$attrs" @click="$emit(\'update:checked\', !checked)"><slot /></button>',
},
```

测试中的 `NRadioButton` stub 使用：

```ts
NRadioButton: {
  props: ['value'],
  template: '<button v-bind="$attrs"><slot /></button>',
},
```

- [ ] **Step 4: 运行恢复场景测试并确认通过**

Run: `npm test -- tests/deploy-view.test.ts`

Expected: PASS，恢复场景相关 3 个测试通过，文件内全部 5 个测试通过。

- [ ] **Step 5: 提交恢复场景**

```bash
git add src/views/deploy/index.vue tests/deploy-view.test.ts
git commit -m "feat: 添加个人节点恢复场景"
```

### Task 5: 完善双语文案与条件行为

**Files:**
- Modify: `locales/zh_CN.json:80-125`
- Modify: `locales/en_US.json:80-125`
- Modify: `src/views/deploy/index.vue`
- Modify: `tests/deploy-view.test.ts`

- [ ] **Step 1: 编写失败的条件参数和文案测试**

在 `tests/deploy-view.test.ts` 增加：

```ts
it('accept-risk 包含 mac-app-connector', () => {
  const wrapper = mountDeploy()
  const options = wrapper.vm.acceptRiskOptions as Array<{ value: string }>
  expect(options.map(option => option.value)).toEqual([
    'lose-ssh',
    'mac-app-connector',
    'all',
  ])
})

it('qr-format 仅在 QR 启用时进入命令', async () => {
  const wrapper = mountDeploy()
  expect(wrapper.get('[data-testid="command"]').text()).not.toContain('--qr-format')

  wrapper.vm.booleanValues.qr = true
  await wrapper.vm.$nextTick()
  expect(wrapper.get('[data-testid="command"]').text()).toContain('--qr-format=auto')

  wrapper.vm.booleanValues.qr = null
  await wrapper.vm.$nextTick()
  expect(wrapper.get('[data-testid="command"]').text()).not.toContain('--qr-format')
})

it('剪贴板失败时显示错误而不是成功消息', async () => {
  mocks.copy.mockRejectedValueOnce(new Error('clipboard denied'))
  const success = vi.fn()
  const error = vi.fn()
  window.$message = { success, error } as typeof window.$message
  const wrapper = mountDeploy()

  await wrapper.get('[data-testid="command-card"]').trigger('click')

  expect(error).toHaveBeenCalledWith('components.copyText.failed')
  expect(success).not.toHaveBeenCalled()
})
```

为使测试只读取明确的公共测试接口，在 `script setup` 增加：

```ts
defineExpose({ acceptRiskOptions, booleanValues })
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- tests/deploy-view.test.ts`

Expected: FAIL，`acceptRiskOptions` 缺少 `mac-app-connector`，或条件 QR 参数尚未接好。

- [ ] **Step 3: 增加并修正双语文案**

在两个 locale 文件的 `app` 下增加结构相同的键。中文值：

```json
"deployScenario": {
  "deploy": "常规部署",
  "recover": "恢复个人节点"
},
"deployOptions": {
  "unspecified": "未指定",
  "valueRequired": "启用该参数后必须填写参数值",
  "netfilterMode": "Netfilter 模式：on、nodivert 或 off",
  "reportPosture": "允许管理面收集设备 posture 信息（默认值为 false）",
  "snatSubnetRoutes": "对本机广告的子网路由执行源地址转换（默认值为 true）",
  "statefulFiltering": "对转发流量应用有状态过滤（默认值为 false）",
  "json": "以 JSON 格式输出结果",
  "qrFormat": "二维码格式：auto、ascii、large 或 small"
},
"deployRecovery": {
  "disconnectTitle": "重新认证可能断开远程连接",
  "disconnectWarning": "不要在唯一的 Tailscale SSH 或 RDP 管理链路中直接执行此命令。",
  "clearTags": "使用 --force-reauth 重新认证。",
  "loginAsPersonalUser": "浏览器打开后，请登录节点应归属的个人用户。",
  "verifyOwner": "完成后请确认节点所有者不再是 tagged-devices，并且标签为空。",
  "resetOtherSettings": "重置其他未声明设置",
  "resetWarning": "--reset 会把未声明设置恢复默认值，可能影响 DNS、路由、SSH、出口节点和防火墙行为。"
}
```

英文值：

```json
"deployScenario": {
  "deploy": "Standard deployment",
  "recover": "Restore personal node"
},
"deployOptions": {
  "unspecified": "Unspecified",
  "valueRequired": "A value is required when this option is enabled",
  "netfilterMode": "Netfilter mode: on, nodivert, or off",
  "reportPosture": "Allow the control plane to collect device posture information (default false)",
  "snatSubnetRoutes": "Source NAT traffic for locally advertised subnet routes (default true)",
  "statefulFiltering": "Apply stateful filtering to forwarded traffic (default false)",
  "json": "Output the result as JSON",
  "qrFormat": "QR code format: auto, ascii, large, or small"
},
"deployRecovery": {
  "disconnectTitle": "Reauthentication may disconnect remote access",
  "disconnectWarning": "Do not run this over your only Tailscale SSH or RDP management path.",
  "clearTags": "The command clears requested tags with --advertise-tags= and reauthenticates with --force-reauth.",
  "loginAsPersonalUser": "When the browser opens, sign in as the personal user that should own the node.",
  "verifyOwner": "After completion, verify that the owner is no longer tagged-devices and that tags are empty.",
  "resetOtherSettings": "Reset other unspecified settings",
  "resetWarning": "--reset restores unspecified settings to defaults and may affect DNS, routes, SSH, exit nodes, and firewall behavior."
}
```

同时修改现有键：

```json
"acceptRisk": "接受风险并跳过确认：lose-ssh、mac-app-connector、all",
"acceptRoutes": "接受其他 Tailscale 节点广告的路由（默认值为 false）"
```

英文对应修改为：

```json
"acceptRisk": "accept risk and skip confirmation for: lose-ssh, mac-app-connector, all",
"acceptRoutes": "accept routes advertised by other Tailscale nodes (default false)"
```

- [ ] **Step 4: 补全 accept-risk 候选值和复制失败处理**

候选值使用：

```ts
const acceptRiskOptions = [
  { label: t('app.acceptRiskOptions.lose-ssh'), value: 'lose-ssh' },
  { label: t('app.acceptRiskOptions.mac-app-connector'), value: 'mac-app-connector' },
  { label: t('app.acceptRiskOptions.all'), value: 'all' },
]
```

两个 locale 文件的 `acceptRiskOptions` 同时增加 `mac-app-connector` 键。把复制函数改为：

```ts
async function copyCode() {
  try {
    await copy(code.value)
    window.$message.success(t('components.copyText.message'))
  }
  catch {
    window.$message.error(t('components.copyText.failed'))
  }
}
```

并为两个 locale 文件增加 `components.copyText.failed`：中文为“复制失败”，英文为“Copy failed”。

- [ ] **Step 5: 运行部署页全部测试并确认通过**

Run: `npm test -- tests/deploy-command.test.ts tests/deploy-boolean-option.test.ts tests/deploy-view.test.ts`

Expected: PASS，三个测试文件全部通过。

- [ ] **Step 6: 提交文案和条件行为**

```bash
git add locales/zh_CN.json locales/en_US.json src/views/deploy/index.vue tests/deploy-view.test.ts
git commit -m "feat: 完善部署场景提示与参数文案"
```

### Task 6: 完整验证与文档核对

**Files:**
- Modify only if verification finds an in-scope defect.

- [ ] **Step 1: 运行格式和类型检查**

Run: `npm run lint`

Expected: PASS，无 ESLint 或 TypeScript 错误。

- [ ] **Step 2: 运行完整测试套件**

Run: `npm test`

Expected: PASS，全部 Vitest 测试通过。

- [ ] **Step 3: 运行生产构建**

Run: `npm run build`

Expected: PASS，`vue-tsc --noEmit` 和 Vite production build 均成功。

- [ ] **Step 4: 人工核对关键命令**

在部署页依次确认：

```text
常规部署：Boolean 禁用值生成 --name=false
清空标签：选中 Advertise Tags 且不添加标签时生成 --advertise-tags=
恢复节点：生成 --advertise-tags= --force-reauth，默认没有 --reset
恢复并重置：明确启用后才生成 --reset，并显示风险提示
二维码：仅 QR=true 时生成 --qr-format=<value>
```

Expected: 五项均符合设计文档。

- [ ] **Step 5: 检查最终差异**

Run: `git diff --check && git status --short`

Expected: `git diff --check` 无输出；`git status --short` 只显示本计划范围内尚未提交的文件，正常情况下为空。

- [ ] **Step 6: 如验证阶段产生修复则单独提交**

仅当 Step 1-5 发现并修复本功能范围内缺陷时执行：

```bash
git add src/views/deploy locales tests
git commit -m "fix: 修正部署参数生成回归问题"
```

若没有产生修改，跳过该提交，不创建空提交。
