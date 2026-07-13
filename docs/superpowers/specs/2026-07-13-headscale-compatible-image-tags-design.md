# Headscale 兼容镜像标签设计

## 目标

让发布的 Headscale WebUI 镜像同时表达 WebUI 自身版本和兼容的 Headscale 次版本系列，确保以后升级到 Headscale `v0.29.x` 时，兼容 `v0.25.x` 的镜像仍可被明确拉取，不会因 `latest` 被覆盖而丢失。

## 当前状态

- `package.json` 仅声明 WebUI 版本 `0.0.1`，没有机器可读的 Headscale 兼容版本。
- `README.md` 和 `README.zh-CN.md` 仅以文字声明支持 Headscale `v0.25.0`。
- `.github/workflows/build.yml` 只发布 `${PROJECT_VERSION}` 和 `latest` 标签。
- `.github/workflows/test-build.yml` 只发布 `test` 标签。
- Docker Hub 与 GHCR 的正式镜像都无法从现有标签判断 Headscale 兼容范围。

## 版本来源

在 `package.json` 顶层增加：

```json
"headscaleCompatibility": "0.25"
```

两个版本字段各自承担单一职责：

- `version` 表示 Headscale WebUI 的 Semantic Version，例如 `0.0.1`。
- `headscaleCompatibility` 表示支持的 Headscale 次版本系列，例如 `0.25`，含义为兼容 `v0.25.x`。

Headscale patch 版本不进入兼容标签。只有确认 patch 版本存在 API 不兼容时，才另行调整本设计。

## 正式镜像标签

每次正式发布同时向 Docker Hub 和 GHCR 推送四类标签。以 WebUI `0.0.1`、Headscale `0.25` 为例：

```text
0.0.1-hs0.25
0.0.1
hs0.25
latest
```

标签语义如下：

- `0.0.1-hs0.25` 是精确组合标签，发布后不得移动或覆盖。
- `0.0.1` 是该 WebUI Release 的简写标签，发布后不得移动或覆盖。
- `hs0.25` 指向仍兼容 Headscale `v0.25.x` 的最新 WebUI，可在该兼容系列内随 WebUI 修复版本移动。
- `latest` 指向项目最新正式 Release，不承诺兼容旧版 Headscale。

Docker Hub 与 GHCR 必须生成完全一致的标签集合。

## 升级流程

首次启用新规则时，必须先以当前代码和以下版本信息发布兼容 Headscale `v0.25.x` 的镜像：

```text
version: 0.0.1
headscaleCompatibility: 0.25
```

这一步会建立并保留 `0.0.1-hs0.25` 与 `hs0.25`。

以后代码调整为仅支持 Headscale `v0.29.x` 时：

1. 完成并验证 Headscale `v0.29.x` API 适配。
2. 将 WebUI `version` 提升到新的版本，例如 `0.1.0`。
3. 将 `headscaleCompatibility` 修改为 `0.29`。
4. 更新中英文 README 的兼容说明和 Docker Compose 示例。
5. 发布后生成 `0.1.0-hs0.29`、`0.1.0`、`hs0.29` 和新的 `latest`。
6. 不再更新 `hs0.25`，但保留该标签及精确组合标签供旧环境使用。

## Workflow 调整

`.github/workflows/build.yml` 在构建前从 `package.json` 提取两个版本字段，并执行格式校验：

- WebUI 版本必须匹配三段数字格式，例如 `0.0.1`。
- Headscale 兼容版本必须匹配两段数字格式，例如 `0.25`。
- 任一字段缺失或格式错误时，Workflow 必须停止，不得登录镜像仓库或推送部分标签。

校验成功后，Workflow 为 Docker Hub 和 GHCR 分别生成四个正式标签。现有多架构构建范围 `linux/amd64,linux/arm64` 保持不变。

`.github/workflows/test-build.yml` 继续只发布 `test`，但构建时同样读取并校验兼容版本，避免主分支长期存在无效发布配置。

## 镜像元数据

正式镜像增加以下 metadata：

- 标准 OCI `org.opencontainers.image.version` 保存 WebUI 版本。
- 自定义 `io.github.jamebal.headscale-webui.headscale.compatibility` 保存 Headscale 兼容系列。

镜像标签用于拉取与部署，metadata 用于自动检查和排障。两者必须来自同一组 `package.json` 字段，避免信息漂移。

## 文档调整

中英文 README 应同时说明：

- `latest` 只代表最新 WebUI，不保证兼容用户当前运行的 Headscale。
- 生产部署应固定使用 `hs0.25` 或更严格的 `0.0.1-hs0.25`。
- Docker Compose 示例不再使用无标签镜像，因为无标签等价于 `latest`。
- 升级 Headscale 前，应先核对镜像的 `hsX.Y` 兼容标签。

当前 Docker Compose 示例固定为：

```yaml
image: jmal/headscale-webui:hs0.25
```

## 验证标准

1. 本地校验能够从 `package.json` 读取 `0.0.1` 与 `0.25`。
2. Workflow 语法有效，正式发布事件和手动触发均可生成同一组标签。
3. Docker Hub 标签集合包含 `0.0.1-hs0.25`、`0.0.1`、`hs0.25` 和 `latest`。
4. GHCR 标签集合与 Docker Hub 一致。
5. 构建产物继续包含 `linux/amd64` 和 `linux/arm64` manifest。
6. 镜像 metadata 中的 WebUI 和 Headscale 版本与标签一致。
7. 中英文 README 的版本说明、标签示例和 Docker Compose 示例一致。
8. 测试镜像仍只使用 `test`，不会覆盖任何正式版本标签。

## 错误处理

- 版本字段无效时，在构建和推送之前失败，并输出具体字段名。
- 任一 registry 登录或推送失败时，Workflow 整体失败，不宣称 Release 镜像发布完成。
- 如果同一精确组合标签已经存在，发布流程不得把不同代码覆盖到该标签；应提升 WebUI 版本后重新发布。
- 如果 Headscale 新版本适配尚未验证，不得提前移动 `latest` 或创建对应的 `hsX.Y` 标签。

## 非目标

- 不为每个 Headscale patch 版本建立单独标签。
- 不维护 `headscale-0.25`、`headscale-0.29` 等长期代码分支。
- 不在本次改动中实现 Headscale `v0.29.x` API 适配。
- 不改变 Dockerfile、Nginx 配置或前端运行方式。
- 不自动探测用户部署的 Headscale 服务端版本。
