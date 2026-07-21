# Headscale v0.29 WebUI 适配设计

## 目标与范围

将当前仅支持 Headscale v0.25.x 的 WebUI 升级为仅支持 Headscale v0.29.x。此次升级以用户提供的 v0.29 Swagger 为接口契约，不保留 v0.25.x 运行时兼容层。

适配范围包括节点、路由、用户、PreAuthKey、ApiKey、Policy 相关页面和 API 类型。Headscale v0.29 已移除的节点变更所有者能力与独立路由删除能力从界面移除，不模拟后端不存在的行为。PreAuthKey 使用独立资源页面管理，不再从用户管理页进入。

## 架构选择

采用领域适配层方案：保留现有 Vue 页面组织方式，但让前端领域模型直接表达 v0.29 API，而不是继续伪装旧版 `/api/v1/routes` 接口。

- `src/service/api/node.ts` 负责 v0.29 节点模型、节点操作和节点级路由审批请求。
- `src/service/api/route.ts` 不再请求独立路由接口，只负责把节点中的路由字段转换为 UI 路由行，以及计算一次审批操作应提交的完整 `approvedRoutes` 集合。
- 节点页和路由页共享同一套派生路由模型，避免两套状态定义。
- `user.ts`、`preAuthKeys.ts`、`apiKey.ts` 和 `policy.ts` 使用明确的 request/response 类型，并按照 Swagger 收紧参数。

未选择继续模拟旧 `RouteData` 的最小补丁方案，因为 v0.29 不再提供 route ID、独立删除和 primary 等旧概念；保留这些字段会让界面表达不存在的能力。也不引入 Swagger client 生成链，因为当前接口规模有限，全量生成会增加构建复杂度和大量未使用代码。

## 节点与路由数据流

节点列表只调用 `GET /api/v1/node`。用户筛选继续作为 `user` query 参数传递，所有 query 与 path 参数都必须经过标准 URL 编码。

路由模型由节点响应派生：

- 遍历每个节点的 `availableRoutes`，为每个前缀生成一条路由行。
- 前缀同时存在于该节点 `approvedRoutes` 时，路由状态为已审批，否则为未审批。
- `0.0.0.0/0` 与 `::/0` 作为出口路由识别；其他前缀作为子网路由识别。
- UI 不再显示旧 API 才提供的 route ID、`advertised`、`isPrimary`、创建时间和删除操作。

切换某条路由时，前端基于节点当前 `approvedRoutes` 生成新集合：启用时加入目标前缀并去重，停用时移除目标前缀，然后调用 `POST /api/v1/node/{nodeId}/approve_routes`，body 为 `{ "routes": [...] }`。提交完整集合可以避免修改一条路由时误清除同节点的其他已审批路由。

节点列表中的子网和出口标识使用相同的派生结果。写操作成功后广播节点与路由刷新事件；失败时依赖现有 HTTP 统一错误提示，并保留当前显示状态。

## 已移除能力

Headscale v0.29 Swagger 不包含 `/api/v1/node/{nodeId}/user`，因此从节点操作菜单移除“变更所有者”，并删除相关组件引用和 API 方法。

Headscale v0.29 Swagger 不包含独立 route delete/enable/disable 接口，因此移除路由删除操作；启用和停用统一映射为节点级 `approvedRoutes` 更新。

## 用户与 PreAuthKey

`User` 类型补齐 v0.29 的 `displayName`、`email`、`providerId`、`provider` 和 `profilePicUrl` 字段。现有创建用户界面仍只要求名称，request 类型允许后续传递 Swagger 支持的可选资料字段，遵循 YAGNI，不在本次增加新表单项。

用户管理页只负责用户的创建、重命名和删除，不再包含 PreAuthKey 按钮、用户选择状态或弹窗。

新增 `/preauthkeys` 独立页面，集中管理所有用户的 PreAuthKey。页面列表展示用户、脱敏 key、可复用、临时、已使用、ACL 标签、创建时间和过期时间，并提供用户筛选与隐藏失效项。GET 返回的 key 是脱敏标识，只用于识别记录；列表不提供复制按钮，也不把该值作为可用认证凭据。

PreAuthKey API 与交互调整如下：

- `GET /api/v1/preauthkey` 不再携带旧版 `user` query。
- 页面加载全量 key 后，可按 `preAuthKey.user.id` 在前端筛选用户。
- 创建表单从用户列表选择用户 ID，请求的 `user` 字段提交 uint64 字符串形式的用户 ID。
- 过期请求只提交 `{ "id": key.id }`，不再提交 `{ user, key }`。
- 删除请求使用 `DELETE /api/v1/preauthkey?id={id}`。
- `PreAuthKeyData.user` 使用完整 `User` 对象类型。

只有创建请求的响应包含完整、可用的 PreAuthKey。创建成功后，弹窗停留在结果状态，展示完整 key 与复制按钮；关闭弹窗时立即清空结果，不写入 store、localStorage 或 sessionStorage，也不能通过 GET 再次恢复。刷新列表使用随后 GET 返回的脱敏 key，不能覆盖弹窗中的一次性完整值。

部署页移除从 GET 列表加载 key 的级联选择器，改为密码输入框，由用户粘贴创建时保存的完整 key。这样不会把脱敏值写入 `tailscale up --auth-key`。

## 其他 API 类型

`NodeData` 对齐 v0.29 `v1Node`，使用 `tags`、`approvedRoutes`、`availableRoutes` 和 `subnetRoutes`，移除 `routes`、`validTags`、`invalidTags` 与 `forcedTags`。标签编辑器以 `tags` 初始化。

ApiKey 保持 prefix 过期与删除流程，但补齐明确 response 类型。Policy 保持读取与写入流程并使用明确 response 类型。节点注册、重命名、删除、过期、标签、IP 回填等现有能力保留，并为 path/query 参数增加安全编码。

## 测试策略

实施遵循测试驱动开发，每个行为先添加失败测试，再写最小实现：

- API 合约测试验证 HTTP method、编码后的 URL、query、request body 和 response 类型调用方式。
- 路由领域测试验证节点路由展平、出口路由识别、审批状态，以及启用/停用时不会丢失其他已审批路由。
- PreAuthKey 测试验证全量请求、按用户 ID 过滤、创建使用用户 ID、过期使用 key ID。
- PreAuthKey 页面测试验证独立路由、用户筛选、脱敏 key 不可复制、完整 key 只在创建结果中出现、关闭后清空，以及按 ID 过期和删除。
- 节点页面测试验证只依赖节点响应，不再请求旧 `/api/v1/routes`，并继续保证较旧请求不会覆盖新筛选结果。
- 组件测试验证节点菜单不再出现变更所有者操作，标签编辑使用 `node.tags`。
- 用户页面测试验证不再包含 PreAuthKey 入口；部署页面测试验证不再请求 PreAuthKey GET，并使用手动密钥输入。

完成后运行 `npm test`、`npm run lint` 和 `npm run build`。只有三项均通过，才认为 v0.29 适配完成。

## 成功标准

- WebUI 不再调用 v0.29 Swagger 中不存在的 endpoint。
- 节点、路由、用户、PreAuthKey、ApiKey 和 Policy 的现有受支持操作与 v0.29 request/response 契约一致。
- 路由审批不会覆盖同节点其他审批项。
- 不再向用户呈现节点变更所有者或路由删除等后端不支持的操作。
- PreAuthKey 通过独立页面管理，用户页不再承担该职责。
- GET 返回的脱敏 PreAuthKey 永远不会作为可复制或可部署的完整凭据。
- 新建返回的完整 PreAuthKey 只在创建弹窗当前生命周期内展示。
- 自动化测试、lint 和 production build 全部通过。
