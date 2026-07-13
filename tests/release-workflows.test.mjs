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

test('正式 Workflow 发布 Docker Hub 的全部镜像标签', () => {
  for (const tag of [
    'jmal/headscale-webui:${{ env.PROJECT_VERSION }}-hs${{ env.HEADSCALE_COMPATIBILITY }}',
    'jmal/headscale-webui:${{ env.PROJECT_VERSION }}',
    'jmal/headscale-webui:hs${{ env.HEADSCALE_COMPATIBILITY }}',
    'jmal/headscale-webui:latest',
  ]) {
    assert.ok(buildWorkflow.includes(tag), `缺少 Docker Hub 镜像标签：${tag}`)
  }
})

test('正式 Workflow 发布 GHCR 的全部镜像标签', () => {
  const image = 'ghcr.io/${{ secrets.GHCR_IO_USERNAME }}/headscale-webui:'
  for (const tag of [
    '${{ env.PROJECT_VERSION }}-hs${{ env.HEADSCALE_COMPATIBILITY }}',
    '${{ env.PROJECT_VERSION }}',
    'hs${{ env.HEADSCALE_COMPATIBILITY }}',
    'latest',
  ]) {
    assert.ok(buildWorkflow.includes(`${image}${tag}`), `缺少 GHCR 镜像标签：${tag}`)
  }
})

test('正式 Workflow 写入版本 labels 并保留双架构构建', () => {
  assert.ok(buildWorkflow.includes(versionLabel))
  assert.ok(buildWorkflow.includes(compatibilityLabel))
  assert.ok(buildWorkflow.includes('platforms: linux/amd64,linux/arm64'))
})

test('正式 Workflow 阻止覆盖精确镜像标签', () => {
  assert.ok(buildWorkflow.includes([
    '      - name: 检查精确镜像标签未被占用',
    '        shell: bash',
    '        run: |',
  ].join('\n')))
  assert.ok(buildWorkflow.includes('docker manifest inspect'))
  assert.ok(buildWorkflow.includes('精确镜像标签已存在'))
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
