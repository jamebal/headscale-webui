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

## 补充范围：PreAuthKey 独立页面与脱敏语义

以下任务落实后续确认的交互调整。它们建立在任务 1 至任务 7 的 v0.29 API 迁移之上。

### 任务 8：补齐 PreAuthKey 删除 API

**文件：**
- 修改：`tests/preauthkey-api.test.ts`
- 修改：`src/service/api/preAuthKeys.ts`

- [ ] **步骤 1：编写失败的删除 API 合约测试**

给 request mock 增加 `Delete`，并新增：

```ts
it('按 key ID 删除预授权密钥', () => {
  deletePreAuthKey('99')

  expect(mocks.delete).toHaveBeenCalledWith('/api/v1/preauthkey?id=99')
})
```

再用包含特殊字符的 ID 验证 `URLSearchParams` 编码，避免直接拼接 query。

- [ ] **步骤 2：运行测试并确认缺少删除函数而失败**

运行：`npm test -- tests/preauthkey-api.test.ts`

预期：测试因 `deletePreAuthKey is not a function` 失败。

- [ ] **步骤 3：实现最小删除 API**

```ts
export function deletePreAuthKey(id: string) {
  const params = new URLSearchParams({ id })
  return request.Delete<Service.ResponseResult<Record<string, never>>>(
    `/api/v1/preauthkey?${params.toString()}`,
  )
}
```

- [ ] **步骤 4：运行测试并确认通过**

运行：`npm test -- tests/preauthkey-api.test.ts`

预期：全部通过。

- [ ] **步骤 5：提交 API 变更**

```bash
git add tests/preauthkey-api.test.ts src/service/api/preAuthKeys.ts
git commit -m "feat: 添加 v0.29 PreAuthKey 删除接口"
```

### 任务 9：新增 PreAuthKey 独立列表页

**文件：**
- 新增：`tests/preauthkey-page.test.ts`
- 修改：`src/router/routes.static.ts`
- 修改：`locales/zh_CN.json`
- 修改：`locales/en_US.json`
- 新增：`src/views/preAuthKey/index.vue`
- 新增：`src/views/preAuthKey/expirePreAuthKeyDialog.ts`
- 新增：`src/views/preAuthKey/deletePreAuthKeyDialog.ts`

- [ ] **步骤 1：编写失败的路由与页面测试**

`tests/preauthkey-page.test.ts` 首先验证静态路由：

```ts
expect(staticRoutes).toContainEqual(expect.objectContaining({
  name: 'preAuthKeys',
  path: '/preauthkeys',
  componentPath: '/preAuthKey/index.vue',
}))
```

挂载页面并 mock `fetchPreAuthKeyList`、`fetchUserList`，给 GET 返回 `key: 'hskey-auth-********'`，断言表格数据保留该脱敏值、页面没有 CopyText 组件，并验证用户筛选只保留 `key.user.id` 匹配项。

- [ ] **步骤 2：运行测试并确认路由和页面缺失**

运行：`npm test -- tests/preauthkey-page.test.ts`

预期：测试因缺少 `/preauthkeys` 路由或页面模块而失败。

- [ ] **步骤 3：增加导航和翻译**

在 `staticRoutes` 的 users 后加入：

```ts
{
  name: 'preAuthKeys',
  path: '/preauthkeys',
  title: 'preAuthKeys',
  requiresAuth: true,
  icon: 'carbon:password',
  componentPath: '/preAuthKey/index.vue',
  id: 7,
  pid: null,
}
```

在中英文 `route` 翻译中增加 `preAuthKeys`。

- [ ] **步骤 4：实现独立列表页**

页面加载 `fetchPreAuthKeyList()` 和 `fetchUserList()`；表格列包含 ID、用户、脱敏 key、reusable、ephemeral、used、ACL 标签、createdAt、expiration 和 action。key 列只返回普通文本：

```ts
{
  title: t('app.key'),
  key: 'key',
  render: row => row.key,
}
```

页面用 `selectedUserId` 和 `hideInvalid` 计算过滤后的 `visiblePreAuthKeys`。操作列调用按 ID 过期和删除对话框，成功后广播 `refreshPreAuthKeyList`。

- [ ] **步骤 5：运行页面测试并确认通过**

运行：`npm test -- tests/preauthkey-page.test.ts`

预期：路由、脱敏显示与用户筛选测试全部通过。

- [ ] **步骤 6：提交独立页面**

```bash
git add tests/preauthkey-page.test.ts src/router/routes.static.ts locales src/views/preAuthKey
git commit -m "feat: 添加 PreAuthKey 独立管理页面"
```

### 任务 10：实现创建结果的一次性完整 key

**文件：**
- 新增：`tests/create-preauthkey-modal.test.ts`
- 新增：`src/views/preAuthKey/createPreAuthKeyModal.vue`
- 修改：`src/views/preAuthKey/index.vue`

- [ ] **步骤 1：编写失败的一次性密钥测试**

mock `createPreAuthKey` 返回：

```ts
{
  isSuccess: true,
  data: {
    preAuthKey: {
      id: '99',
      key: 'hskey-auth-full-secret',
      user: { id: '12', name: 'alice' },
    },
  },
}
```

挂载创建弹窗，提交后断言完整 key 出现在 success alert；触发复制只复制这个 POST 响应值；关闭并再次打开后断言完整 key 不再存在。测试同时断言 GET 列表数据不会作为弹窗结果传入。

- [ ] **步骤 2：运行测试并确认创建组件缺失**

运行：`npm test -- tests/create-preauthkey-modal.test.ts`

预期：测试因缺少新组件或结果状态而失败。

- [ ] **步骤 3：实现创建与结果双状态弹窗**

创建组件接收 `users: User[]`。表单状态包含 `user` ID、expiration、reusable、ephemeral 和 aclTags；POST 成功后：

```ts
createdKey.value = result.data.preAuthKey.key
emit('created')
```

只有 `createdKey` 非空时渲染 success alert 和复制按钮。`closeModal()` 必须执行：

```ts
createdKey.value = ''
modalVisible.value = false
```

禁止把 `createdKey` 写入 store 或 Web Storage。

- [ ] **步骤 4：运行一次性密钥测试并确认通过**

运行：`npm test -- tests/create-preauthkey-modal.test.ts`

预期：完整 key 展示、复制与关闭清空测试全部通过。

- [ ] **步骤 5：提交创建流程**

```bash
git add tests/create-preauthkey-modal.test.ts src/views/preAuthKey
git commit -m "feat: 一次性展示新建 PreAuthKey 完整值"
```

### 任务 11：移除用户页入口并改造部署密钥输入

**文件：**
- 新增：`tests/preauthkey-entrypoints.test.ts`
- 修改：`src/views/user/index.vue`
- 修改：`src/views/deploy/index.vue`
- 删除：`src/views/deploy/authKeyCascader.vue`
- 删除：`src/views/user/preAuthKeysModal.vue`
- 删除：`src/views/user/createPreAuthKeyModal.vue`
- 删除：`src/views/user/preAuthKeyDetails.vue`
- 删除：`src/views/user/expirePreAuthKeyDialog.ts`

- [ ] **步骤 1：编写失败的入口回归测试**

测试挂载用户页，断言 action 列不含 `app.preAuthKeys`，也不存在 `PreAuthKeysModal`。挂载部署页，mock `fetchPreAuthKeyList`，断言它从未调用，并验证 auth key 控件是 `type="password"` 的输入框。

- [ ] **步骤 2：运行测试并确认旧入口仍存在**

运行：`npm test -- tests/preauthkey-entrypoints.test.ts`

预期：用户页仍有 PreAuthKey 按钮，部署页仍渲染级联选择器，因此失败。

- [ ] **步骤 3：移除用户页 PreAuthKey 状态与旧组件**

从用户页删除 `PreAuthKeysModal` import、`preAuthKeysModalVisible`、选中用户时打开弹窗的按钮和模板组件。删除 `src/views/user` 下四个仅服务旧入口的文件。

- [ ] **步骤 4：把部署页改为手动密码输入**

删除 `AuthKeyCascader` import 和文件。原 `--auth-key` 控件改为：

```vue
<n-input
  v-if="options.includes('--auth-key')"
  v-model:value="authKey"
  type="password"
  show-password-on="click"
  @update-value="onAuthKeyUpdate"
/>
```

页面不再调用 `fetchPreAuthKeyList`，只把用户粘贴的完整 key 写入当前生成命令。

- [ ] **步骤 5：运行入口回归测试并确认通过**

运行：`npm test -- tests/preauthkey-entrypoints.test.ts`

预期：用户页和部署页断言全部通过。

- [ ] **步骤 6：提交入口迁移**

```bash
git add tests/preauthkey-entrypoints.test.ts src/views/user src/views/deploy
git commit -m "refactor: 将 PreAuthKey 管理迁移到独立页面"
```

### 任务 12：补充范围完整验证

**文件：**
- 检查：全部变更文件

- [ ] **步骤 1：扫描脱敏 key 的危险使用与旧组件残留**

运行：`rg -n 'fetchPreAuthKeyList|AuthKeyCascader|PreAuthKeysModal|CopyText' src/views`

预期：`fetchPreAuthKeyList` 只在独立列表页；列表页不导入 `CopyText`；旧用户弹窗和部署级联选择器不存在。

- [ ] **步骤 2：运行完整验证**

运行：`npm test`

预期：全部 Vitest 测试通过。

运行：`npm run test:release`

预期：全部 release tests 通过。

运行：`npm run lint`

预期：ESLint 与 TypeScript 检查通过。

运行：`npm run build`

预期：production build 成功。

- [ ] **步骤 3：检查差异与工作区**

运行：`git diff --check`

预期：无空白错误。

运行：`git status --short`

预期：工作区 clean。
