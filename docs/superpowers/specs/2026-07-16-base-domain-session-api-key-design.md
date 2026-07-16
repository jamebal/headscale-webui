# Base Domain 与 Session API Key 设计

## 背景

当前节点列表的 IP 地址列提供复制下拉菜单，内容包括节点的 `givenName` 和 Headscale API 返回的 `ipAddresses`。Headscale API 不返回服务端配置中的 `dns.base_domain`，因此 WebUI 无法直接生成节点的 MagicDNS 完整域名。

当前登录流程还会把 Headscale API Key 写入 `localStorage`：

- `accessToken` 保存 API Key；
- `refreshToken` 重复保存同一个 API Key；
- 勾选“记住登录信息”后，`loginAccount.pwd` 再次保存 API Key。

Headscale API Key 属于敏感凭据。将其长期保存在浏览器 `localStorage` 会扩大凭据暴露窗口。本次改动保持纯静态前端架构，但将 API Key 的生命周期限制在当前浏览器 tab 内。

## 目标

本次改动实现以下目标：

1. 登录时允许填写可选的 Headscale `baseDomain`。
2. 节点复制菜单可以复制 `givenName.baseDomain`。
3. `serverUrl` 和 `baseDomain` 默认持久化，方便再次打开 WebUI。
4. API Key 不再写入 `localStorage`，只保存在当前 tab 的 `sessionStorage`。
5. 页面刷新后保持认证，关闭 tab 后要求重新输入 API Key。
6. 自动清理旧版本遗留在 `localStorage` 中的 API Key。
7. 不引入多 Headscale 实例管理，不增加 BFF 或其他后端服务。

## 非目标

本次改动不包含：

- 多 Headscale 实例列表、切换和凭据管理；
- Docker 环境变量形式的全局 `baseDomain`；
- 从 `serverUrl` 自动推导 `baseDomain`；
- 服务端 Session、`HttpOnly` Cookie 或 BFF；
- 修改 Headscale API；
- 自动检测 Headscale 的 MagicDNS 配置。

## 登录界面

登录表单包含以下字段：

| 字段 | 必填 | 持久化位置 | 说明 |
| --- | --- | --- | --- |
| `Server URL` | 是 | `localStorage` | Headscale API 地址 |
| `Base Domain` | 否 | `localStorage` | Headscale 的 MagicDNS base domain |
| `API Key` | 是 | `sessionStorage` | 当前 tab 使用的认证凭据 |

移除现有“记住登录信息”复选框。`serverUrl` 和 `baseDomain` 默认记住，API Key 永远不提供长期记住选项。

登录页初始化时：

1. 从 `localStorage` 恢复 `serverUrl`；
2. 从 `localStorage` 恢复 `baseDomain`；
3. API Key 输入框保持为空；
4. 如果当前 tab 的 `sessionStorage` 中已有 API Key，可以由现有路由守卫继续识别为已认证状态，不需要重新显示登录页。

## 浏览器存储边界

### Local Storage

仅保存非敏感连接配置：

```ts
interface Storage.Local {
  serverUrl: string
  baseDomain: string
  userInfo: Api.Login.Info
  lang: App.lang
}
```

`userInfo` 沿用现有行为，但不得包含 API Key。

### Session Storage

保存当前 tab 的认证状态：

```ts
interface Storage.Session {
  accessToken: string
}
```

API Key 的行为：

- 登录前先写入 `sessionStorage.accessToken`，以便验证请求携带认证头；
- 登录验证失败时立即删除；
- 登录验证成功后继续保留；
- 页面刷新时继续使用；
- 用户退出时删除；
- tab 关闭后由浏览器自动清除。

`refreshToken` 不再使用。Headscale API Key 没有本项目可执行的 refresh 流程，继续重复存储没有意义。

## 旧数据迁移

应用启动时执行一次幂等迁移。无论旧值是否存在，迁移都不得影响应用启动。

迁移规则：

1. 保留旧的 `serverUrl`；
2. 如果没有 `baseDomain`，使用空字符串；
3. 删除 `localStorage.accessToken`；
4. 删除 `localStorage.refreshToken`；
5. 删除完整的 `localStorage.loginAccount`，避免遗漏其中的 `pwd`；
6. 不把旧 API Key 迁移到 `sessionStorage`；
7. 用户升级后需要重新输入一次 API Key。

迁移逻辑每次启动都可以安全执行，避免增加单独的 migration version 状态。

## Base Domain 校验与标准化

`baseDomain` 可以为空。非空值在保存前执行：

1. 去除首尾空白字符；
2. 去除开头和末尾的点；
3. 转换为小写；
4. 按 DNS domain 规则校验。

允许的示例：

```text
example.internal
tailnet.example.com
```

输入：

```text
.EXAMPLE.Internal.
```

标准化结果：

```text
example.internal
```

拒绝的示例：

```text
https://example.internal
example.internal:443
example.internal/path
bad_domain.example
-invalid.example
invalid-.example
```

校验规则：

- 总长度不超过 253 个字符；
- 每个 label 长度为 1 至 63 个字符；
- label 只包含 ASCII 字母、数字和连字符；
- label 不能以连字符开头或结尾；
- 至少包含一个有效 label；
- 不接受协议、端口、路径、query 或 fragment。

本次不增加 IDN 自动转换。包含非 ASCII 字符的输入直接提示校验失败，避免浏览器展示值与实际 DNS 值不一致。

## 请求认证流程

Alova request instance 继续从当前连接配置构建：

- `baseURL` 从 `localStorage.serverUrl` 读取；
- `Authorization` header 从 `sessionStorage.accessToken` 读取。

登录流程：

1. 校验并标准化 `serverUrl` 和 `baseDomain`；
2. 将 `serverUrl`、`baseDomain` 写入 `localStorage`；
3. 将 API Key 写入 `sessionStorage.accessToken`；
4. 重新创建 request instance；
5. 请求 Headscale 用户接口验证连接；
6. 成功后进入系统；
7. 失败时清理 `sessionStorage.accessToken` 和登录状态，但保留 `serverUrl`、`baseDomain`。

退出流程：

1. 删除 `sessionStorage.accessToken`；
2. 删除当前用户信息和路由状态；
3. 保留 `serverUrl` 和 `baseDomain`；
4. 跳转登录页，API Key 输入框为空。

## 路由认证状态

`authStore.token` 和 `isLogin` 改为基于 `sessionStorage.accessToken`。

页面刷新后：

- 当前 tab 的 Session API Key 仍存在，路由守卫允许进入；
- request instance 从 Session API Key 恢复认证头。

新 tab 或关闭后重新打开：

- Session API Key 不存在；
- 路由守卫跳转登录页；
- 已保存的 `serverUrl` 和 `baseDomain` 自动填入；
- 用户重新输入 API Key。

## 节点完整域名

节点完整域名由以下字段组成：

```text
givenName + "." + baseDomain
```

拼接前对两部分做防御性处理：

- `givenName` 去除首尾空白和末尾的点；
- `baseDomain` 使用已标准化值；
- 任一值为空时不生成完整域名选项。

配置 `baseDomain` 时，复制菜单顺序为：

```text
node-name.example.internal
node-name
100.64.0.1
fd7a:115c:a1e0::1
```

未配置 `baseDomain` 时保持现有行为：

```text
node-name
100.64.0.1
fd7a:115c:a1e0::1
```

完整域名只影响复制选项，不改变表格当前显示的首个 IP 地址，也不修改 Headscale 返回的节点数据。

## 国际化

中英文语言文件增加：

- `Base Domain` 字段名称；
- 可选字段提示；
- 输入示例；
- 非法 domain 校验提示。

中文示例：

```text
Base Domain（可选）
例如：example.internal
请输入合法的 DNS domain，不要包含协议、端口或路径
```

英文示例：

```text
Base Domain (optional)
For example: example.internal
Enter a valid DNS domain without a protocol, port, or path
```

## 错误处理

- `baseDomain` 非法时，在登录请求发出前显示表单错误；
- 登录验证失败时，不删除已填写的连接配置；
- Session API Key 缺失时，不发送空的 `Bearer null` 或 `Bearer undefined`；
- 复制完整域名时，如果配置为空或数据异常，退化为现有节点名和 IP 选项；
- 旧数据迁移遇到格式异常时删除敏感字段，不阻塞页面启动。

## 测试策略

项目当前只有 release metadata 相关的 Node tests，没有前端单元测试环境。本次实现增加 `Vitest`、`@vue/test-utils` 和轻量 DOM environment，用于验证认证存储与 Vue 组件行为。测试配置必须与现有 Vite alias、Vue plugin 和 TypeScript 配置保持一致，不替换现有 release tests。

### 单元测试

覆盖：

- `baseDomain` 标准化；
- 空 `baseDomain`；
- 合法和非法 DNS domain；
- FQDN 拼接；
- API Key 只写入 `sessionStorage`；
- 请求头从 `sessionStorage` 读取；
- 认证失败和退出时清理 Session API Key；
- 旧 `localStorage` Token 清理；
- `serverUrl` 和 `baseDomain` 保留。

### 组件测试

覆盖：

- 登录页显示三个字段且没有“记住登录信息”；
- 已保存连接配置自动回填；
- API Key 不自动回填；
- 非法 `baseDomain` 阻止提交；
- 节点复制菜单在有、无 `baseDomain` 时的选项和顺序。

### 回归验证

运行新增前端测试与现有检查：

```shell
npm run test
npm run lint
npm run build:prod
npm run test:release
```

并验证：

1. 登录后刷新页面仍可使用；
2. 关闭 tab 后重新打开必须输入 API Key；
3. 浏览器 `localStorage` 中不存在 API Key；
4. 完整域名复制结果正确；
5. 不配置 `baseDomain` 时原有复制功能不变。

## 安全边界

`sessionStorage` 仍可被当前页面同源 JavaScript 访问，因此不能消除 XSS 对当前会话的影响。本设计的安全收益是：

- API Key 不跨浏览器会话长期持久化；
- API Key 不再重复保存在多个 Local Storage 字段；
- tab 关闭后凭据自动失效；
- 旧版持久化凭据会被清理。

彻底避免浏览器 JavaScript 接触 API Key 需要 BFF 和 `HttpOnly` Session Cookie，这不属于本次纯静态前端方案的范围。
