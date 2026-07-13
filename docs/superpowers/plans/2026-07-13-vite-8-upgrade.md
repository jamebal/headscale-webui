# Vite 8 构建链升级实施计划

> **供 agentic workers 使用：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`，逐项执行本计划。步骤使用 checkbox（`- [ ]`）跟踪。

**目标：** 将项目构建链升级到 Vite 8.1.x 及其兼容插件版本，统一使用 Node.js 22.23.1 和 npm，并通过开发、构建与 lint 验证。

**架构：** 保持现有 Vue SPA、Vite 配置和 plugin 组合不变，仅更新构建工具版本与 npm lockfile。先用现有失败状态建立 RED 基线，再更新依赖并用相同命令完成 GREEN 验证；只有确定的新版 API 不兼容才允许最小修改 `build/plugins.ts` 或 `vite.config.ts`。

**技术栈：** Node.js 22.23.1、npm 10.9.8、Vite 8.1.x、Vue 3、UnoCSS 66.x、TypeScript、ESLint

---

## 文件结构

- 修改：`package.json`——升级 Vite 构建链、固定 Node.js 版本、将 pre-commit 命令统一为 npm。
- 创建：`package-lock.json`——记录 npm 的完整、可复现依赖树。
- 条件修改：`build/plugins.ts`——仅在新版 plugin API 出现确定错误时做最小兼容调整。
- 条件修改：`vite.config.ts`——仅在 Vite 8 配置 API 出现确定错误时做最小兼容调整。

### 任务 1：建立升级前失败基线

**文件：**

- 检查：`package.json:52-83`

- [ ] **步骤 1：确认指定 Node.js binary 可用**

运行：

```bash
/Users/jmal/.nvm/versions/node/v22.23.1/bin/node --version
/Users/jmal/.nvm/versions/node/v22.23.1/bin/npm --version
```

预期：分别输出 `v22.23.1` 和 `10.9.8`。

- [ ] **步骤 2：运行开发命令确认升级前状态失败**

运行：

```bash
PATH=/Users/jmal/.nvm/versions/node/v22.23.1/bin:$PATH npm run dev
```

预期：由于尚未按 `package.json` 安装 npm 依赖而失败，或暴露旧 plugin 与 Vite 8 的兼容错误；完整保存错误内容作为 RED 基线。

### 任务 2：更新构建链声明

**文件：**

- 修改：`package.json:52-83`

- [ ] **步骤 1：将构建依赖更新为兼容版本**

将相关字段改为：

```json
{
  "devDependencies": {
    "@types/node": "^22.20.1",
    "@vitejs/plugin-vue": "^6.0.7",
    "@vitejs/plugin-vue-jsx": "^5.1.6",
    "unocss": "^66.7.5",
    "unplugin-auto-import": "^21.0.0",
    "unplugin-icons": "^23.0.1",
    "unplugin-vue-components": "^32.1.0",
    "vite": "^8.1.4",
    "vite-plugin-vue-devtools": "^8.1.5"
  },
  "simple-git-hooks": {
    "pre-commit": "npm exec lint-staged"
  },
  "volta": {
    "node": "22.23.1"
  }
}
```

保留上述片段未列出的现有依赖，不改动用户已有的 `vue-i18n: 11.1.10`。

- [ ] **步骤 2：检查 JSON 与变更范围**

运行：

```bash
/Users/jmal/.nvm/versions/node/v22.23.1/bin/node -e "JSON.parse(require('node:fs').readFileSync('package.json', 'utf8')); console.log('package.json 有效')"
git diff -- package.json
```

预期：输出 `package.json 有效`；diff 仅包含用户已有的 `vue-i18n` 变更、本次构建依赖、pre-commit 和 Node.js 版本变更。

### 任务 3：使用 npm 生成可复现依赖树

**文件：**

- 创建：`package-lock.json`
- 生成但不提交：`node_modules/`

- [ ] **步骤 1：确认没有残留 pnpm lockfile**

运行：

```bash
test ! -f pnpm-lock.yaml
```

预期：退出码为 0。

- [ ] **步骤 2：使用 Node.js 22 对应 npm 安装依赖**

运行：

```bash
PATH=/Users/jmal/.nvm/versions/node/v22.23.1/bin:$PATH npm install
```

预期：安装成功并生成 `package-lock.json`；不能使用 `--force` 或 `--legacy-peer-deps`。

- [ ] **步骤 3：检查关键依赖解析结果**

运行：

```bash
PATH=/Users/jmal/.nvm/versions/node/v22.23.1/bin:$PATH npm ls vite @vitejs/plugin-vue @vitejs/plugin-vue-jsx unocss vite-plugin-vue-devtools
```

预期：退出码为 0，Vite 解析为 `8.1.x`，且不存在 `invalid`、`extraneous` 或 peer dependency 错误。

### 任务 4：完成 RED 到 GREEN 的运行验证

**文件：**

- 条件修改：`build/plugins.ts`
- 条件修改：`vite.config.ts`

- [ ] **步骤 1：启动开发服务器**

运行：

```bash
PATH=/Users/jmal/.nvm/versions/node/v22.23.1/bin:$PATH npm run dev
```

预期：Vite 开发服务器成功启动并监听 `http://localhost:9980/`。确认启动日志后终止进程。

- [ ] **步骤 2：运行完整生产构建**

运行：

```bash
PATH=/Users/jmal/.nvm/versions/node/v22.23.1/bin:$PATH npm run build
```

预期：`vue-tsc --noEmit` 和 Vite production build 均成功，生成 `dist/`。

- [ ] **步骤 3：运行 lint 与类型检查**

运行：

```bash
PATH=/Users/jmal/.nvm/versions/node/v22.23.1/bin:$PATH npm run lint
```

预期：ESLint 和 `vue-tsc --noEmit` 均成功。

- [ ] **步骤 4：仅在失败时处理单一兼容问题**

如果步骤 1 至 3 出现新版 API 错误：

1. 保存完整错误栈并定位到具体 plugin。
2. 对照该 plugin 当前版本的 package metadata 与导出 API。
3. 只修改错误涉及的 `build/plugins.ts` 或 `vite.config.ts` 配置。
4. 重新运行最初失败的命令，确认该单一问题由 RED 变为 GREEN。
5. 再次执行任务 4 的全部命令，防止局部修复造成回归。

不得通过降级 Vite、忽略 peer dependency、删除 plugin 功能或批量重构来绕过错误。

### 任务 5：最终验证与交付检查

**文件：**

- 检查：`package.json`
- 检查：`package-lock.json`
- 检查：条件兼容修改文件

- [ ] **步骤 1：运行最终版本与质量命令**

运行：

```bash
PATH=/Users/jmal/.nvm/versions/node/v22.23.1/bin:$PATH node --version
PATH=/Users/jmal/.nvm/versions/node/v22.23.1/bin:$PATH npm ls vite --depth=0
PATH=/Users/jmal/.nvm/versions/node/v22.23.1/bin:$PATH npm run build
PATH=/Users/jmal/.nvm/versions/node/v22.23.1/bin:$PATH npm run lint
```

预期：Node.js 为 `v22.23.1`，Vite 为 `8.1.x`，build 与 lint 均成功。

- [ ] **步骤 2：检查工作区范围与格式**

运行：

```bash
git status --short
git diff --check
git diff --stat
git diff -- package.json
```

预期：没有 whitespace error；升级产物限于 `package.json`、`package-lock.json` 和确有必要的构建兼容文件，同时保留用户已有的 `vue-i18n` 修改。

- [ ] **步骤 3：提交构建链升级**

```bash
git add package.json package-lock.json
git add build/plugins.ts vite.config.ts  # 仅添加实际发生的兼容修改
git commit -m "build: 升级到 Vite 8.1 构建链"
```

预期：提交成功；不包含 `node_modules/`、`dist/` 或无关文件。
