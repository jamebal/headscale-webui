# Vite 8 构建链升级设计

## 目标

将项目从 Vite 5 构建链升级到当前受支持的 Vite 8.1.x，并统一使用 npm 管理依赖。升级后，开发服务器、生产构建和静态检查均应正常运行。

## 当前状态

- `package.json` 已被本地修改为 `vite: 8.0.5`，但相关插件仍停留在只声明支持 Vite 5 的版本。
- 用户已安装 Node.js 22.23.1，但当前非交互终端仍解析到 NVM 下的 Node.js 20.14.0。
- 项目 README 使用 npm 命令，但本地存在被 `.gitignore` 忽略的 `pnpm-lock.yaml` 和 pnpm 风格的安装产物。
- 当前 Vite 配置属于常规 Vue SPA：没有 SSR、自定义 `rollupOptions`、esbuild 配置或复杂 PostCSS 配置。

## 方案

采用构建链成套升级方案：

- 将 Vite 升级到最新的 8.1.x patch 版本。
- 同步升级直接依赖 Vite plugin API 的包：
  - `@vitejs/plugin-vue`
  - `@vitejs/plugin-vue-jsx`
  - `unocss`
  - `vite-plugin-vue-devtools`
- 同步升级参与 Vite 构建流程的 `unplugin-auto-import`、`unplugin-vue-components` 和 `unplugin-icons`，避免新旧构建链跨度过大。
- 保留已兼容 Vite 8 的 `vite-plugin-compression`，除非 npm 的依赖解析或实际构建证明必须调整。
- 不主动升级 Vue、Pinia、Naive UI 等业务依赖。
- 将 `volta.node` 固定为 `22.23.1`，确保团队运行环境明确且可复现。
- 删除本地被忽略的 `pnpm-lock.yaml` 和旧 `node_modules`，使用 npm 重新安装并生成 `package-lock.json`。

## 配置与代码调整原则

优先保持 `vite.config.ts` 和 `build/plugins.ts` 不变。只有新版依赖出现确定的 API、类型或构建兼容错误时，才进行对应的最小修改；不借机重构业务代码或构建配置。

UnoCSS 从 0.62.x 升级到 66.x 跨越多个 major，因此需要重点检查：

- UnoCSS plugin 是否正常加载。
- 页面现有 utility class 是否仍能生成样式。
- 自定义 SVG icon collection 是否仍能由 `unplugin-icons` 和 components resolver 正常解析。

## 依赖管理

npm 是本项目唯一包管理器：

- 生成并提交 `package-lock.json`。
- 删除本地 `pnpm-lock.yaml`。
- 不修改 `.gitignore` 中对 YAML lockfile 的现有规则，因为统一 npm 后不会再生成该文件。
- 后续使用 `npm install`、`npm run dev`、`npm run build` 和 `npm run lint`。

## 验证标准

升级成功必须同时满足：

1. `node --version` 在实际验证环境中输出 `v22.23.1`。
2. `npm install` 成功，且不存在 Vite plugin 的 peer dependency 冲突。
3. `npm run dev` 启动成功，Vite 开发服务器能够监听项目配置的 9980 端口。
4. `npm run build` 成功完成类型检查和生产构建。
5. `npm run lint` 成功完成 ESLint 和 TypeScript 检查。
6. Git diff 仅包含本次构建链升级所需的依赖、lockfile 和必要兼容修改，不覆盖用户已有的 `vue-i18n` 改动。

## 错误处理

- 如果当前 shell 仍未切换到 Node.js 22.23.1，优先通过 NVM 的明确 Node binary 执行安装和验证，不降低 Vite 版本规避环境问题。
- 如果某个 plugin 出现 peer dependency 冲突，核对其 npm metadata，并只升级冲突链上的直接依赖。
- 如果构建错误来自 Rolldown、Lightning CSS 或 UnoCSS 行为变化，先保留完整错误日志，再做单一、最小的兼容调整并重新验证。
- 不使用 `--force` 或 `--legacy-peer-deps` 隐藏依赖冲突。

## 非目标

- 不升级所有业务依赖。
- 不改造页面功能或视觉样式。
- 不引入新的构建工具、测试框架或包管理器。
- 不处理与 Vite 8 升级无关的历史 lint 或类型问题，除非它们阻止确认本次升级结果；此类问题需要明确记录。
