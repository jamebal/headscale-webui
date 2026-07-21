# Headscale v0.29 WebUI 适配实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 WebUI 的 API、领域模型和交互升级到 Headscale v0.29.x，并移除 v0.29 不再支持的操作。

**Architecture:** 节点 API 成为节点和路由的唯一远端数据源，纯函数把 `availableRoutes` 与 `approvedRoutes` 转换为 UI 路由行，路由切换提交节点完整审批集合。其他服务模块直接表达 v0.29 Swagger 类型，页面只做按用户 ID 过滤和交互状态管理。

**Tech Stack:** Vue 3、TypeScript、Alova、Naive UI、Vitest、Vue Test Utils、ESLint、Vite

---

## 文件结构

- 修改 `src/service/api/node.ts`：v0.29 Node 类型、节点 API、审批路由 API 和 URL 编码。
- 修改 `src/service/api/route.ts`：纯路由派生与审批集合计算，不再调用旧 `/routes` endpoint。
- 修改 `src/service/api/user.ts`：完整 User 类型、明确 request/response、path 编码。
- 修改 `src/service/api/preAuthKeys.ts`：全量列表、用户 ID 创建、key ID 过期。
- 修改 `src/service/api/apiKey.ts`、`src/service/api/policy.ts`：明确 v0.29 response 类型与 path 编码。
- 修改 `src/views/node/*.vue`：直接消费 v0.29 节点路由字段、移除变更所有者、使用 `tags`。
- 修改 `src/views/route/routeTable.vue`：通过节点列表渲染路由并调用节点级审批。
- 修改 `src/views/user/*.vue`、`src/views/deploy/authKeyCascader.vue`：按用户 ID 使用全量 PreAuthKey。
- 删除 `src/views/node/changeOwnerModal.vue`、`src/views/route/deleteRouteDialog.ts`：移除后端不存在的操作。
- 新增 `tests/route-api.test.ts`、`tests/preauthkey-api.test.ts`、`tests/node-v029-ui.test.ts`：领域与组件回归测试。
- 修改 `tests/node-api.test.ts`、`tests/node-user-filter-url.test.ts`：v0.29 节点 API 与页面数据流。
- 修改 `package.json`、`package-lock.json`、`README.md`、`README.zh-CN.md`、`tests/release-metadata.test.mjs`：发布兼容元数据升级到 0.29。

### 任务 1：对齐 v0.29 节点 API 与类型

**文件：**
- 修改：`tests/node-api.test.ts`
- 修改：`src/service/api/node.ts`

- [ ] **步骤 1：编写失败的节点 API 合约测试**

在 `tests/node-api.test.ts` 扩展 mock，使其包含 `Post`、`Delete`，并新增测试：

```ts
it('编码节点注册、重命名与审批路由参数', () => {
  registerNode({ user: 'alice+ops', key: 'key:a&b' })
  expect(mocks.post).toHaveBeenCalledWith(
    '/api/v1/node/register?user=alice%2Bops&key=key%3Aa%26b',
  )

  renameNode({ nodeId: '42', newName: 'office / one' })
  expect(mocks.post).toHaveBeenCalledWith(
    '/api/v1/node/42/rename/office%20%2F%20one',
  )

  setApprovedRoutes('42', ['10.0.0.0/24', '::/0'])
  expect(mocks.post).toHaveBeenCalledWith(
    '/api/v1/node/42/approve_routes',
    { routes: ['10.0.0.0/24', '::/0'] },
  )
})

it('不再导出 v0.29 已移除的节点变更所有者 API', async () => {
  const nodeApi = await import('@/service/api/node')
  expect(nodeApi).not.toHaveProperty('moveNode')
})
```

- [ ] **步骤 2：运行测试并确认因缺少编码和 `setApprovedRoutes` 而失败**

运行：`npm test -- tests/node-api.test.ts`

预期：测试因 `setApprovedRoutes is not a function` 或 URL 未编码而失败。

- [ ] **步骤 3：实现最小 v0.29 节点 API**

在 `src/service/api/node.ts` 中：

```ts
export interface NodeData {
  id: string
  machineKey: string
  nodeKey: string
  discoKey: string
  ipAddresses: string[]
  name: string
  user: User
  lastSeen: string
  expiry: string
  preAuthKey?: PreAuthKeyData
  createdAt: string
  registerMethod: RegisterMethod
  givenName: string
  online: boolean
  approvedRoutes: string[]
  availableRoutes: string[]
  subnetRoutes: string[]
  tags: string[]
}

export function setApprovedRoutes(nodeId: string, routes: string[]) {
  return request.Post<Service.ResponseResult<{ node: NodeData }>>(
    `/api/v1/node/${encodeURIComponent(nodeId)}/approve_routes`,
    { routes },
  )
}
```

用 `URLSearchParams` 构造注册 query，对所有 path 参数使用 `encodeURIComponent`，删除 `moveNode`，并为列表、注册、重命名、删除、过期、标签和回填响应写出明确类型。

- [ ] **步骤 4：运行节点 API 测试并确认通过**

运行：`npm test -- tests/node-api.test.ts`

预期：`tests/node-api.test.ts` 全部通过。

- [ ] **步骤 5：提交节点 API 变更**

```bash
git add tests/node-api.test.ts src/service/api/node.ts
git commit -m "feat: 适配 Headscale v0.29 节点接口"
```

### 任务 2：建立 v0.29 路由领域模型

**文件：**
- 新增：`tests/route-api.test.ts`
- 修改：`src/service/api/route.ts`

- [ ] **步骤 1：编写失败的路由派生与审批集合测试**

创建 `tests/route-api.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { buildApprovedRoutes, deriveRoutes } from '@/service/api/route'

const node = {
  id: '7',
  givenName: 'office',
  availableRoutes: ['10.0.0.0/24', '0.0.0.0/0', '::/0'],
  approvedRoutes: ['10.0.0.0/24', '::/0'],
} as any

describe('v0.29 路由领域模型', () => {
  it('从节点字段派生审批状态与出口路由', () => {
    expect(deriveRoutes([node])).toEqual([
      { key: '7:10.0.0.0/24', node, prefix: '10.0.0.0/24', approved: true, exitRoute: false },
      { key: '7:0.0.0.0/0', node, prefix: '0.0.0.0/0', approved: false, exitRoute: true },
      { key: '7:::/0', node, prefix: '::/0', approved: true, exitRoute: true },
    ])
  })

  it('切换单条路由时保留其他审批项并去重', () => {
    expect(buildApprovedRoutes(node, '0.0.0.0/0', true)).toEqual([
      '10.0.0.0/24',
      '::/0',
      '0.0.0.0/0',
    ])
    expect(buildApprovedRoutes(node, '10.0.0.0/24', false)).toEqual(['::/0'])
  })
})
```

- [ ] **步骤 2：运行测试并确认模块仍依赖旧 route API 而失败**

运行：`npm test -- tests/route-api.test.ts`

预期：测试因缺少 `deriveRoutes` 与 `buildApprovedRoutes` 而失败。

- [ ] **步骤 3：实现纯路由领域函数**

将 `src/service/api/route.ts` 改为不创建 request instance：

```ts
export interface RouteData {
  key: string
  node: NodeData
  prefix: string
  approved: boolean
  exitRoute: boolean
}

export function deriveRoutes(nodes: NodeData[]): RouteData[] {
  return nodes.flatMap(node => node.availableRoutes.map(prefix => ({
    key: `${node.id}:${prefix}`,
    node,
    prefix,
    approved: node.approvedRoutes.includes(prefix),
    exitRoute: prefix === '0.0.0.0/0' || prefix === '::/0',
  })))
}

export function buildApprovedRoutes(node: NodeData, prefix: string, approved: boolean): string[] {
  const routes = new Set(node.approvedRoutes)
  approved ? routes.add(prefix) : routes.delete(prefix)
  return [...routes]
}
```

- [ ] **步骤 4：运行路由领域测试并确认通过**

运行：`npm test -- tests/route-api.test.ts`

预期：全部通过，且 `src/service/api/route.ts` 不包含 `/api/v1/routes`。

- [ ] **步骤 5：提交路由领域模型**

```bash
git add tests/route-api.test.ts src/service/api/route.ts
git commit -m "feat: 从节点数据派生 v0.29 路由"
```

### 任务 3：迁移节点页和路由页

**文件：**
- 修改：`tests/node-user-filter-url.test.ts`
- 新增：`tests/node-v029-ui.test.ts`
- 修改：`src/views/node/index.vue`
- 修改：`src/views/node/nodeSubNetDetails.vue`
- 修改：`src/views/node/exitNodeDetails.vue`
- 修改：`src/views/node/nodeActions.vue`
- 修改：`src/views/node/nodeDetails.vue`
- 修改：`src/views/node/setTagsModel.vue`
- 修改：`src/views/route/routeTable.vue`
- 删除：`src/views/node/changeOwnerModal.vue`
- 删除：`src/views/route/deleteRouteDialog.ts`

- [ ] **步骤 1：先修改节点页回归测试，要求不再请求旧路由 API**

从 `tests/node-user-filter-url.test.ts` 删除 `fetchRouteList` mock，并将节点表断言改成直接响应：

```ts
expect(wrapper.getComponent(NDataTableStub).props('data')).toEqual([
  { id: 'bob' },
])
expect(mocks.fetchNodeList).toHaveBeenCalledTimes(1)
```

新增 `tests/node-v029-ui.test.ts`，挂载 `NodeActions` 与 `SetTagsModel`，验证菜单文本不包含 `app.changeOwner`，打开标签弹窗时初始值来自 `node.tags`。

- [ ] **步骤 2：运行 UI 测试并确认旧依赖导致失败**

运行：`npm test -- tests/node-user-filter-url.test.ts tests/node-v029-ui.test.ts`

预期：节点页仍导入 `fetchRouteList`，菜单仍包含变更所有者，标签仍读取 `forcedTags`，因此测试失败。

- [ ] **步骤 3：迁移节点页到派生路由模型**

在 `src/views/node/index.vue` 删除 `routeList`、`fetchRouteList` 和 `addRoutePrefixToNodes`。节点响应成功后直接赋值。名称列使用：

```ts
const routes = deriveRoutes([rowData])
const subnetRoutes = routes.filter(route => !route.exitRoute)
const exitRoutes = routes.filter(route => route.exitRoute)
```

将子网和出口组件 props 改为新的 `RouteData[]`。`nodeActions.vue` 删除 `ChangeOwnerModel`、状态、菜单项和 switch 分支；删除 `changeOwnerModal.vue`。

`nodeDetails.vue` 只显示 `nodeData.tags`，`setTagsModel.vue` 以 `props.nodeData.tags` 初始化。

- [ ] **步骤 4：重写路由表远端数据流**

`routeTable.vue` 在没有 props routes 时调用 `fetchNodeList('')`，再调用 `deriveRoutes`。切换按钮执行：

```ts
const routes = buildApprovedRoutes(rowData.node, rowData.prefix, !rowData.approved)
const result = await setApprovedRoutes(rowData.node.id, routes)
```

表格只保留 node、prefix、approved 和 action 列，以 `rowData.key` 识别 loading 行，删除 route ID、advertised、primary 和 delete 按钮；删除 `deleteRouteDialog.ts`。

- [ ] **步骤 5：运行 UI 与相关节点测试并确认通过**

运行：`npm test -- tests/node-user-filter-url.test.ts tests/node-v029-ui.test.ts tests/route-api.test.ts`

预期：全部通过。

- [ ] **步骤 6：提交页面迁移**

```bash
git add tests/node-user-filter-url.test.ts tests/node-v029-ui.test.ts src/views/node src/views/route
git commit -m "feat: 迁移节点与路由页面到 v0.29"
```

### 任务 4：迁移 PreAuthKey 到用户 ID 合约

**文件：**
- 新增：`tests/preauthkey-api.test.ts`
- 修改：`src/service/api/preAuthKeys.ts`
- 修改：`src/views/user/index.vue`
- 修改：`src/views/user/preAuthKeysModal.vue`
- 修改：`src/views/user/createPreAuthKeyModal.vue`
- 修改：`src/views/user/expirePreAuthKeyDialog.ts`
- 修改：`src/views/deploy/authKeyCascader.vue`

- [ ] **步骤 1：编写失败的 PreAuthKey API 合约测试**

创建 `tests/preauthkey-api.test.ts`，mock `Get` 与 `Post`：

```ts
it('列表请求不再发送 user query', () => {
  fetchPreAuthKeyList()
  expect(mocks.get).toHaveBeenCalledWith('/api/v1/preauthkey')
})

it('创建使用用户 ID，过期使用 key ID', () => {
  createPreAuthKey({ user: '12', reusable: false, ephemeral: false, expiration: null, aclTags: [] })
  expect(mocks.post).toHaveBeenCalledWith('/api/v1/preauthkey', expect.objectContaining({ user: '12' }))
  expirePreAuthKey('99')
  expect(mocks.post).toHaveBeenCalledWith('/api/v1/preauthkey/expire', { id: '99' })
})

it('按用户 ID 过滤全量 key', () => {
  expect(filterPreAuthKeysByUser(keys, '12')).toEqual([keys[0]])
})
```

- [ ] **步骤 2：运行测试并确认旧签名导致失败**

运行：`npm test -- tests/preauthkey-api.test.ts`

预期：旧列表携带 user query、旧过期 body 使用 `{ user, key }`，且缺少过滤函数，因此失败。

- [ ] **步骤 3：实现 v0.29 PreAuthKey API 与纯过滤函数**

```ts
export interface PreAuthKeyData {
  user: User
  id: string
  key: string
  reusable: boolean
  ephemeral: boolean
  used: boolean
  expiration: string
  createdAt: string
  aclTags: string[]
}

export function fetchPreAuthKeyList() {
  return request.Get<Service.ResponseResult<{ preAuthKeys: PreAuthKeyData[] }>>('/api/v1/preauthkey')
}

export function expirePreAuthKey(id: string) {
  return request.Post<Service.ResponseResult<Record<string, never>>>('/api/v1/preauthkey/expire', { id })
}

export function filterPreAuthKeysByUser(keys: PreAuthKeyData[], userId: string) {
  return keys.filter(key => key.user.id === userId)
}
```

- [ ] **步骤 4：迁移用户弹窗与部署级联选择器**

`user/index.vue` 给 `PreAuthKeysModal` 同时传 `user-id` 与显示名称。`preAuthKeysModal.vue` 用用户 ID 过滤全量列表，创建弹窗接收 ID，过期对话框接收 `row.id`。部署级联选择器先加载一次全量 key，再按所选 `user.id` 过滤，不再把用户名传给 API。

- [ ] **步骤 5：运行 PreAuthKey 与 TypeScript 检查**

运行：`npm test -- tests/preauthkey-api.test.ts`

预期：测试通过。

运行：`npx vue-tsc --noEmit`

预期：没有 PreAuthKey user string/object 类型错误。

- [ ] **步骤 6：提交 PreAuthKey 迁移**

```bash
git add tests/preauthkey-api.test.ts src/service/api/preAuthKeys.ts src/views/user src/views/deploy/authKeyCascader.vue
git commit -m "feat: 按用户 ID 适配 v0.29 PreAuthKey"
```

### 任务 5：收紧其余 v0.29 API 类型和参数编码

**文件：**
- 新增：`tests/headscale-v029-api.test.ts`
- 修改：`src/service/api/user.ts`
- 修改：`src/service/api/apiKey.ts`
- 修改：`src/service/api/policy.ts`

- [ ] **步骤 1：编写失败的其余 API 合约测试**

测试 `renameUser('7', 'alice / ops')` 请求 `/api/v1/user/7/rename/alice%20%2F%20ops`，`deleteApiKey('abc/def')` 请求 `/api/v1/apikey/abc%2Fdef`，并用 TypeScript `satisfies` 验证 `User` 包含 v0.29 profile 字段与 create request 可选字段。

- [ ] **步骤 2：运行测试并确认 path 未编码而失败**

运行：`npm test -- tests/headscale-v029-api.test.ts`

预期：rename user 或 delete ApiKey URL 与编码后的期望不一致。

- [ ] **步骤 3：实现明确类型和 path 编码**

为 `User` 增加 `displayName`、`email`、`providerId`、`provider`、`profilePicUrl`；让 `createUser` 接收 `CreateUserRequest`。对用户 rename/delete 和 ApiKey delete 的 path 参数使用 `encodeURIComponent`。Policy response 使用 `Policy`，写入 response 同样返回 `Policy`。

- [ ] **步骤 4：运行 API 测试并确认通过**

运行：`npm test -- tests/headscale-v029-api.test.ts tests/node-api.test.ts tests/preauthkey-api.test.ts`

预期：全部通过。

- [ ] **步骤 5：提交类型与编码变更**

```bash
git add tests/headscale-v029-api.test.ts src/service/api/user.ts src/service/api/apiKey.ts src/service/api/policy.ts
git commit -m "refactor: 对齐 v0.29 API 类型与路径编码"
```

### 任务 6：更新兼容元数据与发布文档

**文件：**
- 修改：`tests/release-metadata.test.mjs`
- 修改：`package.json`
- 修改：`package-lock.json`
- 修改：`README.md`
- 修改：`README.zh-CN.md`

- [ ] **步骤 1：先把发布元数据测试期望改为当前版本和 0.29**

```js
assert.deepEqual(metadata, {
  projectVersion: '0.0.7',
  headscaleCompatibility: '0.29',
})
```

- [ ] **步骤 2：运行发布测试并确认 metadata 不一致**

运行：`npm run test:release`

预期：真实 package、lockfile 和 README 与 `0.0.7` / `0.29` 期望不一致。

- [ ] **步骤 3：同步 package、lockfile 和 README**

将 `package.json` 的 `headscaleCompatibility` 改为 `0.29`；将 lockfile 根版本同步为 `0.0.7`。中英文 README 使用 `v0.29.x`、`0.0.7-hs0.29`、`0.0.7`、`hs0.29` 和 Docker image `jmal/headscale-webui:hs0.29`。

- [ ] **步骤 4：运行发布测试并确认通过**

运行：`npm run test:release`

预期：全部 Node.js release tests 通过。

- [ ] **步骤 5：提交元数据和文档**

```bash
git add tests/release-metadata.test.mjs package.json package-lock.json README.md README.zh-CN.md
git commit -m "docs: 声明 Headscale v0.29 兼容系列"
```

### 任务 7：完整验证与残留接口扫描

**文件：**
- 检查：全部变更文件

- [ ] **步骤 1：扫描 v0.29 已移除的接口和字段**

运行：`rg -n '/api/v1/routes|/user[`"'"']|moveNode|forcedTags|validTags|invalidTags|fetchRouteList|deleteRoute|enableRoute|disableRoute' src tests`

预期：没有旧 route endpoint、变更所有者 API 或旧 tag 字段残留；合法的 `/api/v1/user` 用户资源路径不计入节点 `/user` 残留。

- [ ] **步骤 2：运行完整 Vitest 测试**

运行：`npm test`

预期：所有 `tests/**/*.test.ts` 通过，无 warning 或未处理 Promise rejection。

- [ ] **步骤 3：运行发布测试**

运行：`npm run test:release`

预期：所有 `tests/release-*.test.mjs` 通过。

- [ ] **步骤 4：运行 lint 与类型检查**

运行：`npm run lint`

预期：ESLint 和 `vue-tsc --noEmit` 都通过。

- [ ] **步骤 5：运行 production build**

运行：`npm run build`

预期：构建成功并生成 `dist`，没有 TypeScript 错误。

- [ ] **步骤 6：检查最终差异**

运行：`git diff --check`

预期：无空白错误。

运行：`git status --short`

预期：只包含计划内尚未提交的文件；若任务均按步骤提交，则工作区为空。

