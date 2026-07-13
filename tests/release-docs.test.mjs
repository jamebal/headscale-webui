/* eslint-disable test/no-import-node-test -- 此文件必须使用 Node.js 内置测试运行器 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [englishReadme, chineseReadme] = await Promise.all([
  readFile(new URL('../README.md', import.meta.url), 'utf8'),
  readFile(new URL('../README.zh-CN.md', import.meta.url), 'utf8'),
])

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

test('中英文 README 声明支持 Headscale v0.25.x', () => {
  assert.match(englishReadme, /Headscale v0\.25\.x/)
  assert.match(chineseReadme, /Headscale `v0\.25\.x`/)
})

test('中英文 Docker Compose 使用 hs0.25 标签', () => {
  const imageLine = '    image: jmal/headscale-webui:hs0.25'
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
  assert.match(tagListItem(englishReadme, '0.0.6-hs0.25'), /`0\.0\.6-hs0\.25`.*\bimmutable\b/i)
  assert.match(tagListItem(chineseReadme, '0.0.6-hs0.25'), /`0\.0\.6-hs0\.25`.*不可移动/)
})

test('中英文 README 说明兼容系列标签是跟随最新兼容版本的可移动别名', () => {
  const englishItem = tagListItem(englishReadme, 'hs0.25')
  assert.ok(englishItem.includes('movable alias'))
  assert.match(englishItem, /tracks the latest WebUI.*compatible with Headscale v0\.25\.x/i)

  const chineseItem = tagListItem(chineseReadme, 'hs0.25')
  assert.ok(chineseItem.includes('可移动别名'))
  assert.match(chineseItem, /跟随仍兼容 Headscale `v0\.25\.x` 的最新 WebUI/)
})
