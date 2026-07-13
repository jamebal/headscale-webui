import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export function validateReleaseMetadata(packageJson) {
  if (!/^\d+\.\d+\.\d+$/.test(packageJson.version)) {
    throw new Error('package.json version 必须是三段数字版本，例如 0.0.1')
  }

  if (!/^\d+\.\d+$/.test(packageJson.headscaleCompatibility)) {
    throw new Error('package.json headscaleCompatibility 必须是两段数字版本，例如 0.25')
  }

  return {
    projectVersion: packageJson.version,
    headscaleCompatibility: packageJson.headscaleCompatibility,
  }
}

export function readReleaseMetadata(packageJsonUrl = new URL('../package.json', import.meta.url)) {
  const packageJson = JSON.parse(readFileSync(packageJsonUrl, 'utf8'))
  return validateReleaseMetadata(packageJson)
}

export function formatGitHubEnvironment(metadata) {
  return `PROJECT_VERSION=${metadata.projectVersion}\nHEADSCALE_COMPATIBILITY=${metadata.headscaleCompatibility}`
}

const isDirectExecution = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href

if (isDirectExecution) {
  try {
    console.log(formatGitHubEnvironment(readReleaseMetadata()))
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
