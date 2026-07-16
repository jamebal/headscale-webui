/* eslint-disable test/no-import-node-test, no-template-curly-in-string -- 此文件必须使用 Node.js 内置测试运行器并检查 GitHub 表达式 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const buildWorkflow = await readFile(
  new URL('../.github/workflows/build.yml', import.meta.url),
  'utf8',
)
const testBuildWorkflow = await readFile(
  new URL('../.github/workflows/test-build.yml', import.meta.url),
  'utf8',
)

const metadataCommand = 'node scripts/release-metadata.mjs >> "$GITHUB_ENV"'
const versionLabel = 'org.opencontainers.image.version=${{ env.PROJECT_VERSION }}'
const compatibilityLabel = 'io.github.jamebal.headscale-webui.headscale.compatibility=${{ env.HEADSCALE_COMPATIBILITY }}'
const revisionLabel = 'org.opencontainers.image.revision=${{ github.sha }}'

function workflowStep(workflow, name) {
  const start = workflow.indexOf(`      - name: ${name}`)
  assert.notEqual(start, -1, `缺少 Workflow step：${name}`)
  const end = workflow.indexOf('\n      - name:', start + 1)
  return workflow.slice(start, end === -1 ? undefined : end)
}

test('正式 Workflow 使用统一脚本读取发布版本信息', () => {
  assert.ok(buildWorkflow.includes(metadataCommand))
  assert.ok(!buildWorkflow.includes('require(\'./package.json\').version'))
})

test('正式 Workflow 只在手动触发和正式发布时运行', () => {
  assert.ok(buildWorkflow.includes([
    'on:',
    '  workflow_dispatch:',
    '  release:',
    '    types: [published]',
  ].join('\n')))
  assert.ok(!buildWorkflow.includes('tags: [v*]'))
})

test('正式 Workflow 使用固定并发保护', () => {
  assert.ok(buildWorkflow.includes([
    'concurrency:',
    '  group: headscale-webui-release',
    '  cancel-in-progress: false',
  ].join('\n')))
})

test('正式 Workflow 构建步骤只推送两个 staging 标签', () => {
  const step = workflowStep(buildWorkflow, '构建并推送 Docker 镜像')
  const tagsStart = step.indexOf('          tags: |')
  const tagsEnd = step.indexOf('          labels: |', tagsStart)
  const tags = step.slice(tagsStart, tagsEnd)
  assert.ok(tags.includes('jmal/headscale-webui:build-${{ github.sha }}'))
  assert.ok(tags.includes('ghcr.io/${{ secrets.GHCR_IO_USERNAME }}/headscale-webui:build-${{ github.sha }}'))
  assert.equal(tags.match(/headscale-webui:/g)?.length, 2)
  assert.ok(!tags.includes('env.PROJECT_VERSION'))
  assert.ok(!tags.includes('env.HEADSCALE_COMPATIBILITY'))
})

test('正式 Workflow 构建步骤写入 revision metadata 和 index annotation', () => {
  const step = workflowStep(buildWorkflow, '构建并推送 Docker 镜像')
  assert.ok(step.includes(versionLabel))
  assert.ok(step.includes(compatibilityLabel))
  assert.ok(step.includes(revisionLabel))
  assert.ok(step.includes([
    '          annotations: |',
    '            index:org.opencontainers.image.revision=${{ github.sha }}',
    '            index:org.opencontainers.image.version=${{ env.PROJECT_VERSION }}',
    '            index:io.github.jamebal.headscale-webui.headscale.compatibility=${{ env.HEADSCALE_COMPATIBILITY }}',
  ].join('\n')))
  assert.ok(step.includes('platforms: linux/amd64,linux/arm64'))
})

test('正式 Workflow 在 staging 构建后调用双仓库 promotion CLI', () => {
  const buildStep = workflowStep(buildWorkflow, '构建并推送 Docker 镜像')
  const promotionStep = workflowStep(buildWorkflow, '提升正式镜像标签')
  assert.ok(buildWorkflow.indexOf(buildStep) < buildWorkflow.indexOf(promotionStep))
  assert.ok(promotionStep.includes([
    '        env:',
    '          DOCKER_IMAGE: jmal/headscale-webui',
    '          GHCR_IMAGE: ghcr.io/${{ secrets.GHCR_IO_USERNAME }}/headscale-webui',
  ].join('\n')))
  assert.ok(promotionStep.includes([
    '          node scripts/promote-image-tags.mjs',
    '          "$DOCKER_IMAGE"',
    '          "$GHCR_IMAGE"',
    '          "$PROJECT_VERSION"',
    '          "$HEADSCALE_COMPATIBILITY"',
    '          "${{ github.sha }}"',
  ].join('\n')))
  assert.ok(!promotionStep.includes('node scripts/promote-image-tags.mjs\n          jmal/headscale-webui'))
  assert.ok(!buildWorkflow.includes('docker manifest inspect'))
})

test('测试 Workflow 使用统一脚本和仅有的两个 test 标签', () => {
  assert.ok(testBuildWorkflow.includes(metadataCommand))
  assert.ok(!testBuildWorkflow.includes('require(\'./package.json\').version'))
  assert.ok(testBuildWorkflow.includes('jmal/headscale-webui:test'))
  assert.ok(testBuildWorkflow.includes('ghcr.io/${{ secrets.GHCR_IO_USERNAME }}/headscale-webui:test'))
  assert.ok(!testBuildWorkflow.includes('headscale-webui:latest'))
  assert.ok(!testBuildWorkflow.includes('headscale-webui:hs${{'))
})

test('测试 Workflow 写入版本 labels 并保留双架构构建', () => {
  assert.ok(testBuildWorkflow.includes(versionLabel))
  assert.ok(testBuildWorkflow.includes(compatibilityLabel))
  assert.ok(testBuildWorkflow.includes('platforms: linux/amd64,linux/arm64'))
})
