/* eslint-disable test/no-import-node-test -- 此文件必须使用 Node.js 内置测试运行器 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [englishReadme, chineseReadme] = await Promise.all([
  readFile(new URL('../README.md', import.meta.url), 'utf8'),
  readFile(new URL('../README.zh-CN.md', import.meta.url), 'utf8'),
])

test('中英文 README 声明支持 Headscale v0.25.x', () => {
  assert.match(englishReadme, /Headscale v0\.25\.x/)
  assert.match(chineseReadme, /Headscale `v0\.25\.x`/)
})

test('中英文 Docker Compose 使用 hs0.25 标签', () => {
  const image = 'image: jmal/headscale-webui:hs0.25'
  assert.ok(englishReadme.includes(image))
  assert.ok(chineseReadme.includes(image))
})

test('中英文 README 警告 latest 不保证兼容性', () => {
  assert.ok(englishReadme.includes('`latest` does not guarantee compatibility'))
  assert.ok(chineseReadme.includes('`latest` 不保证兼容旧版 Headscale'))
})

test('中英文 README 包含固定组合标签', () => {
  const exactTag = '0.0.6-hs0.25'
  assert.ok(englishReadme.includes(exactTag))
  assert.ok(chineseReadme.includes(exactTag))
})
