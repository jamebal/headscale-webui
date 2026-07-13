/* eslint-disable test/no-import-node-test -- 此文件必须使用 Node.js 内置测试运行器 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  inspectImageManifest,
  promoteImageTags,
  validatePromotionArguments,
} from '../scripts/promote-image-tags.mjs'

const dockerImage = 'jmal/headscale-webui'
const ghcrImage = 'ghcr.io/example/headscale-webui'
const projectVersion = '0.0.6'
const compatibility = '0.25'
const revision = 'a'.repeat(40)
const otherRevision = 'b'.repeat(40)
const digestA = `sha256:${'1'.repeat(64)}`
const digestB = `sha256:${'2'.repeat(64)}`

function normalizeRef(ref) {
  return ref.startsWith('ghcr.io/') ? ref : `docker.io/${ref}`
}

function manifest(digest = digestA, manifestRevision = revision, platforms = ['amd64', 'arm64']) {
  const annotations = manifestRevision === null
    ? {}
    : { 'org.opencontainers.image.revision': manifestRevision }
  return {
    digest,
    annotations,
    manifests: platforms.map(architecture => ({
      platform: { os: 'linux', architecture },
    })),
  }
}

class FakeDocker {
  constructor() {
    this.calls = []
    this.tags = new Map()
    this.digests = new Map()
    this.createFailure = undefined
  }

  seed(ref, value = manifest()) {
    this.tags.set(ref, structuredClone(value))
    this.digests.set(value.digest, structuredClone(value))
  }

  runner = (args) => {
    this.calls.push([...args])
    if (args[2] === 'inspect') {
      const ref = args[3]
      const value = this.tags.get(ref)
      if (!value) {
        return {
          status: 1,
          stdout: '',
          stderr: `ERROR: ${normalizeRef(ref)}: not found\n`,
        }
      }
      return { status: 0, stdout: JSON.stringify(value), stderr: '' }
    }

    if (args[2] === 'create') {
      if (this.createFailure) {
        return { status: 1, stdout: '', stderr: this.createFailure }
      }
      const source = args.at(-1)
      const digest = source.slice(source.indexOf('@') + 1)
      const value = this.digests.get(digest)
      if (!source.includes('@sha256:') || !value) {
        return { status: 1, stdout: '', stderr: 'source 不可用' }
      }
      for (let index = 3; index < args.length - 1; index += 2) {
        assert.equal(args[index], '--tag')
        this.tags.set(args[index + 1], structuredClone(value))
      }
      return { status: 0, stdout: '', stderr: '' }
    }

    throw new Error(`未预期的 Docker 参数：${args.join(' ')}`)
  }
}

function options(fake, overrides = {}) {
  return {
    dockerImage,
    ghcrImage,
    projectVersion,
    headscaleCompatibility: compatibility,
    revision,
    runDocker: fake.runner,
    ...overrides,
  }
}

function ref(image, tag) {
  return `${image}:${tag}`
}

function seedStaging(fake, dockerDigest = digestA, ghcrDigest = dockerDigest) {
  fake.seed(ref(dockerImage, `build-${revision}`), manifest(dockerDigest))
  fake.seed(ref(ghcrImage, `build-${revision}`), manifest(ghcrDigest))
}

function seedExact(fake, image, value = manifest()) {
  fake.seed(ref(image, `${projectVersion}-hs${compatibility}`), value)
}

function assertAllTags(fake, expectedDigest = digestA) {
  for (const image of [dockerImage, ghcrImage]) {
    for (const tag of [projectVersion, `hs${compatibility}`, 'latest', `${projectVersion}-hs${compatibility}`]) {
      assert.equal(fake.tags.get(ref(image, tag))?.digest, expectedDigest)
    }
  }
}

test('首次发布先创建 exact 再创建 aliases 且所有 source 固定 digest', () => {
  const fake = new FakeDocker()
  seedStaging(fake)

  promoteImageTags(options(fake))

  const creates = fake.calls.filter(args => args[2] === 'create')
  assert.equal(creates.length, 4)
  assert.deepEqual(creates[0].slice(3, 5), ['--tag', ref(dockerImage, `${projectVersion}-hs${compatibility}`)])
  assert.deepEqual(creates[1].slice(3, 5), ['--tag', ref(ghcrImage, `${projectVersion}-hs${compatibility}`)])
  assert.ok(creates.slice(2).every(args => args.filter(value => value === '--tag').length === 3))
  assert.ok(creates.every(args => /@sha256:[a-f\d]{64}$/i.test(args.at(-1))))
  assert.ok(fake.calls.some(args => args.join('\0') === [
    'buildx',
    'imagetools',
    'inspect',
    ref(dockerImage, `${projectVersion}-hs${compatibility}`),
    '--format',
    '{{json .Manifest}}',
  ].join('\0')))
  assertAllTags(fake)
})

test('同 revision 完整重跑不移动 exact', () => {
  const fake = new FakeDocker()
  seedStaging(fake)
  promoteImageTags(options(fake))
  fake.calls.length = 0

  promoteImageTags(options(fake))

  const creates = fake.calls.filter(args => args[2] === 'create')
  assert.equal(creates.length, 2)
  assert.ok(creates.every(args => !args.includes(ref(dockerImage, `${projectVersion}-hs${compatibility}`))))
  assert.ok(creates.every(args => !args.includes(ref(ghcrImage, `${projectVersion}-hs${compatibility}`))))
  assertAllTags(fake)
})

for (const [description, existingImage, missingImage] of [
  ['仅 Docker exact 存在时补齐 GHCR exact', dockerImage, ghcrImage],
  ['仅 GHCR exact 存在时补齐 Docker exact', ghcrImage, dockerImage],
]) {
  test(description, () => {
    const fake = new FakeDocker()
    seedExact(fake, existingImage)

    promoteImageTags(options(fake))

    const exactCreate = fake.calls.find(args => args[2] === 'create' && args.includes(ref(missingImage, `${projectVersion}-hs${compatibility}`)))
    assert.ok(exactCreate)
    assert.match(exactCreate.at(-1), new RegExp(`^${existingImage.replaceAll('.', '\\.')}@sha256:`))
    assertAllTags(fake)
  })
}

test('aliases 部分缺失时可恢复为完整标签集合', () => {
  const fake = new FakeDocker()
  seedExact(fake, dockerImage)
  seedExact(fake, ghcrImage)
  fake.seed(ref(dockerImage, projectVersion))
  fake.seed(ref(dockerImage, `hs${compatibility}`))
  fake.seed(ref(dockerImage, 'latest'), manifest(digestB))
  fake.seed(ref(ghcrImage, `hs${compatibility}`), manifest(digestB))
  fake.seed(ref(ghcrImage, 'latest'))

  promoteImageTags(options(fake))

  assertAllTags(fake)
})

test('拒绝 revision 不同或缺失的 existing exact', () => {
  for (const invalidRevision of [otherRevision, null]) {
    const fake = new FakeDocker()
    seedExact(fake, dockerImage, manifest(digestA, invalidRevision))
    assert.throws(() => promoteImageTags(options(fake)), /revision/)
  }
})

test('拒绝缺少 amd64 或 arm64 的 canonical manifest', () => {
  for (const platforms of [['amd64'], ['arm64']]) {
    const fake = new FakeDocker()
    seedExact(fake, dockerImage, manifest(digestA, revision, platforms))
    assert.throws(() => promoteImageTags(options(fake)), /linux\/amd64|linux\/arm64/)
  }
})

test('拒绝 digest 格式错误的 canonical manifest', () => {
  const fake = new FakeDocker()
  seedExact(fake, dockerImage, manifest('sha256:invalid'))
  assert.throws(() => promoteImageTags(options(fake)), /digest.*sha256/)
})

test('拒绝 existing project 与 canonical digest 冲突', () => {
  const fake = new FakeDocker()
  seedExact(fake, dockerImage)
  seedExact(fake, ghcrImage)
  fake.seed(ref(dockerImage, projectVersion), manifest(digestB))
  assert.throws(() => promoteImageTags(options(fake)), /project.*冲突|项目版本标签.*冲突/)
})

test('两侧 exact 均不存在但 project 已存在时停止', () => {
  const fake = new FakeDocker()
  fake.seed(ref(ghcrImage, projectVersion))
  seedStaging(fake)
  assert.throws(() => promoteImageTags(options(fake)), /project.*已存在|项目版本标签.*已存在/)
})

test('拒绝两侧 exact digest 冲突', () => {
  const fake = new FakeDocker()
  seedExact(fake, dockerImage, manifest(digestA))
  seedExact(fake, ghcrImage, manifest(digestB))
  assert.throws(() => promoteImageTags(options(fake)), /exact.*digest.*冲突|精确标签.*digest.*冲突/)
})

test('拒绝两侧 staging digest 冲突', () => {
  const fake = new FakeDocker()
  seedStaging(fake, digestA, digestB)
  assert.throws(() => promoteImageTags(options(fake)), /staging.*digest.*冲突/)
})

test('仅把规范化精确 not found 和 ref-bound manifest unknown 视为缺失', () => {
  const missingRef = ref(dockerImage, 'missing')
  for (const stderr of [
    `ERROR: ${normalizeRef(missingRef)}: not found`,
    `failed to resolve ${normalizeRef(missingRef)}: MANIFEST UNKNOWN`,
  ]) {
    const runner = () => ({ status: 1, stdout: '', stderr })
    assert.equal(inspectImageManifest(missingRef, runner), undefined)
  }
})

test('stderr 表示缺失但 stdout 含危险状态时 fail-closed', () => {
  const missingRef = ref(dockerImage, 'missing')
  const stderr = `ERROR: ${normalizeRef(missingRef)}: not found`
  for (const stdout of ['401 Unauthorized', '429 Too Many Requests', 'tls: handshake failure']) {
    const runner = () => ({ status: 1, stdout, stderr })
    assert.throws(() => inspectImageManifest(missingRef, runner), /检查镜像失败/)
  }
})

test('目标 ref 与另一 ref 的 manifest unknown 分处不同行时 fail-closed', () => {
  const checkedRef = ref(dockerImage, 'checked')
  const otherRef = normalizeRef(ref(dockerImage, 'other'))
  const stderr = [
    `failed to inspect ${normalizeRef(checkedRef)}`,
    `${otherRef}: manifest unknown`,
  ].join('\n')
  const runner = () => ({ status: 1, stdout: '', stderr })
  assert.throws(() => inspectImageManifest(checkedRef, runner), /检查镜像失败/)
})

test('认证、限流、网络、TLS 和本地 Docker 错误全部 fail-closed', () => {
  const checkedRef = ref(dockerImage, 'checked')
  for (const stderr of [
    '401 Unauthorized',
    '403 Forbidden',
    '429 Too Many Requests',
    `401 Unauthorized: ${normalizeRef(checkedRef)}: manifest unknown`,
    `tls: handshake failure: ${normalizeRef(checkedRef)}: manifest unknown`,
    'lookup registry-1.docker.io: no such host',
    'tls: failed to verify certificate',
    'error getting credentials - err: exit status 1',
    'executable file not found in $PATH',
    'not found',
  ]) {
    const runner = () => ({ status: 1, stdout: '', stderr })
    assert.throws(() => inspectImageManifest(checkedRef, runner), /检查镜像失败/)
  }
})

test('任意 create 失败时立即停止', () => {
  const fake = new FakeDocker()
  seedStaging(fake)
  fake.createFailure = '403 Forbidden'
  assert.throws(() => promoteImageTags(options(fake)), /创建镜像标签失败/)
})

test('post verification 发现 alias digest 不一致时失败', () => {
  const fake = new FakeDocker()
  seedStaging(fake)
  const baseRunner = fake.runner
  const latestRef = ref(dockerImage, 'latest')
  const runner = (args) => {
    const result = baseRunner(args)
    if (args[2] === 'inspect' && args[3] === latestRef && fake.tags.has(latestRef)) {
      return { status: 0, stdout: JSON.stringify(manifest(digestB)), stderr: '' }
    }
    return result
  }
  assert.throws(() => promoteImageTags(options(fake, { runDocker: runner })), /发布后校验失败/)
})

test('CLI 参数严格校验 image、版本、兼容版本和 revision', () => {
  assert.throws(() => validatePromotionArguments([]), /需要 5 个参数/)
  assert.throws(() => validatePromotionArguments(['IMAGE:tag', ghcrImage, projectVersion, compatibility, revision]), /镜像名称/)
  assert.throws(() => validatePromotionArguments([dockerImage, ghcrImage, 'v0.0.6', compatibility, revision]), /项目版本/)
  assert.throws(() => validatePromotionArguments([dockerImage, ghcrImage, projectVersion, '0.25.0', revision]), /兼容版本/)
  assert.throws(() => validatePromotionArguments([dockerImage, ghcrImage, projectVersion, compatibility, 'main']), /revision/)
})
