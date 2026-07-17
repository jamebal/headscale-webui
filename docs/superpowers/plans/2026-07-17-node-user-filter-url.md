# 节点用户筛选 URL 同步实施计划

> **执行要求：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项执行本计划，并使用复选框（`- [ ]`）跟踪进度。

**目标：** 让节点列表的用户筛选条件写入 `/node?user=用户名`，刷新、直接访问及路由导航后均可恢复。

**架构：** `src/views/node/index.vue` 直接以 Vue Router 的 `route.query.user` 作为筛选状态来源。一个规范化函数负责把路由参数转换为用户名，路由监听负责请求节点；用户操作只负责使用 `router.replace()` 改写查询参数，由同一条监听链路完成界面和数据更新。

**技术栈：** Vue 3 Composition API、Vue Router 4、TypeScript、Vitest、Vue Test Utils、Naive UI

---

## 文件结构

- 新建 `tests/node-user-filter-url.test.ts`：挂载节点列表页，验证路由查询参数、下拉框值和节点请求之间的同步行为。
- 修改 `src/views/node/index.vue`：读取并监听 `route.query.user`，通过 `router.replace()` 更新筛选参数，移除重复的挂载时节点请求。

### 任务一：从 URL 恢复筛选并响应路由变化

**文件：**

- 新建：`tests/node-user-filter-url.test.ts`
- 修改：`src/views/node/index.vue`

- [ ] **步骤 1：编写初始 URL 与路由变化测试**

创建 `tests/node-user-filter-url.test.ts`。测试使用内存路由挂载真实页面组件，并将外部请求与复杂子组件替换为稳定的测试替身：

```ts
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
      stubs: { NSelect: NSelectStub },
    },
  })
  await flushPromises()
  return { router, wrapper }
}

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

  it.each([
    {},
    { user: '' },
    { user: ['alice', 'bob'] },
  ])('将缺失、空值或数组形式的用户参数视为 All', async (query) => {
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
})
```

- [ ] **步骤 2：运行测试并确认失败原因正确**

运行：

```bash
npm test -- tests/node-user-filter-url.test.ts
```

预期：至少“从 URL 恢复用户筛选并请求对应节点”失败，显示下拉框仍是空字符串或 `fetchNodeList` 收到空字符串；失败来自尚未读取路由参数，而不是测试编译错误。

- [ ] **步骤 3：实现路由参数规范化与监听**

在 `src/views/node/index.vue` 的脚本中取得路由实例，并以规范化后的查询参数初始化筛选值：

```ts
const route = useRoute()
const router = useRouter()

function normalizeUserQuery(value: unknown) {
  return typeof value === 'string' ? value : ''
}

const selectUser = ref(normalizeUserQuery(route.query.user))
```

删除原来的 `const selectUser = ref('')`。在 `renderNodeList()` 之后增加路由监听，让所有路由入口共用同一条数据加载链路：

```ts
watch(
  () => normalizeUserQuery(route.query.user),
  (user) => {
    selectUser.value = user
    renderNodeList()
  },
  { immediate: true },
)
```

从 `onMounted()` 中删除 `renderNodeList()`，只保留用户列表请求，避免首次进入页面时请求两次：

```ts
onMounted(() => {
  fetchUserList().then((res) => {
    if (!res.isSuccess) {
      return
    }
    userList.value = res.data.users
  })
})
```

- [ ] **步骤 4：运行测试并确认通过**

运行：

```bash
npm test -- tests/node-user-filter-url.test.ts
```

预期：3 个测试全部通过，并且首次挂载每个页面实例只按规范化后的用户值请求一次节点列表。

- [ ] **步骤 5：提交 URL 恢复行为**

```bash
git add tests/node-user-filter-url.test.ts src/views/node/index.vue
git commit -m "feat: 从 URL 恢复节点用户筛选"
```

### 任务二：筛选操作写入 URL 并保留其他参数

**文件：**

- 修改：`tests/node-user-filter-url.test.ts`
- 修改：`src/views/node/index.vue`

- [ ] **步骤 1：为选择用户和 All 增加失败测试**

在同一个 `describe` 中追加两个测试：

```ts
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
```

- [ ] **步骤 2：运行新增测试并确认失败原因正确**

运行：

```bash
npm test -- tests/node-user-filter-url.test.ts
```

预期：新增测试失败，因为当前 `handleSelectUser()` 直接请求节点，未调用 `router.replace()`。

- [ ] **步骤 3：让筛选操作只更新路由查询参数**

将 `src/views/node/index.vue` 中的 `handleSelectUser()` 替换为：

```ts
function handleSelectUser(value: string) {
  const query = { ...route.query }
  if (value) {
    query.user = value
  }
  else {
    delete query.user
  }
  router.replace({ query })
}
```

同时把模板中的下拉框从双向赋值改为只读路由状态：

```vue
<n-select :value="selectUser" :options="userOptions" style="width: 200px" @update:value="handleSelectUser" />
```

该函数不再直接修改 `selectUser` 或调用 `renderNodeList()`；下拉框也不提前修改本地值。路由更新后由任务一增加的监听统一同步状态并请求节点。

- [ ] **步骤 4：运行测试并确认全部通过**

运行：

```bash
npm test -- tests/node-user-filter-url.test.ts
```

预期：5 个测试全部通过；选择具体用户时 URL 出现 `user`，选择 All 时 `user` 被移除，`tab` 等其他参数保持不变。

- [ ] **步骤 5：提交 URL 写入行为**

```bash
git add tests/node-user-filter-url.test.ts src/views/node/index.vue
git commit -m "feat: 将节点用户筛选同步到 URL"
```

### 任务三：完整验证

**文件：**

- 验证：`src/views/node/index.vue`
- 验证：`tests/node-user-filter-url.test.ts`

- [ ] **步骤 1：运行目标测试**

```bash
npm test -- tests/node-user-filter-url.test.ts
```

预期：5 个测试全部通过，无未处理异常。

- [ ] **步骤 2：运行完整测试套件**

```bash
npm test
```

预期：全部 Vitest 测试通过。

- [ ] **步骤 3：运行代码规范与类型检查**

```bash
npm run lint
```

预期：ESLint 与 `vue-tsc --noEmit` 均以状态码 0 结束。

- [ ] **步骤 4：运行生产构建**

```bash
npm run build
```

预期：类型检查和 Vite 生产构建成功，无构建错误。

- [ ] **步骤 5：检查最终差异**

```bash
git diff --check
git status --short
```

预期：`git diff --check` 无输出；工作区仅包含计划执行过程中预期的文件，或在任务提交后保持干净。
