/* eslint-disable test/no-import-node-test -- 此文件必须使用 Node.js 内置测试运行器 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import {
  formatGitHubEnvironment,
  readReleaseMetadata,
  validateReleaseMetadata,
} from '../scripts/release-metadata.mjs'

test('真实 package 与 lockfile 发布版本一致', async () => {
  const metadata = readReleaseMetadata()
  const packageLock = JSON.parse(await readFile(new URL('../package-lock.json', import.meta.url), 'utf8'))
  assert.deepEqual(metadata, {
    projectVersion: '0.0.7',
    headscaleCompatibility: '0.29',
  })
  assert.equal(packageLock.version, metadata.projectVersion)
  assert.equal(packageLock.packages[''].version, metadata.projectVersion)
})

test('校验有效的发布版本信息', () => {
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

test('拒绝无效的项目版本', () => {
  for (const packageJson of [
    { headscaleCompatibility: '0.25' },
    { version: 'v0.0.1', headscaleCompatibility: '0.25' },
  ]) {
    assert.throws(
      () => validateReleaseMetadata(packageJson),
      /package.json version 必须是三段数字版本/,
    )
  }
})

test('用项目版本领域错误拒绝 null 配置', () => {
  assert.throws(
    () => validateReleaseMetadata(null),
    /package.json version 必须是三段数字版本/,
  )
})

test('拒绝数组类型的项目版本', () => {
  assert.throws(
    () => validateReleaseMetadata({
      version: ['1.2.3'],
      headscaleCompatibility: '0.25',
    }),
    /package.json version 必须是三段数字版本/,
  )
})

test('拒绝无效的 Headscale 兼容版本', () => {
  for (const packageJson of [
    { version: '0.0.1' },
    { version: '0.0.1', headscaleCompatibility: '0.25.0' },
  ]) {
    assert.throws(
      () => validateReleaseMetadata(packageJson),
      /package.json headscaleCompatibility 必须是两段数字版本/,
    )
  }
})

test('拒绝数组类型的 Headscale 兼容版本', () => {
  assert.throws(
    () => validateReleaseMetadata({
      version: '0.0.1',
      headscaleCompatibility: ['0.25'],
    }),
    /package.json headscaleCompatibility 必须是两段数字版本/,
  )
})

test('格式化 GitHub Actions 环境变量', () => {
  assert.equal(
    formatGitHubEnvironment({
      projectVersion: '0.0.1',
      headscaleCompatibility: '0.25',
    }),
    'PROJECT_VERSION=0.0.1\nHEADSCALE_COMPATIBILITY=0.25',
  )
})
