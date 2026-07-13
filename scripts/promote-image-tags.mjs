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
const failClosedErrorPattern = /\b(?:401|403|429)\b|unauthorized|forbidden|too many requests|no such host|name resolution|network is unreachable|connection (?:refused|reset|timed out)|\btls\b|certificate|credential|executable file not found/i

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

function isMissingImage(ref, stderr) {
  const normalizedRef = normalizeImageRef(ref)
  const message = stderr.trim()
  if (failClosedErrorPattern.test(message)) {
    return false
  }
  return message === `ERROR: ${normalizedRef}: not found`
    || (message.includes(normalizedRef) && /manifest unknown/i.test(message))
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
    if (isMissingImage(ref, result.stderr ?? '')) {
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

function validateCanonicalManifest(manifest, ref, revision) {
  if (!digestPattern.test(manifest.digest ?? '')) {
    throw new Error(`镜像 ${ref} 的 digest 不是有效 sha256`)
  }
  if (manifest.annotations?.[revisionAnnotation] !== revision) {
    throw new Error(`镜像 ${ref} 的 revision 缺失或与本次发布不一致`)
  }

  const platforms = new Set(
    Array.isArray(manifest.manifests)
      ? manifest.manifests.map(item => `${item?.platform?.os}/${item?.platform?.architecture}`)
      : [],
  )
  for (const requiredPlatform of ['linux/amd64', 'linux/arm64']) {
    if (!platforms.has(requiredPlatform)) {
      throw new Error(`镜像 ${ref} 缺少必要平台 ${requiredPlatform}`)
    }
  }
  return manifest
}

function inspectCanonical(ref, revision, runDocker) {
  const manifest = inspectImageManifest(ref, runDocker)
  return manifest ? validateCanonicalManifest(manifest, ref, revision) : undefined
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

export function validatePromotionArguments(args) {
  if (args.length !== 5) {
    throw new Error('镜像标签提升需要 5 个参数：Docker image、GHCR image、项目版本、兼容版本、revision')
  }
  const [dockerImage, ghcrImage, projectVersion, headscaleCompatibility, revision] = args
  for (const [name, image] of [['Docker', dockerImage], ['GHCR', ghcrImage]]) {
    if (!imagePattern.test(image) || image.includes('@')) {
      throw new Error(`${name} 镜像名称无效，必须是不含 tag 和 digest 的小写仓库路径`)
    }
  }
  if (!projectVersionPattern.test(projectVersion)) {
    throw new Error('项目版本必须是三段数字版本，例如 0.0.6')
  }
  if (!compatibilityPattern.test(headscaleCompatibility)) {
    throw new Error('Headscale 兼容版本必须是两段数字版本，例如 0.25')
  }
  if (!revisionPattern.test(revision)) {
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

  const exactTag = `${projectVersion}-hs${headscaleCompatibility}`
  const refs = {
    dockerExact: `${dockerImage}:${exactTag}`,
    ghcrExact: `${ghcrImage}:${exactTag}`,
    dockerProject: `${dockerImage}:${projectVersion}`,
    ghcrProject: `${ghcrImage}:${projectVersion}`,
    dockerStaging: `${dockerImage}:build-${revision}`,
    ghcrStaging: `${ghcrImage}:build-${revision}`,
  }

  let dockerExact = inspectCanonical(refs.dockerExact, revision, runDocker)
  let ghcrExact = inspectCanonical(refs.ghcrExact, revision, runDocker)
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
    const dockerStaging = inspectCanonical(refs.dockerStaging, revision, runDocker)
    const ghcrStaging = inspectCanonical(refs.ghcrStaging, revision, runDocker)
    if (!dockerStaging || !ghcrStaging) {
      throw new Error('两侧 staging 镜像必须同时存在')
    }
    if (dockerStaging.digest !== ghcrStaging.digest) {
      throw new Error('两侧 staging digest 冲突，拒绝继续发布')
    }

    createTags([refs.dockerExact], `${dockerImage}@${dockerStaging.digest}`, runDocker)
    dockerExact = inspectCanonical(refs.dockerExact, revision, runDocker)
    if (!dockerExact || dockerExact.digest !== dockerStaging.digest) {
      throw new Error('Docker exact 创建后的 canonical digest 校验失败')
    }
    canonicalDigest = dockerExact.digest
    createTags([refs.ghcrExact], `${dockerImage}@${canonicalDigest}`, runDocker)
  }

  dockerExact = inspectCanonical(refs.dockerExact, revision, runDocker)
  ghcrExact = inspectCanonical(refs.ghcrExact, revision, runDocker)
  if (!dockerExact || !ghcrExact || dockerExact.digest !== ghcrExact.digest || dockerExact.digest !== canonicalDigest) {
    throw new Error('两侧精确标签 exact 未形成一致 canonical digest')
  }

  for (const [image, exactRef] of [[dockerImage, refs.dockerExact], [ghcrImage, refs.ghcrExact]]) {
    createTags([
      `${image}:${projectVersion}`,
      `${image}:hs${headscaleCompatibility}`,
      `${image}:latest`,
    ], `${exactRef.split(':').slice(0, -1).join(':')}@${canonicalDigest}`, runDocker)
  }

  for (const image of [dockerImage, ghcrImage]) {
    for (const tag of [exactTag, projectVersion, `hs${headscaleCompatibility}`, 'latest']) {
      const checkedRef = `${image}:${tag}`
      const checked = inspectCanonical(checkedRef, revision, runDocker)
      if (!checked || checked.digest !== canonicalDigest) {
        throw new Error(`发布后校验失败：${checkedRef} 未指向 canonical digest`)
      }
    }
  }

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
