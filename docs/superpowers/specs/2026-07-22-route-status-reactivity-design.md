# 路由状态响应式更新设计

## 问题

`nodeSubNetDetails.vue` 在 setup 阶段把 `routeCount` 和 `enableCount` 保存为普通 number，后续路由审批状态变化不会重新计算。`routeTable.vue` 在 API 成功后原地修改普通 route 对象，也没有向父组件提交新数组引用。因此子网标签中的“已启用/总数”只反映初始快照。

`exitNodeDetails.vue` 虽然使用 `computed`，但它依赖的同样是原地修改的普通 route 对象，因此出口节点警告状态存在相同隐患。

## 设计

`RouteTable` 成为路由写操作结果的发布者。`setApprovedRoutes` 成功后，它基于返回的完整审批集合生成新的 `RouteData[]`，替换内部 `routeList`，并发出 `routes-updated` 事件。事件 payload 是新的完整可见路由数组，不是单条增量，避免多个路由状态相互覆盖。

`NodeSubNetDetails` 与 `ExitNodeDetails` 各自维护 `localRoutes` 响应式数组：

- 初始化时复制 props routes。
- props routes 被服务端刷新替换时，同步更新 `localRoutes`。
- 收到 `routes-updated` 时，用事件中的新数组替换 `localRoutes`。
- 传给 `RouteTable` 的也是 `localRoutes`。

子网的 `routeCount` 和 `enableCount` 都改为 `computed`；出口节点的 enabled 状态继续使用 `computed`，但改为依赖 `localRoutes`。

API 失败时，`RouteTable` 不替换数组、不发事件，因此计数和警告状态保持不变。API 成功后，按钮状态、表格审批状态、子网计数和出口警告在同一轮响应式更新中同步变化。

## 测试

组件回归测试覆盖：

- 子网初始显示正确的已启用数量和总数。
- RouteTable 发出成功更新事件后，子网计数无需刷新页面立即变化。
- 新 props 到达时，本地数组与计数同步。
- 出口路由更新后，警告状态同步变化。
- API 失败时 RouteTable 不发 `routes-updated`，父组件状态不变。

完成后运行完整 Vitest、release tests、lint、类型检查和 production build。
