/* eslint-disable test/no-import-node-test -- 此文件必须使用 Node.js 内置测试运行器 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { readReleaseMetadata } from '../scripts/release-metadata.mjs'

const [englishReadme, chineseReadme] = await Promise.all([
  readFile(new URL('../README.md', import.meta.url), 'utf8'),
  readFile(new URL('../README.zh-CN.md', import.meta.url), 'utf8'),
])
const metadata = readReleaseMetadata()
const exactTag = `${metadata.projectVersion}-hs${metadata.headscaleCompatibility}`
const projectTag = metadata.projectVersion
const compatibilityTag = `hs${metadata.headscaleCompatibility}`
const compatibilitySeries = `v${metadata.headscaleCompatibility}.x`

function tagListItem(readme, tag) {
  const item = readme
    .split('\n')
    .find(line => line.startsWith('- ') && line.includes(`\`${tag}\``))
  assert.ok(item, `缺少 ${tag} 标签列表项`)
  return item
}

function dockerComposeBlock(readme) {
  const heading = '### Docker Compose'
  const headingIndex = readme.indexOf(heading)
  assert.notEqual(headingIndex, -1, `缺少 ${heading} 标题`)
  const match = readme.slice(headingIndex + heading.length).match(/```yaml\n([\s\S]*?)\n```/)
  assert.ok(match, `${heading} 后缺少 yaml fenced block`)
  return match[1]
}

test('中英文 README 声明支持 metadata 指定的 Headscale 系列', () => {
  assert.ok(englishReadme.includes(`Headscale ${compatibilitySeries}`))
  assert.ok(chineseReadme.includes(`Headscale \`${compatibilitySeries}\``))
})

test('中英文 Docker Compose 使用 metadata 指定的兼容标签', () => {
  const imageLine = `    image: jmal/headscale-webui:${compatibilityTag}`
  for (const readme of [englishReadme, chineseReadme]) {
    const compose = dockerComposeBlock(readme)
    const headscaleImageLines = compose
      .split('\n')
      .filter(line => /^\s*image:\s*jmal\/headscale-webui(?::\S+)?\s*$/.test(line))
    assert.deepEqual(headscaleImageLines, [imageLine])
  }
})

test('中英文 README 警告 latest 不保证兼容性', () => {
  assert.ok(tagListItem(englishReadme, 'latest').includes('`latest` does not guarantee compatibility'))
  assert.ok(tagListItem(chineseReadme, 'latest').includes('`latest` 不保证兼容旧版 Headscale'))
})

test('中英文 README 说明 exact 标签不可移动', () => {
  assert.match(tagListItem(englishReadme, exactTag), /\bimmutable\b/i)
  assert.match(tagListItem(chineseReadme, exactTag), /不可移动/)
})

test('中英文 README 说明 project 标签不可移动', () => {
  assert.match(tagListItem(englishReadme, projectTag), /\bimmutable\b/i)
  assert.match(tagListItem(chineseReadme, projectTag), /不可移动/)
})

test('中英文 README 说明兼容系列标签是跟随最新兼容版本的可移动别名', () => {
  const englishItem = tagListItem(englishReadme, compatibilityTag)
  assert.ok(englishItem.includes('movable alias'))
  assert.ok(englishItem.toLowerCase().includes(`tracks the latest webui release compatible with headscale ${compatibilitySeries}`.toLowerCase()))

  const chineseItem = tagListItem(chineseReadme, compatibilityTag)
  assert.ok(chineseItem.includes('可移动别名'))
  assert.ok(chineseItem.includes(`跟随仍兼容 Headscale \`${compatibilitySeries}\` 的最新 WebUI`))
})
