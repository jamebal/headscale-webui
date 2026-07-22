# 路由状态响应式更新实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让子网启用计数和出口节点警告在路由审批 API 成功后立即更新，无需刷新页面。

**Architecture:** RouteTable 在成功后以不可变方式生成新路由数组并发出 `routes-updated`。子网与出口详情组件维护由 props 和事件共同驱动的本地响应式数组，所有汇总状态使用 computed。

**Tech Stack:** Vue 3、TypeScript、Naive UI、Vitest、Vue Test Utils

---

### 任务 1：RouteTable 发布不可变更新结果

**文件：**
- 新增：`tests/route-status-reactivity.test.ts`
- 修改：`src/views/route/routeTable.vue`

- [ ] **步骤 1：编写失败的成功与失败事件测试**

挂载 RouteTable，mock `setApprovedRoutes`。通过 action column 的按钮 `onClick` 触发切换，成功时断言：

```ts
expect(wrapper.emitted('routes-updated')?.[0]?.[0]).toEqual([
  expect.objectContaining({ prefix: '10.0.0.0/24', approved: true }),
  expect.objectContaining({ prefix: '10.1.0.0/24', approved: true }),
])
```

同时断言事件数组与原 props 数组不是同一引用。API 返回 `isSuccess: false` 时，断言不发 `routes-updated`。

- [ ] **步骤 2：运行测试并确认事件缺失而失败**

运行：`npm test -- tests/route-status-reactivity.test.ts`

预期：成功分支因未发出 `routes-updated` 而失败。

- [ ] **步骤 3：实现最小不可变更新与事件**

在 RouteTable 中声明：

```ts
const emit = defineEmits<{
  (event: 'routes-updated', routes: RouteData[]): void
}>()
```

API 成功后用完整审批集合生成新数组：

```ts
const updatedRoutes = routeList.value.map(item => item.node.id === route.node.id
  ? {
      ...item,
      node: { ...item.node, approvedRoutes: routes },
      approved: routes.includes(item.prefix),
    }
  : item)
routeList.value = updatedRoutes
emit('routes-updated', updatedRoutes)
```

失败分支保持原数组且不发事件。

- [ ] **步骤 4：运行测试并确认通过**

运行：`npm test -- tests/route-status-reactivity.test.ts`

预期：RouteTable 成功/失败事件测试通过。

### 任务 2：子网与出口组件响应新数组

**文件：**
- 修改：`tests/route-status-reactivity.test.ts`
- 修改：`src/views/node/nodeSubNetDetails.vue`
- 修改：`src/views/node/exitNodeDetails.vue`

- [ ] **步骤 1：编写失败的父组件即时更新测试**

挂载 NodeSubNetDetails，初始两条路由中一条 approved，断言文本包含 `app.subnets 1/2`。让 RouteTable stub 发出两条均 approved 的新数组，断言文本立即变为 `app.subnets 2/2`。

挂载 ExitNodeDetails，初始未审批时存在 NovaIcon warning；发出 approved 新数组后，断言 warning 消失。再用 `setProps` 替换服务端 routes，验证本地数组同步。

- [ ] **步骤 2：运行测试并确认普通 number 快照导致失败**

运行：`npm test -- tests/route-status-reactivity.test.ts`

预期：子网计数仍为 `1/2`，出口 warning 仍存在。

- [ ] **步骤 3：实现本地响应式数组与 computed**

两个组件都增加：

```ts
const localRoutes = ref<RouteData[]>([...props.routes])

watch(() => props.routes, routes => {
  localRoutes.value = [...routes]
}, { deep: true })

function handleRoutesUpdated(routes: RouteData[]) {
  localRoutes.value = routes
}
```

NodeSubNetDetails 使用 computed 计算总数和 approved 数量；ExitNodeDetails 从 `localRoutes` 计算 enabled。模板改为：

```vue
<RouteTable
  :routes="localRoutes"
  hide-node-name
  @routes-updated="handleRoutesUpdated"
/>
```

- [ ] **步骤 4：运行测试并确认通过**

运行：`npm test -- tests/route-status-reactivity.test.ts`

预期：所有即时更新与 props 同步测试通过。

- [ ] **步骤 5：提交修复**

```bash
git add tests/route-status-reactivity.test.ts src/views/route/routeTable.vue src/views/node/nodeSubNetDetails.vue src/views/node/exitNodeDetails.vue
git commit -m "fix: 即时更新路由启用状态汇总"
```

### 任务 3：完整验证

**文件：**
- 检查：全部变更文件

- [ ] **步骤 1：运行完整验证**

运行：`npm test`

预期：全部 Vitest 测试通过。

运行：`npm run test:release`

预期：全部 release tests 通过。

运行：`npm run lint`

预期：ESLint 与 TypeScript 检查通过。

运行：`npm run build`

预期：production build 成功。

- [ ] **步骤 2：检查工作区**

运行：`git diff --check`

预期：无空白错误。

运行：`git status --short`

预期：工作区 clean。
