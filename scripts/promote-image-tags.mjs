import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const digestPattern = /^sha256:[a-f\d]{64}$/i
const imagePattern = /^(?=.{1,255}$)[a-z\d]+(?:[._-][a-z\d]+)*(?::\d+)?(?:\/[a-z\d]+(?:[._-][a-z\d]+)*)+$/
const projectVersionPattern = /^\d+\.\d+\.\d+$/
const compatibilityPattern = /^\d+\.\d+$/
const revisionPattern = /^[a-f\d]{40}$/i
const revisionAnnotation = 'org.opencontainers.image.revision'
const versionAnnotation = 'org.opencontainers.image.version'
const compatibilityAnnotation = 'io.github.jamebal.headscale-webui.headscale.compatibility'
const legacyAliasMigrationVersion = '0.0.6'

function matchesString(value, pattern) {
  return typeof value === 'string' && pattern.test(value)
}

function defaultDockerRunner(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8' })
  const errorMessage = result.error instanceof Error ? result.error.message : ''
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: [result.stderr, errorMessage].filter(Boolean).join('\n'),
  }
}

function normalizeImageRef(ref) {
  const firstSegment = ref.split('/')[0]
  const hasRegistry = firstSegment.includes('.') || firstSegment.includes(':') || firstSegment === 'localhost'
  return hasRegistry ? ref : `docker.io/${ref}`
}

function commandError(result) {
  return [result.stderr, result.stdout].filter(Boolean).join('\n').trim() || 'Docker 命令未返回错误详情'
}

function isMissingImage(ref, stdout, stderr) {
  if (stdout.trim()) {
    return false
  }
  const normalizedRef = normalizeImageRef(ref)
  return [
    `ERROR: ${normalizedRef}: not found`,
    `ERROR: ${normalizedRef}: manifest unknown`,
    `ERROR: ${normalizedRef}: manifest unknown: manifest unknown`,
  ].includes(stderr.trim())
}

export function inspectImageManifest(ref, runDocker = defaultDockerRunner) {
  const result = runDocker([
    'buildx',
    'imagetools',
    'inspect',
    ref,
    '--format',
    '{{json .Manifest}}',
  ])

  if (result.status !== 0) {
    if (isMissingImage(ref, result.stdout ?? '', result.stderr ?? '')) {
      return undefined
    }
    throw new Error(`检查镜像失败：${ref}：${commandError(result)}`)
  }

  try {
    const parsed = JSON.parse(result.stdout)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new TypeError('Manifest 不是 JSON 对象')
    }
    return parsed
  }
  catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`检查镜像失败：${ref} 返回无效 Manifest JSON：${detail}`)
  }
}

function validateManifestStructure(manifest, ref) {
  if (!matchesString(manifest.digest, digestPattern)) {
    throw new Error(`镜像 ${ref} 的 digest 不是有效 sha256`)
  }
  const platforms = new Set(
    Array.isArray(manifest.manifests)
      ? manifest.manifests
          .filter(item => typeof item?.platform?.os === 'string' && typeof item?.platform?.architecture === 'string')
          .map(item => `${item.platform.os}/${item.platform.architecture}`)
      : [],
  )
  for (const requiredPlatform of ['linux/amd64', 'linux/arm64']) {
    if (!platforms.has(requiredPlatform)) {
      throw new Error(`镜像 ${ref} 缺少必要平台 ${requiredPlatform}`)
    }
  }
  return manifest
}

function validateCanonicalManifest(manifest, ref, metadata) {
  validateManifestStructure(manifest, ref)
  if (manifest.annotations?.[revisionAnnotation] !== metadata.revision) {
    throw new Error(`镜像 ${ref} 的 revision 缺失或与本次发布不一致`)
  }
  if (manifest.annotations?.[versionAnnotation] !== metadata.projectVersion) {
    throw new Error(`镜像 ${ref} 的 WebUI 版本 annotation 缺失或与本次发布不一致`)
  }
  if (manifest.annotations?.[compatibilityAnnotation] !== metadata.headscaleCompatibility) {
    throw new Error(`镜像 ${ref} 的 Headscale 兼容 annotation 缺失或与本次发布不一致`)
  }
  return manifest
}

function inspectCanonical(ref, metadata, runDocker) {
  const manifest = inspectImageManifest(ref, runDocker)
  return manifest ? validateCanonicalManifest(manifest, ref, metadata) : undefined
}

export function compareSemanticVersions(left, right) {
  if (!matchesString(left, projectVersionPattern) || !matchesString(right, projectVersionPattern)) {
    throw new Error('WebUI version annotation 必须是三段数字版本')
  }
  const leftParts = left.split('.').map(part => BigInt(part))
  const rightParts = right.split('.').map(part => BigInt(part))
  for (let index = 0; index < leftParts.length; index++) {
    if (leftParts[index] > rightParts[index])
      return 1
    if (leftParts[index] < rightParts[index])
      return -1
  }
  return 0
}

function validateAliasManifest(manifest, ref, currentVersion) {
  validateManifestStructure(manifest, ref)
  const aliasRevision = manifest.annotations?.[revisionAnnotation]
  if (!matchesString(aliasRevision, revisionPattern)) {
    throw new Error(`镜像别名 ${ref} 的 revision annotation 必须是 40 位 Git SHA`)
  }
  const version = manifest.annotations?.[versionAnnotation]
  const compatibility = manifest.annotations?.[compatibilityAnnotation]
  if (version === undefined && compatibility === undefined && currentVersion === legacyAliasMigrationVersion) {
    return { ...manifest, legacy: true, version: undefined, compatibility: undefined }
  }
  if (!matchesString(version, projectVersionPattern)) {
    throw new Error(`镜像别名 ${ref} 的版本 annotation 必须是三段数字版本`)
  }
  if (!matchesString(compatibility, compatibilityPattern)) {
    throw new Error(`镜像别名 ${ref} 的兼容 annotation 必须是两段数字版本`)
  }
  return { ...manifest, legacy: false, version, compatibility }
}

function inspectAlias(ref, currentVersion, runDocker) {
  const manifest = inspectImageManifest(ref, runDocker)
  return manifest ? validateAliasManifest(manifest, ref, currentVersion) : undefined
}

function createTags(tags, source, runDocker) {
  if (!/@sha256:[a-f\d]{64}$/i.test(source)) {
    throw new Error(`创建镜像标签失败：source 必须固定到 digest：${source}`)
  }
  const args = ['buildx', 'imagetools', 'create']
  for (const tag of tags) {
    args.push('--tag', tag)
  }
  args.push(source)
  const result = runDocker(args)
  if (result.status !== 0) {
    throw new Error(`创建镜像标签失败：${tags.join('、')}：${commandError(result)}`)
  }
}

function ensureProjectTag({ image, projectRef, canonicalDigest, metadata, runDocker }) {
  let project = inspectCanonical(projectRef, metadata, runDocker)
  if (project) {
    if (project.digest !== canonicalDigest) {
      throw new Error(`项目版本标签 ${projectRef} 与 canonical digest 冲突`)
    }
    return
  }

  createTags([projectRef], `${image}@${canonicalDigest}`, runDocker)
  project = inspectCanonical(projectRef, metadata, runDocker)
  if (!project || project.digest !== canonicalDigest) {
    throw new Error(`项目版本标签 ${projectRef} 创建后校验失败`)
  }
}

function validateAliasKind(alias, ref, kind, targetCompatibility) {
  if (kind === 'hs' && !alias.legacy && alias.compatibility !== targetCompatibility) {
    throw new Error(`兼容系列别名 ${ref} 的 Headscale 兼容 annotation 不匹配`)
  }
}

function verifyAliasPair({ refs, kind, currentVersion, targetCompatibility, canonicalDigest, runDocker }) {
  const [dockerAlias, ghcrAlias] = refs.map(ref => inspectAlias(ref, currentVersion, runDocker))
  if (!dockerAlias || !ghcrAlias || dockerAlias.legacy || ghcrAlias.legacy) {
    throw new Error(`发布后校验失败：镜像别名 ${refs.join('、')} 缺失或仍是 legacy`)
  }
  validateAliasKind(dockerAlias, refs[0], kind, targetCompatibility)
  validateAliasKind(ghcrAlias, refs[1], kind, targetCompatibility)
  if (dockerAlias.version !== ghcrAlias.version || dockerAlias.digest !== ghcrAlias.digest) {
    throw new Error(`发布后校验失败：双 registry 镜像别名 ${refs.join('、')} 的 version 或 digest 不一致`)
  }
  const comparison = compareSemanticVersions(dockerAlias.version, currentVersion)
  if (comparison < 0 || (comparison === 0 && dockerAlias.digest !== canonicalDigest)) {
    throw new Error(`发布后校验失败：镜像别名 ${refs.join('、')} 未指向允许的版本`)
  }
}

function promoteAliasPair({
  images,
  refs,
  kind,
  currentVersion,
  targetCompatibility,
  canonicalDigest,
  runDocker,
}) {
  const aliases = refs.map(ref => inspectAlias(ref, currentVersion, runDocker))
  aliases.forEach((alias, index) => {
    if (alias)
      validateAliasKind(alias, refs[index], kind, targetCompatibility)
  })

  const comparisons = aliases.map(alias => alias && !alias.legacy
    ? compareSemanticVersions(alias.version, currentVersion)
    : -1)
  if (comparisons.some(comparison => comparison > 0)) {
    const [dockerAlias, ghcrAlias] = aliases
    if (
      !dockerAlias
      || !ghcrAlias
      || dockerAlias.legacy
      || ghcrAlias.legacy
      || dockerAlias.version !== ghcrAlias.version
      || dockerAlias.digest !== ghcrAlias.digest
    ) {
      throw new Error(`较新镜像别名状态不一致，请重跑对应的较新发布：${refs.join('、')}`)
    }
    verifyAliasPair({ refs, kind, currentVersion, targetCompatibility, canonicalDigest, runDocker })
    return
  }

  aliases.forEach((alias, index) => {
    if (comparisons[index] === 0 && alias.digest !== canonicalDigest) {
      throw new Error(`镜像别名 ${refs[index]} 与当前版本 canonical digest 冲突`)
    }
  })

  for (let index = 0; index < aliases.length; index++) {
    if (comparisons[index] === 0)
      continue
    createTags([refs[index]], `${images[index]}@${canonicalDigest}`, runDocker)
    const promoted = inspectAlias(refs[index], currentVersion, runDocker)
    if (!promoted || promoted.legacy || promoted.version !== currentVersion || promoted.digest !== canonicalDigest) {
      throw new Error(`镜像别名 ${refs[index]} 创建后校验失败`)
    }
    validateAliasKind(promoted, refs[index], kind, targetCompatibility)
  }

  verifyAliasPair({ refs, kind, currentVersion, targetCompatibility, canonicalDigest, runDocker })
}

export function validatePromotionArguments(args) {
  if (args.length !== 5) {
    throw new Error('镜像标签提升需要 5 个参数：Docker image、GHCR image、项目版本、兼容版本、revision')
  }
  const [dockerImage, ghcrImage, projectVersion, headscaleCompatibility, revision] = args
  for (const [name, image] of [['Docker', dockerImage], ['GHCR', ghcrImage]]) {
    if (!matchesString(image, imagePattern) || image.includes('@')) {
      throw new Error(`${name} 镜像名称无效，必须是不含 tag 和 digest 的小写仓库路径`)
    }
  }
  if (!matchesString(projectVersion, projectVersionPattern)) {
    throw new Error('项目版本必须是三段数字版本，例如 0.0.6')
  }
  if (!matchesString(headscaleCompatibility, compatibilityPattern)) {
    throw new Error('Headscale 兼容版本必须是两段数字版本，例如 0.25')
  }
  if (!matchesString(revision, revisionPattern)) {
    throw new Error('revision 必须是 40 位 Git SHA')
  }
  return { dockerImage, ghcrImage, projectVersion, headscaleCompatibility, revision }
}

export function promoteImageTags({
  dockerImage,
  ghcrImage,
  projectVersion,
  headscaleCompatibility,
  revision,
  runDocker = defaultDockerRunner,
}) {
  validatePromotionArguments([
    dockerImage,
    ghcrImage,
    projectVersion,
    headscaleCompatibility,
    revision,
  ])
  const metadata = { projectVersion, headscaleCompatibility, revision }

  const exactTag = `${projectVersion}-hs${headscaleCompatibility}`
  const refs = {
    dockerExact: `${dockerImage}:${exactTag}`,
    ghcrExact: `${ghcrImage}:${exactTag}`,
    dockerProject: `${dockerImage}:${projectVersion}`,
    ghcrProject: `${ghcrImage}:${projectVersion}`,
    dockerStaging: `${dockerImage}:build-${revision}`,
    ghcrStaging: `${ghcrImage}:build-${revision}`,
  }

  let dockerExact = inspectCanonical(refs.dockerExact, metadata, runDocker)
  let ghcrExact = inspectCanonical(refs.ghcrExact, metadata, runDocker)
  const dockerProject = inspectImageManifest(refs.dockerProject, runDocker)
  const ghcrProject = inspectImageManifest(refs.ghcrProject, runDocker)
  let canonicalDigest

  if (dockerExact || ghcrExact) {
    if (dockerExact && ghcrExact && dockerExact.digest !== ghcrExact.digest) {
      throw new Error('两侧精确标签 exact digest 冲突，拒绝继续发布')
    }
    const existingExact = dockerExact ?? ghcrExact
    canonicalDigest = existingExact.digest
    for (const [name, project] of [['Docker', dockerProject], ['GHCR', ghcrProject]]) {
      if (project && project.digest !== canonicalDigest) {
        throw new Error(`${name} 项目版本标签 project 与 canonical digest 冲突`)
      }
    }

    if (!dockerExact) {
      createTags([refs.dockerExact], `${ghcrImage}@${canonicalDigest}`, runDocker)
    }
    if (!ghcrExact) {
      createTags([refs.ghcrExact], `${dockerImage}@${canonicalDigest}`, runDocker)
    }
  }
  else {
    if (dockerProject || ghcrProject) {
      throw new Error('两侧 exact 均不存在时项目版本标签 project 已存在，拒绝建立新 canonical')
    }
    const dockerStaging = inspectCanonical(refs.dockerStaging, metadata, runDocker)
    const ghcrStaging = inspectCanonical(refs.ghcrStaging, metadata, runDocker)
    if (!dockerStaging || !ghcrStaging) {
      throw new Error('两侧 staging 镜像必须同时存在')
    }
    if (dockerStaging.digest !== ghcrStaging.digest) {
      throw new Error('两侧 staging digest 冲突，拒绝继续发布')
    }

    createTags([refs.dockerExact], `${dockerImage}@${dockerStaging.digest}`, runDocker)
    dockerExact = inspectCanonical(refs.dockerExact, metadata, runDocker)
    if (!dockerExact || dockerExact.digest !== dockerStaging.digest) {
      throw new Error('Docker exact 创建后的 canonical digest 校验失败')
    }
    canonicalDigest = dockerExact.digest
    createTags([refs.ghcrExact], `${dockerImage}@${canonicalDigest}`, runDocker)
  }

  dockerExact = inspectCanonical(refs.dockerExact, metadata, runDocker)
  ghcrExact = inspectCanonical(refs.ghcrExact, metadata, runDocker)
  if (!dockerExact || !ghcrExact || dockerExact.digest !== ghcrExact.digest || dockerExact.digest !== canonicalDigest) {
    throw new Error('两侧精确标签 exact 未形成一致 canonical digest')
  }

  ensureProjectTag({
    image: dockerImage,
    projectRef: refs.dockerProject,
    canonicalDigest,
    metadata,
    runDocker,
  })
  ensureProjectTag({
    image: ghcrImage,
    projectRef: refs.ghcrProject,
    canonicalDigest,
    metadata,
    runDocker,
  })

  const images = [dockerImage, ghcrImage]
  const hsRefs = images.map(image => `${image}:hs${headscaleCompatibility}`)
  const latestRefs = images.map(image => `${image}:latest`)
  promoteAliasPair({
    images,
    refs: hsRefs,
    kind: 'hs',
    currentVersion: projectVersion,
    targetCompatibility: headscaleCompatibility,
    canonicalDigest,
    runDocker,
  })
  promoteAliasPair({
    images,
    refs: latestRefs,
    kind: 'latest',
    currentVersion: projectVersion,
    targetCompatibility: headscaleCompatibility,
    canonicalDigest,
    runDocker,
  })

  for (const checkedRef of [refs.dockerExact, refs.ghcrExact, refs.dockerProject, refs.ghcrProject]) {
    const checked = inspectCanonical(checkedRef, metadata, runDocker)
    if (!checked || checked.digest !== canonicalDigest) {
      throw new Error(`发布后校验失败：${checkedRef} 未指向 canonical digest`)
    }
  }
  verifyAliasPair({ refs: hsRefs, kind: 'hs', currentVersion: projectVersion, targetCompatibility: headscaleCompatibility, canonicalDigest, runDocker })
  verifyAliasPair({ refs: latestRefs, kind: 'latest', currentVersion: projectVersion, targetCompatibility: headscaleCompatibility, canonicalDigest, runDocker })

  return { digest: canonicalDigest }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const promotion = validatePromotionArguments(process.argv.slice(2))
    promoteImageTags(promotion)
    console.log(`镜像标签提升完成：${promotion.projectVersion}-hs${promotion.headscaleCompatibility}`)
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
