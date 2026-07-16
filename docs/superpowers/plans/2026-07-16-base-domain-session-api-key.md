# Base Domain 与 Session API Key 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为单 Headscale 实例登录流程增加可选 `baseDomain`，在节点复制菜单中生成 FQDN，并将 API Key 从持久化 `localStorage` 迁移到当前 tab 的 `sessionStorage`。

**Architecture:** 保持纯静态 Vue SPA 架构。新增独立的 domain utility 和 auth storage utility，登录表单只负责采集与提交，认证 store、路由守卫和 HTTP adapter 统一通过 Session API Key helper 读取凭据；应用启动时执行幂等的旧凭据清理。

**Tech Stack:** Vue 3、TypeScript、Pinia、Alova、Naive UI、Vitest、Vue Test Utils、happy-dom

---

## 文件结构

新增文件：

- `src/utils/baseDomain.ts`：标准化、校验 `baseDomain`，并生成节点 FQDN。
- `src/utils/authStorage.ts`：封装 Session API Key、连接配置和旧 Local Storage 凭据迁移。
- `tests/setup.ts`：清理每个测试之间的 browser storage。
- `tests/base-domain.test.ts`：验证 domain 与 FQDN 规则。
- `tests/auth-storage.test.ts`：验证 Local/Session Storage 安全边界与迁移。
- `tests/auth-store.test.ts`：验证登录成功、失败和退出时的凭据生命周期。
- `tests/login-form.test.ts`：验证登录表单字段、默认回填和提交参数。
- `tests/node-copy-options.test.ts`：验证节点复制选项及顺序。

修改文件：

- `package.json`、`package-lock.json`：增加 Vitest 测试工具和 `npm test`。
- `vite.config.ts`：增加 happy-dom 测试环境配置。
- `src/utils/index.ts`：导出新增 utility。
- `src/typings/global.d.ts`：将敏感 Token 移到 `Storage.Session`，增加 `baseDomain`。
- `src/typings/api/login.d.ts`：移除不属于 Headscale user response 的 access/refresh Token 字段。
- `src/main.ts`：应用启动时清理旧 Local Storage 凭据。
- `src/service/http/alova.ts`：从 Session Storage 设置认证头，未登录时不发送空 Bearer。
- `src/router/guard.ts`：使用 Session API Key 判断认证状态。
- `src/store/auth.ts`：登录、退出和失败路径使用新的存储边界。
- `src/views/login/components/Login/index.vue`：增加 `Base Domain`，删除旧记忆凭据逻辑。
- `locales/zh_CN.json`、`locales/en_US.json`：增加 Base Domain 文案和校验提示。
- `src/views/node/index.vue`：复制菜单增加 FQDN。
- `src/views/apiKey/index.vue`：当前 API Key 前缀判断改为读取 Session API Key。
- `README.md`、`README.zh-CN.md`：说明 Base Domain 与 API Key 的浏览器生命周期。

## 基线前置条件

新 worktree 中的 auto-import 声明文件由 Vite plugin 生成且被 `.gitignore` 忽略。首次验证必须先运行：

```bash
npm install
npm run build:prod
npm run lint
npm run test:release
```

预期：

- `build:prod` exit 0，并生成 `src/typings/auto-imports.d.ts` 与 `src/typings/components.d.ts`；
- `lint` exit 0；
- release tests 显示 `56` tests、`56` pass、`0` fail。

当前本机 Node.js `20.14.0` 会显示 Vite engine warning；项目 `volta.node` 指定 `22.23.1`。warning 不等于测试失败，但 CI 和正式开发环境应使用 Node.js `22.23.1`。

### Task 1: 建立前端测试环境

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Create: `tests/setup.ts`

- [ ] **Step 1: 安装测试依赖**

Run:

```bash
npm install --save-dev vitest @vue/test-utils happy-dom
```

Expected: `package.json` 的 `devDependencies` 增加三个 package，`package-lock.json` 同步更新。

- [ ] **Step 2: 增加统一测试脚本**

在 `package.json` 的 `scripts` 中加入：

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: 配置 Vitest**

将 `vite.config.ts` 的 import 调整为：

```ts
import { resolve } from 'node:path'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
```

在返回的 Vite config 中加入：

```ts
test: {
  environment: 'happy-dom',
  setupFiles: ['./tests/setup.ts'],
  include: ['./tests/**/*.test.ts'],
  clearMocks: true,
  restoreMocks: true,
},
```

`include` 必须限制为 TypeScript 前端 tests，避免 Vitest 接管由 `node --test` 单独执行的 `tests/release-*.test.mjs`。

- [ ] **Step 4: 创建测试初始化文件**

创建 `tests/setup.ts`：

```ts
import { afterEach, beforeEach } from 'vitest'

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
})
```

- [ ] **Step 5: 运行空测试环境**

Run:

```bash
npm test -- --passWithNoTests
```

Expected: Vitest exit 0，不报告 config 或 environment 错误。

- [ ] **Step 6: 运行类型与构建检查**

Run:

```bash
npm run lint
npm run build:prod
```

Expected: 两个命令均 exit 0。

- [ ] **Step 7: 提交测试基础设施**

```bash
git add package.json package-lock.json vite.config.ts tests/setup.ts
git commit -m "test: 增加前端单元测试环境"
```

### Task 2: 实现 Base Domain 与 FQDN utility

**Files:**
- Create: `src/utils/baseDomain.ts`
- Modify: `src/utils/index.ts`
- Create: `tests/base-domain.test.ts`

- [ ] **Step 1: 编写失败测试**

创建 `tests/base-domain.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import {
  buildNodeFqdn,
  isValidBaseDomain,
  normalizeBaseDomain,
} from '@/utils/baseDomain'

describe('baseDomain', () => {
  it('标准化大小写、空白和首尾点', () => {
    expect(normalizeBaseDomain(' .EXAMPLE.Internal. ')).toBe('example.internal')
  })

  it('允许空值和合法 DNS domain', () => {
    expect(isValidBaseDomain('')).toBe(true)
    expect(isValidBaseDomain('example.internal')).toBe(true)
    expect(isValidBaseDomain('tailnet.example.com')).toBe(true)
  })

  it.each([
    'https://example.internal',
    'example.internal:443',
    'example.internal/path',
    'bad_domain.example',
    '-invalid.example',
    'invalid-.example',
    '中文.example',
  ])('拒绝非法 domain：%s', (value) => {
    expect(isValidBaseDomain(value)).toBe(false)
  })

  it('拒绝超长 label 和超长 domain', () => {
    expect(isValidBaseDomain(`${'a'.repeat(64)}.example`)).toBe(false)
    expect(isValidBaseDomain(`${'a.'.repeat(126)}abcd`)).toBe(false)
  })

  it('生成标准化 FQDN', () => {
    expect(buildNodeFqdn(' node-1. ', ' .Example.Internal. ')).toBe('node-1.example.internal')
  })

  it('节点名或 baseDomain 为空时不生成 FQDN', () => {
    expect(buildNodeFqdn('', 'example.internal')).toBeNull()
    expect(buildNodeFqdn('node-1', '')).toBeNull()
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- tests/base-domain.test.ts
```

Expected: FAIL，提示无法解析 `@/utils/baseDomain`。

- [ ] **Step 3: 编写最小实现**

创建 `src/utils/baseDomain.ts`：

```ts
const DOMAIN_MAX_LENGTH = 253
const LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/

export function normalizeBaseDomain(value: string) {
  return value.trim().replace(/^\.+|\.+$/g, '').toLowerCase()
}

export function isValidBaseDomain(value: string) {
  const normalized = normalizeBaseDomain(value)
  if (!normalized)
    return true

  if (normalized.length > DOMAIN_MAX_LENGTH)
    return false

  return normalized.split('.').every(label => LABEL_PATTERN.test(label))
}

export function buildNodeFqdn(givenName: string, baseDomain: string) {
  const normalizedName = givenName.trim().replace(/\.+$/g, '')
  const normalizedDomain = normalizeBaseDomain(baseDomain)

  if (!normalizedName || !normalizedDomain || !isValidBaseDomain(normalizedDomain))
    return null

  return `${normalizedName}.${normalizedDomain}`
}
```

在 `src/utils/index.ts` 增加：

```ts
export * from './baseDomain'
```

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
npm test -- tests/base-domain.test.ts
```

Expected: `12` tests pass、`0` fail。

- [ ] **Step 5: 运行 lint**

Run:

```bash
npm run lint
```

Expected: exit 0。

- [ ] **Step 6: 提交 domain utility**

```bash
git add src/utils/baseDomain.ts src/utils/index.ts tests/base-domain.test.ts
git commit -m "feat: 增加 Base Domain 校验与 FQDN 工具"
```

### Task 3: 建立安全的认证存储边界与旧数据迁移

**Files:**
- Create: `src/utils/authStorage.ts`
- Modify: `src/utils/index.ts`
- Modify: `src/typings/global.d.ts`
- Modify: `src/typings/api/login.d.ts`
- Modify: `src/main.ts`
- Create: `tests/auth-storage.test.ts`

- [ ] **Step 1: 编写失败测试**

创建 `tests/auth-storage.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import {
  clearSessionApiKey,
  getSessionAuthorizationHeader,
  getSessionApiKey,
  migrateLegacyAuthStorage,
  saveConnectionConfig,
  setSessionApiKey,
} from '@/utils/authStorage'
import { local } from '@/utils/storage'

describe('authStorage', () => {
  it('API Key 只写入 sessionStorage', () => {
    setSessionApiKey('secret-key')

    expect(getSessionApiKey()).toBe('secret-key')
    expect(window.localStorage.getItem('accessToken')).toBeNull()
    expect(window.localStorage.getItem('refreshToken')).toBeNull()
  })

  it('清理当前 tab 的 API Key', () => {
    setSessionApiKey('secret-key')
    clearSessionApiKey()

    expect(getSessionApiKey()).toBe('')
  })

  it('只在 Session API Key 存在时生成 Authorization header', () => {
    expect(getSessionAuthorizationHeader()).toBeUndefined()

    setSessionApiKey('secret-key')

    expect(getSessionAuthorizationHeader()).toBe('Bearer secret-key')
  })

  it('保存 serverUrl 和标准化 baseDomain', () => {
    saveConnectionConfig('https://headscale.example.com', ' .Example.Internal. ')

    expect(local.get('serverUrl')).toBe('https://headscale.example.com')
    expect(local.get('baseDomain')).toBe('example.internal')
  })

  it('迁移时删除旧 Token 和 loginAccount，但保留 serverUrl', () => {
    local.set('serverUrl', 'https://headscale.example.com')
    window.localStorage.setItem('accessToken', 'legacy-access-token')
    window.localStorage.setItem('refreshToken', 'legacy-refresh-token')
    window.localStorage.setItem('loginAccount', 'legacy-login')

    migrateLegacyAuthStorage()

    expect(window.localStorage.getItem('accessToken')).toBeNull()
    expect(window.localStorage.getItem('refreshToken')).toBeNull()
    expect(window.localStorage.getItem('loginAccount')).toBeNull()
    expect(local.get('serverUrl')).toBe('https://headscale.example.com')
    expect(local.get('baseDomain')).toBe('')
  })

  it('迁移可重复执行', () => {
    expect(() => {
      migrateLegacyAuthStorage()
      migrateLegacyAuthStorage()
    }).not.toThrow()
  })

  it('损坏的旧 baseDomain 不阻塞启动', () => {
    window.localStorage.setItem('baseDomain', 'not-json')

    expect(() => migrateLegacyAuthStorage()).not.toThrow()
    expect(local.get('baseDomain')).toBe('')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- tests/auth-storage.test.ts
```

Expected: FAIL，提示无法解析 `@/utils/authStorage`。

- [ ] **Step 3: 调整 Storage 类型**

将 `src/typings/global.d.ts` 中的 storage 类型改为：

```ts
declare namespace Storage {
  interface Session {
    dict: DictMap
    accessToken: string
  }

  interface Local {
    userInfo: Api.Login.Info
    serverUrl: string
    baseDomain: string
    lang: App.lang
  }
}
```

删除 `Storage.Local` 中的 `accessToken`、`refreshToken` 和 `loginAccount`。

- [ ] **Step 4: 清理登录响应中的伪 Token 类型**

将 `src/typings/api/login.d.ts` 的 `Api.Login.Info` 改为：

```ts
namespace Api {
  namespace Login {
    interface Info extends Entity.User {
      id: number
      role: Entity.RoleType
    }
  }
}
```

删除 `accessToken` 和 `refreshToken` 字段，避免类型继续暗示 Headscale user API 会返回浏览器认证 Token。

- [ ] **Step 5: 编写认证存储实现**

创建 `src/utils/authStorage.ts`：

```ts
import { normalizeBaseDomain } from './baseDomain'
import { local, session } from './storage'

const STORAGE_PREFIX = import.meta.env.VITE_STORAGE_PREFIX || ''
const LEGACY_AUTH_KEYS = ['accessToken', 'refreshToken', 'loginAccount'] as const

export function getSessionApiKey() {
  return session.get('accessToken') || ''
}

export function setSessionApiKey(apiKey: string) {
  session.set('accessToken', apiKey)
}

export function clearSessionApiKey() {
  session.remove('accessToken')
}

export function getSessionAuthorizationHeader() {
  const apiKey = getSessionApiKey()
  return apiKey ? `Bearer ${apiKey}` : undefined
}

export function saveConnectionConfig(serverUrl: string, baseDomain: string) {
  local.set('serverUrl', serverUrl.trim())
  local.set('baseDomain', normalizeBaseDomain(baseDomain))
}

export function migrateLegacyAuthStorage(
  storage: { removeItem: (key: string) => void } = window.localStorage,
) {
  for (const key of LEGACY_AUTH_KEYS)
    storage.removeItem(`${STORAGE_PREFIX}${key}`)

  try {
    if (local.get('baseDomain') === null)
      local.set('baseDomain', '')
  }
  catch {
    storage.removeItem(`${STORAGE_PREFIX}baseDomain`)
    local.set('baseDomain', '')
  }
}
```

在 `src/utils/index.ts` 增加：

```ts
export * from './authStorage'
```

- [ ] **Step 6: 在应用启动前执行迁移**

修改 `src/main.ts`：

```ts
import { migrateLegacyAuthStorage } from '@/utils'

async function setupApp() {
  migrateLegacyAuthStorage()
}
```

只在现有 `setupApp()` 函数的第一行插入 `migrateLegacyAuthStorage()`；后续的 loading、Pinia、router、modules 和 mount 语句顺序不变。迁移必须在 Pinia 和 router 安装前执行。

- [ ] **Step 7: 运行测试确认通过**

Run:

```bash
npm test -- tests/auth-storage.test.ts
```

Expected: `7` tests pass、`0` fail。

- [ ] **Step 8: 运行 lint**

Run:

```bash
npm run lint
```

Expected: exit 0。

- [ ] **Step 9: 提交存储边界**

```bash
git add src/utils/authStorage.ts src/utils/index.ts src/typings/global.d.ts src/typings/api/login.d.ts src/main.ts tests/auth-storage.test.ts
git commit -m "fix: 将 Headscale API Key 限制在当前会话"
```

### Task 4: 让认证、路由和 HTTP 请求统一使用 Session API Key

**Files:**
- Modify: `src/service/http/alova.ts`
- Modify: `src/router/guard.ts`
- Modify: `src/store/auth.ts`
- Modify: `src/views/apiKey/index.vue`
- Create: `tests/auth-store.test.ts`

- [ ] **Step 1: 编写 auth store 失败测试**

创建 `tests/auth-store.test.ts`：

```ts
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/store/auth'
import { getSessionApiKey } from '@/utils/authStorage'

const mocks = vi.hoisted(() => ({
  fetchLogin: vi.fn(),
  initAuthRoute: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('@/service', () => ({
  fetchLogin: mocks.fetchLogin,
}))

vi.mock('@/router', () => ({
  router: {
    currentRoute: { value: { meta: {}, query: {} } },
    push: mocks.routerPush,
  },
}))

vi.mock('@/store/router', () => ({
  useRouteStore: () => ({
    initAuthRoute: mocks.initAuthRoute,
    resetRouteStore: vi.fn(),
  }),
}))

vi.mock('@/store/tab', () => ({
  useTabStore: () => ({
    clearAllTabs: vi.fn(),
  }),
}))

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mocks.fetchLogin.mockReset()
    mocks.initAuthRoute.mockReset()
    mocks.routerPush.mockReset()
  })

  it('登录成功后 API Key 只存在于 sessionStorage', async () => {
    mocks.fetchLogin.mockResolvedValue({
      isSuccess: true,
      data: { users: [{ id: '1', name: 'admin' }] },
    })
    const store = useAuthStore()

    await store.login('https://headscale.example.com', 'example.internal', 'secret-key')

    expect(getSessionApiKey()).toBe('secret-key')
    expect(window.localStorage.getItem('accessToken')).toBeNull()
    expect(store.isLogin).toBe(true)
  })

  it('登录失败时清理 Session API Key 并保留连接配置', async () => {
    mocks.fetchLogin.mockResolvedValue({ isSuccess: false })
    const { local } = await import('@/utils/storage')
    const store = useAuthStore()

    await store.login('https://headscale.example.com', 'example.internal', 'secret-key')

    expect(getSessionApiKey()).toBe('')
    expect(local.get('serverUrl')).toBe('https://headscale.example.com')
    expect(local.get('baseDomain')).toBe('example.internal')
  })

  it('退出时清理 Session API Key', async () => {
    const { setSessionApiKey } = await import('@/utils/authStorage')
    const store = useAuthStore()
    setSessionApiKey('secret-key')

    await store.logout()

    expect(getSessionApiKey()).toBe('')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- tests/auth-store.test.ts
```

Expected: FAIL，现有 `login` 参数和 Local Storage 行为不符合测试。

- [ ] **Step 3: 修改 HTTP 认证头**

在 `src/service/http/alova.ts` 中用 Session helper 替换 Local Storage Token：

```ts
import {
  clearSessionApiKey,
  getSessionAuthorizationHeader,
  local,
} from '@/utils'

assignToken: (method) => {
  const authorization = getSessionAuthorizationHeader()
  if (authorization)
    method.config.headers.Authorization = authorization
},
```

将 `toLogin()` 中的 Token 清理改为：

```ts
async function toLogin() {
  clearSessionApiKey()
  local.remove('userInfo')
  await router.push('/login')
}
```

不得生成 `Bearer null`、`Bearer undefined` 或空 Bearer。

- [ ] **Step 4: 修改路由守卫**

在 `src/router/guard.ts`：

```ts
import { getSessionApiKey } from '@/utils'

const isLogin = Boolean(getSessionApiKey())
```

删除对 `local.get('accessToken')` 的依赖。

- [ ] **Step 5: 重构 auth store**

将 `src/store/auth.ts` 替换为以下实现：

```ts
import { useRouteStore } from './router'
import { useTabStore } from './tab'
import { fetchLogin } from '@/service'
import { router } from '@/router'
import {
  clearSessionApiKey,
  getSessionApiKey,
  local,
  saveConnectionConfig,
  setSessionApiKey,
} from '@/utils'

interface AuthStatus {
  userInfo: Api.Login.Info | null
  token: string
}

export const useAuthStore = defineStore('auth-store', {
  state: (): AuthStatus => ({
    userInfo: local.get('userInfo'),
    token: getSessionApiKey(),
  }),
  getters: {
    isLogin(state) {
      return Boolean(state.token)
    },
  },
  actions: {
    async logout() {
      const route = unref(router.currentRoute)
      this.clearAuthStorage()

      const routeStore = useRouteStore()
      routeStore.resetRouteStore()

      const tabStore = useTabStore()
      tabStore.clearAllTabs()

      this.$reset()

      if (route.meta.requiresAuth) {
        await router.push({
          name: 'login',
          query: {
            redirect: route.fullPath,
          },
        })
      }
    },

    clearAuthStorage() {
      clearSessionApiKey()
      local.remove('userInfo')
      this.token = ''
      this.userInfo = null
    },

    async login(serverUrl: string, baseDomain: string, apiKey: string) {
      saveConnectionConfig(serverUrl, baseDomain)
      setSessionApiKey(apiKey)
      this.token = apiKey

      try {
        const result = await fetchLogin()
        if (!result?.isSuccess) {
          this.clearAuthStorage()
          return
        }
        await this.handleLoginInfo(result.data.users[0])
      }
      catch (error) {
        this.clearAuthStorage()
        console.warn('[Login Error]:', error)
      }
    },

    async handleLoginInfo(data: Api.Login.Info) {
      local.set('userInfo', data)
      this.userInfo = data
      const routeStore = useRouteStore()
      await routeStore.initAuthRoute()
      const route = unref(router.currentRoute)
      const query = route.query as { redirect?: string }
      await router.push({ path: query.redirect || '/' })
    },
  },
})
```

- [ ] **Step 6: 修正 API Key 列表的当前 Key 判断**

`src/views/apiKey/index.vue` 当前错误地把 `local.get('accessToken')` 命名为 `serverUrl`。改为：

```ts
import { getSessionApiKey } from '@/utils'

const currentApiKey = getSessionApiKey()
if (currentApiKey.startsWith(rowData.prefix)) {
  return h(NTag, {
    style: {
      marginRight: '6px',
    },
    type: 'info',
    bordered: true,
  }, {
    default: () => rowData.prefix,
  })
}
return rowData.prefix
```

- [ ] **Step 7: 运行 auth store 测试**

Run:

```bash
npm test -- tests/auth-store.test.ts
```

Expected: `3` tests pass、`0` fail。

- [ ] **Step 8: 运行相关测试与 lint**

Run:

```bash
npm test -- tests/auth-storage.test.ts tests/auth-store.test.ts
npm run lint
```

Expected: 所有测试通过，lint exit 0。

- [ ] **Step 9: 提交认证链路**

```bash
git add src/service/http/alova.ts src/router/guard.ts src/store/auth.ts src/views/apiKey/index.vue tests/auth-store.test.ts
git commit -m "refactor: 使用 Session API Key 完成前端认证"
```

### Task 5: 登录表单增加 Base Domain 并移除旧凭据记忆逻辑

**Files:**
- Modify: `src/views/login/components/Login/index.vue`
- Modify: `locales/zh_CN.json`
- Modify: `locales/en_US.json`
- Create: `tests/login-form.test.ts`

- [ ] **Step 1: 编写登录表单失败测试**

创建 `tests/login-form.test.ts`：

```ts
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

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

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

describe('Login form', () => {
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
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- tests/login-form.test.ts
```

Expected: FAIL，现有表单只有两个输入，并仍使用 `loginAccount`。

- [ ] **Step 3: 增加中英文文案**

在 `locales/zh_CN.json` 的 `login` 中加入：

```json
"baseDomainPlaceholder": "Base Domain（可选），例如 example.internal",
"baseDomainRuleTip": "请输入合法的 DNS domain，不要包含协议、端口或路径"
```

在 `locales/en_US.json` 的 `login` 中加入：

```json
"baseDomainPlaceholder": "Base Domain (optional), for example example.internal",
"baseDomainRuleTip": "Enter a valid DNS domain without a protocol, port, or path"
```

- [ ] **Step 4: 重构登录表单状态和规则**

将 script import 调整为：

```ts
import type { FormInst } from 'naive-ui'
import {
  isValidBaseDomain,
  local,
  normalizeBaseDomain,
} from '@/utils'
import { useAuthStore } from '@/store'
```

将表单值改为：

```ts
const formValue = ref({
  serverUrl: local.get('serverUrl') || '',
  baseDomain: local.get('baseDomain') || '',
  apiKey: '',
})
```

规则改为：

```ts
const rules = computed(() => ({
  serverUrl: {
    required: true,
    trigger: 'blur',
    message: t('login.accountRuleTip'),
  },
  baseDomain: {
    trigger: ['input', 'blur'],
    validator: (_rule: unknown, value: string) => {
      return isValidBaseDomain(value)
        ? true
        : new Error(t('login.baseDomainRuleTip'))
    },
  },
  apiKey: {
    required: true,
    trigger: 'blur',
    message: t('login.passwordRuleTip'),
  },
}))
```

提交逻辑改为：

```ts
const { serverUrl, baseDomain, apiKey } = formValue.value
await authStore.login(
  serverUrl.trim(),
  normalizeBaseDomain(baseDomain),
  apiKey,
)
```

完全删除：

- `isRemember`；
- `checkUserAccount()`；
- `loginAccount` 的读取、写入和删除。

- [ ] **Step 5: 更新模板**

按以下顺序放置三个 `n-form-item`：

```vue
<n-form-item path="serverUrl">
  <n-input
    v-model:value="formValue.serverUrl"
    clearable
    :placeholder="$t('login.accountPlaceholder')"
  />
</n-form-item>

<n-form-item path="baseDomain">
  <n-input
    v-model:value="formValue.baseDomain"
    clearable
    :placeholder="$t('login.baseDomainPlaceholder')"
  />
</n-form-item>

<n-form-item path="apiKey">
  <n-input
    v-model:value="formValue.apiKey"
    type="password"
    autocomplete="off"
    :placeholder="$t('login.passwordPlaceholder')"
    clearable
    show-password-on="click"
  >
    <template #password-invisible-icon>
      <icon-park-outline-preview-close-one />
    </template>
    <template #password-visible-icon>
      <icon-park-outline-preview-open />
    </template>
  </n-input>
</n-form-item>
```

页面中不得出现记住凭据 checkbox。

- [ ] **Step 6: 运行组件测试**

Run:

```bash
npm test -- tests/login-form.test.ts
```

Expected: `3` tests pass、`0` fail。

- [ ] **Step 7: 运行 lint**

Run:

```bash
npm run lint
```

Expected: exit 0。

- [ ] **Step 8: 提交登录表单**

```bash
git add src/views/login/components/Login/index.vue locales/zh_CN.json locales/en_US.json tests/login-form.test.ts
git commit -m "feat: 登录时配置 Headscale Base Domain"
```

### Task 6: 节点复制菜单增加完整域名

**Files:**
- Create: `tests/node-copy-options.test.ts`
- Modify: `src/utils/baseDomain.ts`
- Modify: `src/views/node/index.vue`

- [ ] **Step 1: 编写复制选项失败测试**

在 `tests/node-copy-options.test.ts` 中直接测试可复用的 option builder：

```ts
import { describe, expect, it } from 'vitest'
import { buildNodeCopyValues } from '@/utils/baseDomain'

describe('buildNodeCopyValues', () => {
  it('有 baseDomain 时把 FQDN 放在第一项', () => {
    expect(buildNodeCopyValues(
      'node-1',
      ['100.64.0.1', 'fd7a:115c:a1e0::1'],
      'example.internal',
    )).toEqual([
      'node-1.example.internal',
      'node-1',
      '100.64.0.1',
      'fd7a:115c:a1e0::1',
    ])
  })

  it('baseDomain 为空时保持现有顺序', () => {
    expect(buildNodeCopyValues(
      'node-1',
      ['100.64.0.1'],
      '',
    )).toEqual([
      'node-1',
      '100.64.0.1',
    ])
  })

  it('避免重复的完整域名或 IP 值', () => {
    expect(buildNodeCopyValues(
      'node-1',
      ['node-1', '100.64.0.1', '100.64.0.1'],
      'example.internal',
    )).toEqual([
      'node-1.example.internal',
      'node-1',
      '100.64.0.1',
    ])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- tests/node-copy-options.test.ts
```

Expected: FAIL，提示 `buildNodeCopyValues` 未导出。

- [ ] **Step 3: 实现 option value builder**

在 `src/utils/baseDomain.ts` 增加：

```ts
export function buildNodeCopyValues(
  givenName: string,
  ipAddresses: string[],
  baseDomain: string,
) {
  const fqdn = buildNodeFqdn(givenName, baseDomain)
  return [...new Set([
    ...(fqdn ? [fqdn] : []),
    givenName,
    ...ipAddresses,
  ].filter(Boolean))]
}
```

- [ ] **Step 4: 让节点页面使用当前 baseDomain**

修改 `src/views/node/index.vue`：

```ts
import { buildNodeCopyValues, local } from '@/utils'

const baseDomain = computed(() => local.get('baseDomain') || '')
```

复制列的 render 改为：

```ts
const dropdownOptions = buildNodeCopyValues(
  row.givenName,
  row.ipAddresses,
  baseDomain.value,
).map(value => createOption(value, value))
```

保持 table cell 默认显示 `row.ipAddresses[0]`，不把 FQDN 改为表格主显示值。

- [ ] **Step 5: 运行复制选项测试**

Run:

```bash
npm test -- tests/node-copy-options.test.ts
```

Expected: `3` tests pass、`0` fail。

- [ ] **Step 6: 运行全部前端测试**

Run:

```bash
npm test
```

Expected: 全部 Vitest tests pass、`0` fail。

- [ ] **Step 7: 提交复制功能**

```bash
git add src/utils/baseDomain.ts src/views/node/index.vue tests/node-copy-options.test.ts
git commit -m "feat: 节点复制菜单增加 MagicDNS 完整域名"
```

### Task 7: 文档、安全回归与最终验证

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`

- [ ] **Step 1: 更新中文文档**

在 `README.zh-CN.md` 的安装说明中增加：

```markdown
### 登录连接配置

登录时可填写 Headscale 的 `dns.base_domain`。配置后，节点 IP 地址列的复制菜单会增加 `givenName.base_domain` 完整域名。

`Server URL` 和 `Base Domain` 会保存在浏览器 `localStorage`。Headscale API Key 只保存在当前 tab 的 `sessionStorage`：刷新页面后仍有效，关闭 tab 后需要重新输入。请仅通过可信的 HTTPS 地址访问 WebUI。
```

- [ ] **Step 2: 更新英文文档**

在 `README.md` 的安装说明中增加：

```markdown
### Login connection settings

You can enter Headscale's `dns.base_domain` on the login page. When configured, the copy menu in the node IP address column includes the full `givenName.base_domain` name.

`Server URL` and `Base Domain` are stored in browser `localStorage`. The Headscale API Key is stored only in the current tab's `sessionStorage`: it survives reloads but must be entered again after the tab is closed. Access the WebUI only over a trusted HTTPS endpoint.
```

- [ ] **Step 3: 运行全部自动化测试**

Run:

```bash
npm test
npm run test:release
```

Expected:

- Vitest 全部通过、`0` fail；
- release tests `56` pass、`0` fail。

- [ ] **Step 4: 运行静态检查与 production build**

Run:

```bash
npm run lint
npm run build:prod
git diff --check
```

Expected: 三个命令均 exit 0；build 仅允许已知的本机 Node.js engine warning。

- [ ] **Step 5: 检查敏感存储引用**

Run:

```bash
rg -n "local\\.(get|set|remove)\\('(accessToken|refreshToken|loginAccount)'\\)" src
```

Expected: 无匹配。

Run:

```bash
rg -n "getSessionApiKey|setSessionApiKey|clearSessionApiKey" src
```

Expected: HTTP adapter、router guard、auth store 和 API Key 页面通过 helper 访问 Session API Key。

- [ ] **Step 6: 手工浏览器验证**

Run:

```bash
npm run dev
```

验证：

1. 登录页显示 `Server URL`、`Base Domain`、`API Key`；
2. `Base Domain` 可留空，非法 URL、端口和路径形式会阻止提交；
3. 登录成功后 `localStorage` 只包含非敏感连接配置和现有 UI 状态；
4. `sessionStorage` 包含当前 API Key；
5. 刷新页面后仍保持认证；
6. 关闭 tab 后重新打开，连接配置自动回填，API Key 为空；
7. 配置 `baseDomain` 时节点复制菜单第一项为完整 FQDN；
8. 未配置 `baseDomain` 时复制菜单保持节点名和 IP；
9. 退出登录后 Session API Key 被清除，连接配置保留。

- [ ] **Step 7: 提交文档与最终修正**

```bash
git add README.md README.zh-CN.md
git commit -m "docs: 说明 Base Domain 与 API Key 会话存储"
```

- [ ] **Step 8: 确认最终工作区状态**

Run:

```bash
git status --short
git log --oneline --decorate -8
```

Expected: 工作区干净，功能分支包含按任务拆分的提交。
