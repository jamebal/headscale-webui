# Headscale 兼容镜像标签实施计划

> **供自动化执行者使用：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，按任务逐项实施，并使用复选框跟踪进度。

**目标：** 让 Docker Hub 和 GHCR 的正式镜像同时携带 WebUI 版本与 Headscale 次版本兼容标签，并在未来升级到 `v0.29.x` 后继续保留可拉取的 `v0.25.x` 兼容镜像。

**架构：** `package.json` 保存 WebUI 版本和 Headscale 兼容系列，`scripts/release-metadata.mjs` 负责读取、校验并输出 GitHub Actions 环境变量。两个正式 registry 使用同一组 Workflow 环境变量生成四类标签与一致的 OCI metadata；README 明确生产环境应固定兼容标签。

**技术栈：** Node.js 22、Node.js Test Runner、GitHub Actions、Docker Buildx、Docker Hub、GHCR、Markdown

---

## 文件结构

- 修改 `package.json`：增加 `headscaleCompatibility`、发布配置测试命令，并限制 `lint-staged` 只处理 ESLint 支持的源码文件。
- 创建 `scripts/release-metadata.mjs`：读取并校验两个版本字段，输出 Workflow 可写入 `$GITHUB_ENV` 的内容。
- 创建 `tests/release-metadata.test.mjs`：覆盖版本格式、错误信息和环境变量输出。
- 创建 `tests/release-workflows.test.mjs`：静态验证正式与测试 Workflow 的版本入口、正式标签、metadata 和精确标签保护。
- 创建 `tests/release-docs.test.mjs`：验证中英文 README 的兼容说明和固定镜像标签保持一致。
- 修改 `.github/workflows/build.yml`：读取兼容版本、保护精确标签并发布四类正式标签与 metadata。
- 修改 `.github/workflows/test-build.yml`：复用版本校验，但继续只发布 `test`。
- 修改 `README.md`：说明英文版兼容范围、标签语义和升级规则。
- 修改 `README.zh-CN.md`：说明中文版兼容范围、标签语义和升级规则。

### 任务 1：修正 staged 文件检查范围

**文件：**

- 修改：`package.json:78-80`

- [ ] **步骤 1：运行失败断言，复现 Markdown 被 ESLint 处理的问题**

运行：

```bash
node -e "const p=require('./package.json'); if (p['lint-staged']['*']) throw new Error('lint-staged 仍会把 Markdown 交给 ESLint')"
```

预期：命令失败并输出 `lint-staged 仍会把 Markdown 交给 ESLint`。

- [ ] **步骤 2：将 ESLint 限定到受支持的源码扩展名**

把 `package.json` 中的配置修改为：

```json
"lint-staged": {
  "*.{js,jsx,ts,tsx,vue,mjs,cjs}": "eslint --fix"
}
```

- [ ] **步骤 3：重新运行配置断言**

运行：

```bash
node -e "const p=require('./package.json'); const c=p['lint-staged']; if (c['*'] || c['*.{js,jsx,ts,tsx,vue,mjs,cjs}'] !== 'eslint --fix') process.exit(1); console.log('lint-staged 匹配范围正确')"
```

预期：输出 `lint-staged 匹配范围正确`。

- [ ] **步骤 4：验证 Markdown staged diff 不再触发 ESLint 解析错误**

运行：

```bash
npm exec lint-staged -- --diff HEAD
```

预期：命令成功；Markdown 文件不会传给 `eslint --fix`。

- [ ] **步骤 5：提交配置修正**

```bash
git add package.json
git commit -m "fix: 限制 staged 源码检查范围"
```

### 任务 2：建立可测试的发布版本信息入口

**文件：**

- 修改：`package.json:2-5,23-35`
- 创建：`scripts/release-metadata.mjs`
- 创建：`tests/release-metadata.test.mjs`

- [ ] **步骤 1：编写版本信息失败测试**

创建 `tests/release-metadata.test.mjs`：

```js
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  formatGitHubEnvironment,
  validateReleaseMetadata,
} from '../scripts/release-metadata.mjs'

test('接受 WebUI 三段版本和 Headscale 两段兼容版本', () => {
  assert.deepEqual(
    validateReleaseMetadata({
      version: '0.0.1',
      headscaleCompatibility: '0.25',
    }),
    {
      projectVersion: '0.0.1',
      headscaleCompatibility: '0.25',
    },
  )
})

test('拒绝缺少或格式错误的 WebUI 版本', () => {
  assert.throws(
    () => validateReleaseMetadata({ headscaleCompatibility: '0.25' }),
    /package.json version 必须是三段数字版本/,
  )
  assert.throws(
    () => validateReleaseMetadata({ version: 'v0.0.1', headscaleCompatibility: '0.25' }),
    /package.json version 必须是三段数字版本/,
  )
})

test('拒绝缺少或格式错误的 Headscale 兼容版本', () => {
  assert.throws(
    () => validateReleaseMetadata({ version: '0.0.1' }),
    /package.json headscaleCompatibility 必须是两段数字版本/,
  )
  assert.throws(
    () => validateReleaseMetadata({ version: '0.0.1', headscaleCompatibility: '0.25.0' }),
    /package.json headscaleCompatibility 必须是两段数字版本/,
  )
})

test('生成 GitHub Actions 环境变量', () => {
  assert.equal(
    formatGitHubEnvironment({
      projectVersion: '0.0.1',
      headscaleCompatibility: '0.25',
    }),
    'PROJECT_VERSION=0.0.1\nHEADSCALE_COMPATIBILITY=0.25',
  )
})
```

- [ ] **步骤 2：运行测试并确认缺少实现**

运行：

```bash
node --test tests/release-metadata.test.mjs
```

预期：失败，错误包含 `Cannot find module` 和 `scripts/release-metadata.mjs`。

- [ ] **步骤 3：实现版本读取、校验和输出**

创建 `scripts/release-metadata.mjs`：

```js
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function validateReleaseMetadata(packageJson) {
  if (!/^\d+\.\d+\.\d+$/.test(packageJson.version ?? '')) {
    throw new Error('package.json version 必须是三段数字版本，例如 0.0.1')
  }

  if (!/^\d+\.\d+$/.test(packageJson.headscaleCompatibility ?? '')) {
    throw new Error('package.json headscaleCompatibility 必须是两段数字版本，例如 0.25')
  }

  return {
    projectVersion: packageJson.version,
    headscaleCompatibility: packageJson.headscaleCompatibility,
  }
}

export function readReleaseMetadata(packageJsonUrl = new URL('../package.json', import.meta.url)) {
  const packageJson = JSON.parse(readFileSync(packageJsonUrl, 'utf8'))
  return validateReleaseMetadata(packageJson)
}

export function formatGitHubEnvironment(metadata) {
  return [
    `PROJECT_VERSION=${metadata.projectVersion}`,
    `HEADSCALE_COMPATIBILITY=${metadata.headscaleCompatibility}`,
  ].join('\n')
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.stdout.write(`${formatGitHubEnvironment(readReleaseMetadata())}\n`)
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
```

- [ ] **步骤 4：声明当前 Headscale 兼容系列和测试命令**

在 `package.json` 的 `version` 后增加：

```json
"headscaleCompatibility": "0.25",
```

在 `scripts` 中增加：

```json
"test:release": "node --test tests/release-*.test.mjs",
```

- [ ] **步骤 5：运行单元测试和真实配置输出**

运行：

```bash
npm run test:release
node scripts/release-metadata.mjs
```

预期：四个单元测试全部通过，随后输出：

```text
PROJECT_VERSION=0.0.1
HEADSCALE_COMPATIBILITY=0.25
```

- [ ] **步骤 6：提交版本信息入口**

```bash
git add package.json scripts/release-metadata.mjs tests/release-metadata.test.mjs
git commit -m "build: 增加 Headscale 兼容版本元数据"
```

### 任务 3：让两个 Workflow 使用兼容版本标签

**文件：**

- 创建：`tests/release-workflows.test.mjs`
- 修改：`.github/workflows/build.yml:1-68`
- 修改：`.github/workflows/test-build.yml:1-66`

- [ ] **步骤 1：编写 Workflow 配置失败测试**

创建 `tests/release-workflows.test.mjs`：

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const buildWorkflow = readFileSync(new URL('../.github/workflows/build.yml', import.meta.url), 'utf8')
const testWorkflow = readFileSync(new URL('../.github/workflows/test-build.yml', import.meta.url), 'utf8')

test('正式 Workflow 通过统一脚本读取版本信息', () => {
  assert.match(buildWorkflow, /node scripts\/release-metadata\.mjs >> "\$GITHUB_ENV"/)
  assert.doesNotMatch(buildWorkflow, /require\('\.\/package\.json'\)\.version/)
})

test('正式 Workflow 生成四类镜像标签', () => {
  for (const tag of [
    'jmal/headscale-webui:${{ env.PROJECT_VERSION }}-hs${{ env.HEADSCALE_COMPATIBILITY }}',
    'jmal/headscale-webui:${{ env.PROJECT_VERSION }}',
    'jmal/headscale-webui:hs${{ env.HEADSCALE_COMPATIBILITY }}',
    'jmal/headscale-webui:latest',
    'ghcr.io/${{ secrets.GHCR_IO_USERNAME }}/headscale-webui:${{ env.PROJECT_VERSION }}-hs${{ env.HEADSCALE_COMPATIBILITY }}',
    'ghcr.io/${{ secrets.GHCR_IO_USERNAME }}/headscale-webui:${{ env.PROJECT_VERSION }}',
    'ghcr.io/${{ secrets.GHCR_IO_USERNAME }}/headscale-webui:hs${{ env.HEADSCALE_COMPATIBILITY }}',
    'ghcr.io/${{ secrets.GHCR_IO_USERNAME }}/headscale-webui:latest',
  ]) {
    assert.ok(buildWorkflow.includes(tag), `缺少正式镜像标签：${tag}`)
  }
})

test('正式 Workflow 写入版本 metadata 并保护精确标签', () => {
  assert.match(buildWorkflow, /org\.opencontainers\.image\.version=\$\{\{ env\.PROJECT_VERSION \}\}/)
  assert.match(buildWorkflow, /io\.github\.jamebal\.headscale-webui\.headscale\.compatibility=\$\{\{ env\.HEADSCALE_COMPATIBILITY \}\}/)
  assert.match(buildWorkflow, /docker manifest inspect/)
  assert.match(buildWorkflow, /精确镜像标签已存在/)
  assert.match(buildWorkflow, /platforms: linux\/amd64,linux\/arm64/)
})

test('测试 Workflow 校验版本但只推送 test 标签', () => {
  assert.match(testWorkflow, /node scripts\/release-metadata\.mjs >> "\$GITHUB_ENV"/)
  assert.match(testWorkflow, /jmal\/headscale-webui:test/)
  assert.match(testWorkflow, /ghcr\.io\/\$\{\{ secrets\.GHCR_IO_USERNAME \}\}\/headscale-webui:test/)
  assert.match(testWorkflow, /org\.opencontainers\.image\.version=\$\{\{ env\.PROJECT_VERSION \}\}/)
  assert.match(testWorkflow, /io\.github\.jamebal\.headscale-webui\.headscale\.compatibility=\$\{\{ env\.HEADSCALE_COMPATIBILITY \}\}/)
  assert.doesNotMatch(testWorkflow, /headscale-webui:latest/)
  assert.doesNotMatch(testWorkflow, /headscale-webui:hs\$\{\{/)
})
```

- [ ] **步骤 2：运行测试并确认现有 Workflow 不满足新规则**

运行：

```bash
npm run test:release
```

预期：`release-metadata` 测试通过，`release-workflows` 测试失败并指出缺少统一脚本或兼容标签。

- [ ] **步骤 3：修改正式 Workflow 的触发器和版本读取步骤**

将 `.github/workflows/build.yml` 顶部触发器改为：

```yaml
on:
  workflow_dispatch:
  release:
    types: [published]
```

删除原来的 `Extract project version from package.json` 步骤。在 `Set up Node.js 20.14.0` 之后、安装依赖之前增加：

```yaml
      - name: 验证发布版本信息
        run: node scripts/release-metadata.mjs >> "$GITHUB_ENV"
```

- [ ] **步骤 4：在 registry 登录后保护精确组合标签**

在 `.github/workflows/build.yml` 的两个登录步骤之后增加：

```yaml
      - name: 检查精确镜像标签未被占用
        shell: bash
        run: |
          exact_tag="${PROJECT_VERSION}-hs${HEADSCALE_COMPATIBILITY}"
          images=(
            "jmal/headscale-webui"
            "ghcr.io/${{ secrets.GHCR_IO_USERNAME }}/headscale-webui"
          )
          for image in "${images[@]}"; do
            if docker manifest inspect "${image}:${exact_tag}" >/dev/null 2>&1; then
              echo "::error::精确镜像标签已存在：${image}:${exact_tag}，请提升 WebUI 版本后重新发布"
              exit 1
            fi
          done
```

- [ ] **步骤 5：生成正式标签与镜像 metadata**

把正式构建步骤的 `tags` 改为每行一个标签：

```yaml
          tags: |
            jmal/headscale-webui:${{ env.PROJECT_VERSION }}-hs${{ env.HEADSCALE_COMPATIBILITY }}
            jmal/headscale-webui:${{ env.PROJECT_VERSION }}
            jmal/headscale-webui:hs${{ env.HEADSCALE_COMPATIBILITY }}
            jmal/headscale-webui:latest
            ghcr.io/${{ secrets.GHCR_IO_USERNAME }}/headscale-webui:${{ env.PROJECT_VERSION }}-hs${{ env.HEADSCALE_COMPATIBILITY }}
            ghcr.io/${{ secrets.GHCR_IO_USERNAME }}/headscale-webui:${{ env.PROJECT_VERSION }}
            ghcr.io/${{ secrets.GHCR_IO_USERNAME }}/headscale-webui:hs${{ env.HEADSCALE_COMPATIBILITY }}
            ghcr.io/${{ secrets.GHCR_IO_USERNAME }}/headscale-webui:latest
          labels: |
            org.opencontainers.image.version=${{ env.PROJECT_VERSION }}
            io.github.jamebal.headscale-webui.headscale.compatibility=${{ env.HEADSCALE_COMPATIBILITY }}
```

保留现有的 `platforms: linux/amd64,linux/arm64` 和 `build-args`。

- [ ] **步骤 6：让测试 Workflow 复用版本校验**

删除 `.github/workflows/test-build.yml` 原有的 `Extract project version from package.json` 步骤，在 Node.js setup 之后增加：

```yaml
      - name: 验证发布版本信息
        run: node scripts/release-metadata.mjs >> "$GITHUB_ENV"
```

保留且仅保留两个 `test` 镜像标签；为测试镜像增加与正式镜像相同的 `labels`：

```yaml
          labels: |
            org.opencontainers.image.version=${{ env.PROJECT_VERSION }}
            io.github.jamebal.headscale-webui.headscale.compatibility=${{ env.HEADSCALE_COMPATIBILITY }}
```

- [ ] **步骤 7：运行 Workflow 测试和 YAML 语法解析**

运行：

```bash
npm run test:release
ruby -e "require 'yaml'; %w[.github/workflows/build.yml .github/workflows/test-build.yml].each { |file| YAML.parse_file(file) }; puts 'Workflow YAML 语法正确'"
```

预期：所有发布配置测试通过，并输出 `Workflow YAML 语法正确`。

- [ ] **步骤 8：提交 Workflow 调整**

```bash
git add .github/workflows/build.yml .github/workflows/test-build.yml tests/release-workflows.test.mjs
git commit -m "ci: 发布 Headscale 兼容镜像标签"
```

### 任务 4：同步中英文部署与升级文档

**文件：**

- 创建：`tests/release-docs.test.mjs`
- 修改：`README.md:1-45`
- 修改：`README.zh-CN.md:1-47`

- [ ] **步骤 1：编写 README 一致性失败测试**

创建 `tests/release-docs.test.mjs`：

```js
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')
const readmeZh = readFileSync(new URL('../README.zh-CN.md', import.meta.url), 'utf8')

test('中英文 README 都声明 Headscale 0.25.x 兼容系列', () => {
  assert.match(readme, /Headscale v0\.25\.x/)
  assert.match(readmeZh, /Headscale `v0\.25\.x`/)
})

test('中英文 Docker Compose 都固定 hs0.25 标签', () => {
  assert.match(readme, /image: jmal\/headscale-webui:hs0\.25/)
  assert.match(readmeZh, /image: jmal\/headscale-webui:hs0\.25/)
})

test('中英文 README 都警告 latest 不保证旧版本兼容', () => {
  assert.match(readme, /`latest` does not guarantee compatibility/)
  assert.match(readmeZh, /`latest` 不保证兼容旧版 Headscale/)
})

test('中英文 README 都记录精确组合标签', () => {
  assert.match(readme, /`0\.0\.1-hs0\.25`/)
  assert.match(readmeZh, /`0\.0\.1-hs0\.25`/)
})
```

- [ ] **步骤 2：运行测试并确认现有 README 未固定兼容标签**

运行：

```bash
npm run test:release
```

预期：metadata 与 Workflow 测试通过，README 测试失败并指出缺少 `hs0.25` 或 `latest` 警告。

- [ ] **步骤 3：修改英文兼容与镜像标签说明**

将 `README.md` 顶部兼容声明改为：

```markdown
Supported Headscale series: `v0.25.x`.

Docker image tags include both the WebUI version and the compatible Headscale series:

- `0.0.1-hs0.25`: immutable WebUI and Headscale compatibility combination.
- `hs0.25`: latest WebUI release compatible with Headscale `v0.25.x`.
- `latest`: latest WebUI release; `latest` does not guarantee compatibility with older Headscale versions.

Pin `0.0.1-hs0.25` for reproducible deployments, or `hs0.25` to receive WebUI fixes that retain Headscale `v0.25.x` compatibility. Check the compatibility tag before upgrading Headscale.
```

把英文 Docker Compose 示例的镜像改为：

```yaml
image: jmal/headscale-webui:hs0.25
```

- [ ] **步骤 4：修改中文兼容与镜像标签说明**

将 `README.zh-CN.md` 顶部兼容声明改为：

```markdown
支持的 Headscale 系列：`v0.25.x`。

Docker 镜像标签同时表达 WebUI 版本和兼容的 Headscale 系列：

- `0.0.1-hs0.25`：固定的 WebUI 与 Headscale 兼容版本组合。
- `hs0.25`：兼容 Headscale `v0.25.x` 的最新 WebUI。
- `latest`：最新 WebUI；`latest` 不保证兼容旧版 Headscale。

需要可复现部署时固定使用 `0.0.1-hs0.25`；需要接收仍兼容 Headscale `v0.25.x` 的 WebUI 修复时使用 `hs0.25`。升级 Headscale 前必须先核对兼容标签。
```

把中文 Docker Compose 示例的镜像改为：

```yaml
image: jmal/headscale-webui:hs0.25
```

- [ ] **步骤 5：运行 README 与全部发布配置测试**

运行：

```bash
npm run test:release
```

预期：全部测试通过，无失败或跳过项。

- [ ] **步骤 6：提交文档调整**

```bash
git add README.md README.zh-CN.md tests/release-docs.test.mjs
git commit -m "docs: 说明 Headscale 镜像兼容标签"
```

### 任务 5：执行完整验证并准备首次 v0.25 发布

**文件：**

- 验证：`package.json`
- 验证：`scripts/release-metadata.mjs`
- 验证：`.github/workflows/build.yml`
- 验证：`.github/workflows/test-build.yml`
- 验证：`README.md`
- 验证：`README.zh-CN.md`

- [ ] **步骤 1：执行发布配置测试**

运行：

```bash
npm run test:release
```

预期：所有 `release-*.test.mjs` 测试通过。

- [ ] **步骤 2：执行项目静态检查和生产构建**

运行：

```bash
npm run lint
npm run build:prod
```

预期：ESLint、TypeScript 检查和 Vite 生产构建全部成功。

- [ ] **步骤 3：检查最终 diff 和版本输出**

运行：

```bash
node scripts/release-metadata.mjs
git diff --check
git status --short
```

预期：版本输出为 `PROJECT_VERSION=0.0.1` 和 `HEADSCALE_COMPATIBILITY=0.25`；`git diff --check` 无输出；工作区只包含计划内文件，或者在前述提交完成后保持干净。

- [ ] **步骤 4：合并后手动触发首次正式镜像构建**

在 GitHub Actions 中手动运行 `Build Docker Image`。这是外部发布动作，执行者必须得到仓库维护者明确授权并确认以下条件后才能触发：

```text
package.json version = 0.0.1
package.json headscaleCompatibility = 0.25
目标代码仍兼容 Headscale v0.25.x
Docker Hub 与 GHCR secrets 均有效
```

预期：Docker Hub 和 GHCR 均生成 `0.0.1-hs0.25`、`0.0.1`、`hs0.25`、`latest`，且两个架构 manifest 均存在。

- [ ] **步骤 5：验证首次发布结果**

运行：

```bash
docker buildx imagetools inspect jmal/headscale-webui:0.0.1-hs0.25
docker buildx imagetools inspect jmal/headscale-webui:hs0.25
docker buildx imagetools inspect ghcr.io/jamebal/headscale-webui:0.0.1-hs0.25
docker buildx imagetools inspect ghcr.io/jamebal/headscale-webui:hs0.25
```

预期：四条命令均成功，并显示 `linux/amd64` 与 `linux/arm64` manifest。若实际 GHCR owner 与 `jamebal` 不同，使用 `GHCR_IO_USERNAME` 对应的 owner 替换命令中的 `jamebal`。

## 后续升级到 Headscale v0.29.x

Headscale `v0.29.x` API 适配不属于本计划范围，因为只有对比对应 Headscale API 并验证真实服务后，才能确定需要修改的业务文件。届时必须先为 API 适配建立独立设计和实施计划；不得仅修改镜像标签就宣称兼容。

API 适配验证通过后，发布步骤固定为：

1. 把 `package.json` 更新为新的 WebUI Release，例如：

```json
"version": "0.1.0",
"headscaleCompatibility": "0.29",
```

2. 将 `README.md`、`README.zh-CN.md` 和 `tests/release-docs.test.mjs` 中的当前发布值更新为 `0.1.0-hs0.29`、`hs0.29` 和 `v0.29.x`。
3. 运行完整验证：

```bash
npm run test:release
npm run lint
npm run build:prod
```

4. 全部通过且获得维护者授权后，发布 `0.1.0-hs0.29`、`0.1.0`、`hs0.29` 和新的 `latest`。
5. 保留现有 `0.0.1-hs0.25` 与 `hs0.25`，不移动、不删除。
