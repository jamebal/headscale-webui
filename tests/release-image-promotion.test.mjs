/* eslint-disable test/no-import-node-test -- 此文件必须使用 Node.js 内置测试运行器 */
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  compareSemanticVersions,
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
const digestC = `sha256:${'3'.repeat(64)}`
const digestD = `sha256:${'4'.repeat(64)}`

function normalizeRef(ref) {
  return ref.startsWith('ghcr.io/') ? ref : `docker.io/${ref}`
}

function manifest(
  digest = digestA,
  manifestRevision = revision,
  platforms = ['amd64', 'arm64'],
  manifestVersion = projectVersion,
  manifestCompatibility = compatibility,
) {
  const annotations = manifestRevision === null
    ? {}
    : { 'org.opencontainers.image.revision': manifestRevision }
  if (manifestVersion !== null) {
    annotations['org.opencontainers.image.version'] = manifestVersion
  }
  if (manifestCompatibility !== null) {
    annotations['io.github.jamebal.headscale-webui.headscale.compatibility'] = manifestCompatibility
  }
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

function releaseOptions(fake, {
  version = projectVersion,
  releaseCompatibility = compatibility,
  releaseRevision = revision,
} = {}) {
  return options(fake, {
    projectVersion: version,
    headscaleCompatibility: releaseCompatibility,
    revision: releaseRevision,
  })
}

function seedReleaseStaging(fake, {
  version = projectVersion,
  releaseCompatibility = compatibility,
  releaseRevision = revision,
  digest = digestA,
} = {}) {
  const value = manifest(digest, releaseRevision, ['amd64', 'arm64'], version, releaseCompatibility)
  fake.seed(ref(dockerImage, `build-${releaseRevision}`), value)
  fake.seed(ref(ghcrImage, `build-${releaseRevision}`), value)
}

function seedReleaseStable(fake, {
  version = projectVersion,
  releaseCompatibility = compatibility,
  releaseRevision = revision,
  digest = digestA,
} = {}) {
  const value = manifest(digest, releaseRevision, ['amd64', 'arm64'], version, releaseCompatibility)
  for (const image of [dockerImage, ghcrImage]) {
    fake.seed(ref(image, `${version}-hs${releaseCompatibility}`), value)
    fake.seed(ref(image, version), value)
  }
}

function seedAliasPair(fake, tag, dockerValue, ghcrValue = dockerValue) {
  fake.seed(ref(dockerImage, tag), dockerValue)
  fake.seed(ref(ghcrImage, tag), ghcrValue)
}

function seedCurrentAliases(fake, value = manifest()) {
  seedAliasPair(fake, `hs${compatibility}`, value)
  seedAliasPair(fake, 'latest', value)
}

function assertAllTags(fake, expectedDigest = digestA) {
  for (const image of [dockerImage, ghcrImage]) {
    for (const tag of [projectVersion, `hs${compatibility}`, 'latest', `${projectVersion}-hs${compatibility}`]) {
      assert.equal(fake.tags.get(ref(image, tag))?.digest, expectedDigest)
    }
  }
}

test('三段数字版本按 BigInt 逐段比较并拒绝非法值', () => {
  assert.equal(compareSemanticVersions('0.0.6', '0.0.6'), 0)
  assert.equal(compareSemanticVersions('0.0.10', '0.0.7'), 1)
  assert.equal(compareSemanticVersions('999999999999999999999.0.0', '2.0.0'), 1)
  assert.equal(compareSemanticVersions('0.1.0', '1.0.0'), -1)
  for (const invalidVersion of ['v0.0.6', '0.0', '0.0.6-beta']) {
    assert.throws(() => compareSemanticVersions(invalidVersion, projectVersion), /三段数字版本/)
  }
})

test('首次发布先创建 exact 再创建 aliases 且所有 source 固定 digest', () => {
  const fake = new FakeDocker()
  seedStaging(fake)

  promoteImageTags(options(fake))

  const creates = fake.calls.filter(args => args[2] === 'create')
  assert.equal(creates.length, 8)
  assert.deepEqual(creates[0].slice(3, 5), ['--tag', ref(dockerImage, `${projectVersion}-hs${compatibility}`)])
  assert.deepEqual(creates[1].slice(3, 5), ['--tag', ref(ghcrImage, `${projectVersion}-hs${compatibility}`)])
  assert.ok(creates.every(args => args.filter(value => value === '--tag').length === 1))
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
  assert.equal(creates.length, 0)
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
  const lowerAlias = manifest(digestB, otherRevision, ['amd64', 'arm64'], '0.0.5', compatibility)
  fake.seed(ref(dockerImage, 'latest'), lowerAlias)
  fake.seed(ref(ghcrImage, `hs${compatibility}`), lowerAlias)
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
  for (const invalidDigest of ['sha256:invalid', [digestA]]) {
    const fake = new FakeDocker()
    seedExact(fake, dockerImage, manifest(invalidDigest))
    assert.throws(() => promoteImageTags(options(fake)), /digest.*sha256/)
  }
})

test('拒绝 platform 字段使用可隐式字符串化的数组', () => {
  const fake = new FakeDocker()
  seedExact(fake, dockerImage, manifest(digestA, revision, [['amd64'], 'arm64']))
  assert.throws(() => promoteImageTags(options(fake)), /linux\/amd64/)
})

test('拒绝 canonical manifest 的版本或兼容 annotation 缺失与不匹配', () => {
  for (const value of [
    manifest(digestA, revision, ['amd64', 'arm64'], null, compatibility),
    manifest(digestA, revision, ['amd64', 'arm64'], projectVersion, null),
    manifest(digestA, revision, ['amd64', 'arm64'], '0.0.7', compatibility),
    manifest(digestA, revision, ['amd64', 'arm64'], projectVersion, '0.29'),
  ]) {
    const fake = new FakeDocker()
    seedExact(fake, dockerImage, value)
    assert.throws(() => promoteImageTags(options(fake)), /版本|兼容/)
  }
})

test('project 已存在且等于 canonical 时不重写', () => {
  const fake = new FakeDocker()
  seedReleaseStable(fake)
  seedCurrentAliases(fake)

  promoteImageTags(options(fake))

  const projectCreates = fake.calls.filter(args => args[2] === 'create' && (
    args.includes(ref(dockerImage, projectVersion)) || args.includes(ref(ghcrImage, projectVersion))
  ))
  assert.equal(projectCreates.length, 0)
})

test('project 缺失时逐仓库单独创建并立即复查', () => {
  const fake = new FakeDocker()
  seedExact(fake, dockerImage)
  seedExact(fake, ghcrImage)
  seedCurrentAliases(fake)

  promoteImageTags(options(fake))

  for (const image of [dockerImage, ghcrImage]) {
    const projectRef = ref(image, projectVersion)
    const createIndex = fake.calls.findIndex(args => args[2] === 'create' && args.includes(projectRef))
    assert.notEqual(createIndex, -1)
    assert.equal(fake.calls[createIndex].filter(value => value === '--tag').length, 1)
    const inspectIndex = fake.calls.findIndex((args, index) => index > createIndex && args[2] === 'inspect' && args[3] === projectRef)
    assert.ok(inspectIndex > createIndex)
  }
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

test('同兼容系列发布较新版本后重跑旧版本不会回滚 hs 和 latest', () => {
  const fake = new FakeDocker()
  seedReleaseStaging(fake)
  promoteImageTags(releaseOptions(fake))
  seedReleaseStaging(fake, {
    version: '0.0.7',
    releaseRevision: otherRevision,
    digest: digestB,
  })
  promoteImageTags(releaseOptions(fake, { version: '0.0.7', releaseRevision: otherRevision }))

  promoteImageTags(releaseOptions(fake))

  for (const image of [dockerImage, ghcrImage]) {
    for (const tag of [`hs${compatibility}`, 'latest']) {
      const value = fake.tags.get(ref(image, tag))
      assert.equal(value.digest, digestB)
      assert.equal(value.annotations['org.opencontainers.image.version'], '0.0.7')
    }
  }
})

test('跨兼容系列较新发布后重跑旧版本只保留旧 hs 且不回滚 latest', () => {
  const fake = new FakeDocker()
  seedReleaseStaging(fake)
  promoteImageTags(releaseOptions(fake))
  seedReleaseStaging(fake, {
    version: '0.1.0',
    releaseCompatibility: '0.29',
    releaseRevision: otherRevision,
    digest: digestB,
  })
  promoteImageTags(releaseOptions(fake, {
    version: '0.1.0',
    releaseCompatibility: '0.29',
    releaseRevision: otherRevision,
  }))

  promoteImageTags(releaseOptions(fake))

  for (const image of [dockerImage, ghcrImage]) {
    assert.equal(fake.tags.get(ref(image, `hs${compatibility}`)).digest, digestA)
    assert.equal(fake.tags.get(ref(image, 'latest')).digest, digestB)
  }
})

test('较新发布仅完成单侧 alias 时旧发布失败且较新发布可补齐', () => {
  const fake = new FakeDocker()
  seedReleaseStable(fake)
  seedReleaseStable(fake, {
    version: '0.0.7',
    releaseRevision: otherRevision,
    digest: digestB,
  })
  const oldValue = manifest()
  const newValue = manifest(digestB, otherRevision, ['amd64', 'arm64'], '0.0.7', compatibility)
  seedAliasPair(fake, `hs${compatibility}`, newValue, oldValue)
  seedAliasPair(fake, 'latest', newValue, oldValue)

  assert.throws(() => promoteImageTags(releaseOptions(fake)), /请重跑对应的较新发布/)
  promoteImageTags(releaseOptions(fake, { version: '0.0.7', releaseRevision: otherRevision }))

  for (const image of [dockerImage, ghcrImage]) {
    assert.equal(fake.tags.get(ref(image, `hs${compatibility}`)).digest, digestB)
    assert.equal(fake.tags.get(ref(image, 'latest')).digest, digestB)
  }
})

test('相同 alias 版本但 digest 不同，以及 hs compatibility 不匹配时失败', () => {
  const fakeDigestConflict = new FakeDocker()
  seedReleaseStable(fakeDigestConflict)
  seedAliasPair(fakeDigestConflict, `hs${compatibility}`, manifest(), manifest(digestB))
  seedAliasPair(fakeDigestConflict, 'latest', manifest())
  assert.throws(() => promoteImageTags(options(fakeDigestConflict)), /digest|canonical/)

  const fakeCompatibilityConflict = new FakeDocker()
  seedReleaseStable(fakeCompatibilityConflict)
  const wrongCompatibility = manifest(digestB, otherRevision, ['amd64', 'arm64'], '0.0.7', '0.29')
  seedAliasPair(fakeCompatibilityConflict, `hs${compatibility}`, wrongCompatibility)
  assert.throws(() => promoteImageTags(options(fakeCompatibilityConflict)), /兼容/)
})

test('higher alias 双侧 version 或 digest 不一致时 fail-closed', () => {
  for (const [dockerValue, ghcrValue] of [
    [
      manifest(digestB, otherRevision, ['amd64', 'arm64'], '0.0.7', compatibility),
      manifest(digestC, revision, ['amd64', 'arm64'], '0.0.8', compatibility),
    ],
    [
      manifest(digestB, otherRevision, ['amd64', 'arm64'], '0.0.7', compatibility),
      manifest(digestC, otherRevision, ['amd64', 'arm64'], '0.0.7', compatibility),
    ],
  ]) {
    const fake = new FakeDocker()
    seedReleaseStable(fake)
    seedAliasPair(fake, `hs${compatibility}`, dockerValue, ghcrValue)
    assert.throws(() => promoteImageTags(options(fake)), /请重跑对应的较新发布/)
  }
})

test('alias 的 version、compatibility 与 revision annotation 必须格式合法', () => {
  for (const invalidAlias of [
    manifest(digestB, otherRevision, ['amd64', 'arm64'], 'v0.0.7', compatibility),
    manifest(digestB, otherRevision, ['amd64', 'arm64'], '0.0.7', '0.25.0'),
    manifest(digestB, 'bad-revision', ['amd64', 'arm64'], '0.0.7', compatibility),
  ]) {
    const fake = new FakeDocker()
    seedReleaseStable(fake)
    seedAliasPair(fake, `hs${compatibility}`, invalidAlias)
    assert.throws(() => promoteImageTags(options(fake)), /annotation/)
  }
})

test('alias metadata 必须是字符串而不是可隐式字符串化的数组', () => {
  for (const [annotation, value] of [
    ['org.opencontainers.image.revision', [otherRevision]],
    ['org.opencontainers.image.version', ['0.0.7']],
    ['io.github.jamebal.headscale-webui.headscale.compatibility', [compatibility]],
  ]) {
    const fake = new FakeDocker()
    seedReleaseStable(fake)
    seedCurrentAliases(fake)
    const invalidLatest = manifest()
    invalidLatest.annotations[annotation] = value
    seedAliasPair(fake, 'latest', invalidLatest)
    assert.throws(() => promoteImageTags(options(fake)), /annotation/)
  }
})

test('0.0.6 可迁移 legacy aliases，而后续版本遇到 legacy 必须失败', () => {
  const legacyValue = manifest(digestD, null, ['amd64', 'arm64'], null, null)
  const migrationFake = new FakeDocker()
  seedReleaseStable(migrationFake)
  seedAliasPair(migrationFake, `hs${compatibility}`, legacyValue)
  seedAliasPair(migrationFake, 'latest', legacyValue)
  promoteImageTags(options(migrationFake))
  for (const image of [dockerImage, ghcrImage]) {
    assert.equal(migrationFake.tags.get(ref(image, `hs${compatibility}`)).digest, digestA)
    assert.equal(migrationFake.tags.get(ref(image, 'latest')).digest, digestA)
  }

  const revisionOnly = manifest(digestD, otherRevision, ['amd64', 'arm64'], null, null)
  const versionOnly = manifest(digestD, otherRevision, ['amd64', 'arm64'], '0.0.6', null)
  for (const historicalAlias of [legacyValue, revisionOnly, versionOnly]) {
    const futureFake = new FakeDocker()
    seedReleaseStable(futureFake, {
      version: '0.0.7',
      releaseRevision: otherRevision,
      digest: digestB,
    })
    seedAliasPair(futureFake, `hs${compatibility}`, historicalAlias)
    assert.throws(
      () => promoteImageTags(releaseOptions(futureFake, { version: '0.0.7', releaseRevision: otherRevision })),
      /annotation|版本|兼容/,
    )
  }
})

test('0.0.6 legacy migration 拒绝非法 revision 和 partial metadata', () => {
  for (const historicalAlias of [
    manifest(digestD, 'bad-revision', ['amd64', 'arm64'], null, null),
    manifest(digestD, otherRevision, ['amd64', 'arm64'], null, compatibility),
    manifest(digestD, otherRevision, ['amd64', 'arm64'], projectVersion, null),
  ]) {
    const fake = new FakeDocker()
    seedReleaseStable(fake)
    seedAliasPair(fake, `hs${compatibility}`, historicalAlias)
    assert.throws(() => promoteImageTags(options(fake)), /annotation|版本|兼容/)
  }
})

test('仅把规范化精确 not found 和 ref-bound manifest unknown 视为缺失', () => {
  const missingRef = ref(dockerImage, 'missing')
  for (const stderr of [
    `ERROR: ${normalizeRef(missingRef)}: not found`,
    `ERROR: ${normalizeRef(missingRef)}: manifest unknown`,
    `ERROR: ${normalizeRef(missingRef)}: manifest unknown: manifest unknown`,
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

test('网络与访问拒绝文字不能伪装成同一行 manifest unknown', () => {
  const checkedRef = ref(dockerImage, 'checked')
  for (const stderr of [
    `dial tcp: lookup registry-1.docker.io: i/o timeout while resolving ${normalizeRef(checkedRef)}: manifest unknown`,
    `access denied while resolving ${normalizeRef(checkedRef)}: manifest unknown`,
  ]) {
    const runner = () => ({ status: 1, stdout: '', stderr })
    assert.throws(() => inspectImageManifest(checkedRef, runner), /检查镜像失败/)
  }
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
  assert.throws(() => promoteImageTags(options(fake, { runDocker: runner })), /创建后校验失败|发布后校验失败/)
})

test('CLI 参数严格校验 image、版本、兼容版本和 revision', () => {
  assert.throws(() => validatePromotionArguments([]), /需要 5 个参数/)
  assert.throws(() => validatePromotionArguments(['IMAGE:tag', ghcrImage, projectVersion, compatibility, revision]), /镜像名称/)
  assert.throws(() => validatePromotionArguments([dockerImage, ghcrImage, 'v0.0.6', compatibility, revision]), /项目版本/)
  assert.throws(() => validatePromotionArguments([dockerImage, ghcrImage, projectVersion, '0.25.0', revision]), /兼容版本/)
  assert.throws(() => validatePromotionArguments([dockerImage, ghcrImage, projectVersion, compatibility, 'main']), /revision/)
})
