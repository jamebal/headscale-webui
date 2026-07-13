# Headscale 兼容镜像标签设计

## 目标

让 Headscale WebUI 镜像同时表达 WebUI 自身版本和兼容的 Headscale 次版本系列，并保证 Docker Hub 与 GHCR 在并发、失败和重跑场景下得到同一份不可变发布结果。

当前发布版本为 WebUI `0.0.6`，兼容 Headscale `v0.25.x`。`package.json` 是这两个版本字段的唯一来源：

```json
"version": "0.0.6",
"headscaleCompatibility": "0.25"
```

`version` 必须是三段数字版本，`headscaleCompatibility` 必须是两段数字系列。Headscale patch 版本不进入兼容标签。

## 正式镜像标签

Docker Hub 与 GHCR 最终都必须包含以下四类标签：

```text
0.0.6-hs0.25
0.0.6
hs0.25
latest
```

- `0.0.6-hs0.25` 是不可移动的精确组合标签。
- `0.0.6` 是不可移动的 WebUI 项目版本标签。
- `hs0.25` 是当前 Headscale 兼容系列的可移动别名。
- `latest` 是最新正式 Release 的可移动别名。

生产部署应固定使用 `hs0.25`，需要完全可复现时固定使用 `0.0.6-hs0.25`。`latest` 不保证兼容用户当前运行的 Headscale。

## 分阶段发布

正式 Workflow 不直接把四类正式标签交给 build-push action。构建阶段只向两个 registry 推送本次 commit 的临时 staging 标签：

```text
jmal/headscale-webui:build-${GITHUB_SHA}
ghcr.io/<owner>/headscale-webui:build-${GITHUB_SHA}
```

多架构 index 必须包含 `linux/amd64`、`linux/arm64`，并携带以下 metadata：

- `org.opencontainers.image.version=0.0.6`
- `io.github.jamebal.headscale-webui.headscale.compatibility=0.25`
- `org.opencontainers.image.revision=${GITHUB_SHA}`
- index annotation `org.opencontainers.image.revision=${GITHUB_SHA}`

staging 构建成功后，`scripts/promote-image-tags.mjs` 一次协调 Docker Hub 与 GHCR，将经过校验的 digest 提升为正式标签。

## 并发与 fail-closed

Workflow 使用固定 concurrency group `headscale-webui-release`，且不取消正在执行的发布。这样同一时间最多只有一个正式 promotion 修改 aliases。

promotion 通过以下命令读取 manifest：

```text
docker buildx imagetools inspect REF --format '{{json .Manifest}}'
```

只有 stdout 为空，并且 trim 后的 stderr 精确等于以下三种与规范化完整 ref 绑定的标准格式之一，才可判定标签不存在：

1. `ERROR: <normalized-full-ref>: not found`。
2. `ERROR: <normalized-full-ref>: manifest unknown`。
3. `ERROR: <normalized-full-ref>: manifest unknown: manifest unknown`。

其他任何 stdout 或 stderr 输出都必须 fail-closed。

Docker Hub 的短 image 必须先规范化为 `docker.io/...`。401、403、429、DNS、TLS、credential helper、Docker executable 缺失和任意无法绑定 ref 的裸 `not found` 都属于检查失败，promotion 必须立即停止。

## Canonical 校验

任何 staging 或 existing exact 要成为 canonical，必须同时满足：

- digest 是完整 `sha256` 格式。
- index revision annotation 等于本次 Git SHA。
- manifest 至少包含 `linux/amd64` 与 `linux/arm64`。
- 可包含额外的 `unknown/unknown` attestation manifest。

所有 `imagetools create` 的 source 必须使用 `IMAGE@sha256:...`，禁止 mutable tag source。

## 可恢复状态机

在创建任何 exact 前，promotion 先检查两侧 exact 与 project 标签。

### 已有 exact

- 校验已有 exact 的 revision、平台和 digest。
- 两侧 exact 都存在时，其 digest 必须完全一致。
- 仅一侧 exact 存在时，以该 exact 的 digest-pinned ref 为 canonical source，只补齐另一侧 exact。
- project 已存在时只能等于 canonical digest，否则失败。

这条路径支持 Docker exact 已成功但 GHCR exact 失败后的安全重跑，也支持对称恢复。不同 revision 不能复用相同 exact。

### 首次建立 exact

- 两侧 exact 均不存在时，两侧 project 也必须均不存在。
- 校验两侧 staging 的 revision、平台和 digest；digest 必须一致。
- 先从 Docker staging digest 单独创建 Docker exact，并重新 inspect。
- 再从已确认的 Docker canonical digest 跨 registry 单独创建 GHCR exact。

exact 必须先落盘并重新校验。只有两侧 exact revision、平台和 digest 完全一致后，才能处理 aliases。

### 提升 aliases

每个 registry 分别从自身 `exact-image@canonicalDigest` 创建 project、`hs0.25` 与 `latest`。exact 不包含在 alias create 中，因此同 revision 重跑不会移动 exact。project 不存在或已经等于 canonical 才能继续；`hs0.25` 与 `latest` 允许移动到本次 canonical。

promotion 最后重新 inspect 两个 registry 的 exact、project、兼容标签和 latest。八个标签必须都等于 canonical digest，且 revision 与平台仍正确。create 或 post verification 的任何错误都会让发布失败；部分 aliases 成功后可通过同 revision 重跑补齐。

## 测试镜像

`.github/workflows/test-build.yml` 继续只发布两个 `test` 标签，并复用版本校验与现有版本 labels。测试 Workflow 不运行正式 promotion，不创建 exact、project、兼容或 latest 标签。

## 验证标准

1. 本地版本入口输出 `PROJECT_VERSION=0.0.6` 与 `HEADSCALE_COMPATIBILITY=0.25`。
2. promotion 单测只使用注入的 fake Docker runner，不访问 registry。
3. 首次发布、同 revision 重跑、单侧 exact 恢复和 aliases 部分恢复均通过。
4. revision、平台或 digest 冲突，以及认证、限流和网络错误均 fail-closed。
5. Workflow 只构建两个 staging 标签，并在其后调用双仓库 promotion CLI。
6. 最终 Docker Hub 与 GHCR 均包含 `0.0.6-hs0.25`、`0.0.6`、`hs0.25`、`latest`。

## 非目标

- 不为每个 Headscale patch 版本建立单独标签。
- 不维护长期版本分支。
- 不在本次改动中适配 Headscale `v0.29.x` API。
- 不改变 Dockerfile、Nginx 配置或前端运行方式。
- 不自动探测用户部署的 Headscale 服务端版本。
