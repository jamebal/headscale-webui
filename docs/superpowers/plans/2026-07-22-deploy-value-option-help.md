# 部署值参数问号说明修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为常规部署页所有需要先启用再填写值的参数恢复问号说明。

**Architecture:** 保留现有参数状态、输入控件、校验和命令生成逻辑，只在各参数标题行中并列渲染复选框与 `HelpInfo`。回归测试通过读取 `HelpInfo` 的 `message` 属性验证八个参数均接入原有国际化文案。

**Tech Stack:** Vue 3、Naive UI、Vue Test Utils、Vitest、TypeScript

---

### 任务 1：恢复值参数的问号说明

**Files:**
- Modify: `tests/deploy-view.test.ts`
- Modify: `src/views/deploy/index.vue:311-448`

- [ ] **步骤 1：编写失败的帮助说明回归测试**

在 `tests/deploy-view.test.ts` 的“常规部署参数”测试组中加入：

```ts
it('为需要填写值的常规部署参数显示问号说明', () => {
  const wrapper = mountDeployView()
  const helpMessages = wrapper.findAllComponents(HelpInfoStub).map(component => component.props('message'))

  expect(helpMessages).toEqual(expect.arrayContaining([
    '--operator string \r\n   app.operator',
    '--auth-key string \r\n   app.authKey',
    '--hostname string \r\n   app.hostname',
    '--timeout string \r\n   app.timeout',
    '--accept-risk string \r\n   app.acceptRisk',
    '--exit-node string \r\n   app.exitNode',
    '--advertise-tags string \r\n   app.advertiseTags',
    '--advertise-routes string \r\n   app.advertiseRoutes',
  ]))
})
```

- [ ] **步骤 2：运行测试并确认因说明缺失而失败**

Run: `npm test -- tests/deploy-view.test.ts -t "为需要填写值的常规部署参数显示问号说明"`

Expected: FAIL，`helpMessages` 缺少上述八条说明。

- [ ] **步骤 3：给八个值参数补充 `HelpInfo`**

在 `src/views/deploy/index.vue` 中，将每个字段原来的单独复选框改为横向标题行。以 `Operator` 为例：

```vue
<n-flex align="center">
  <n-checkbox v-model:checked="operatorEnabled" data-testid="operator-enable">
    Operator
  </n-checkbox>
  <help-info :message="`--operator string \r\n   ${t('app.operator')}`" />
</n-flex>
```

其余字段使用同一结构，并分别传入以下说明：

```vue
<help-info :message="`--auth-key string \r\n   ${t('app.authKey')}`" />
<help-info :message="`--hostname string \r\n   ${t('app.hostname')}`" />
<help-info :message="`--timeout string \r\n   ${t('app.timeout')}`" />
<help-info :message="`--accept-risk string \r\n   ${t('app.acceptRisk')}`" />
<help-info :message="`--exit-node string \r\n   ${t('app.exitNode')}`" />
<help-info :message="`--advertise-tags string \r\n   ${t('app.advertiseTags')}`" />
<help-info :message="`--advertise-routes string \r\n   ${t('app.advertiseRoutes')}`" />
```

只调整标题行，不改变其下方的 `v-if`、输入控件、校验提示或 `v-model`。

- [ ] **步骤 4：运行部署页测试并确认通过**

Run: `npm test -- tests/deploy-view.test.ts`

Expected: PASS，部署页测试全部通过。

- [ ] **步骤 5：运行类型与代码规范检查**

Run: `npm run lint`

Expected: PASS，无 ESLint 或 TypeScript 错误。

- [ ] **步骤 6：在实际页面验证 DOM**

刷新 `http://localhost:9980/#/deploy`，确认八个字段标题旁均生成 `icon-park-outline-help` SVG，并悬停显示对应说明。

- [ ] **步骤 7：提交修复**

```bash
git add tests/deploy-view.test.ts src/views/deploy/index.vue
git commit -m "fix: 恢复部署参数问号说明"
```
