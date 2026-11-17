import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Only registry SemVer specs can ship; a reviewed source pin is development-only. */
export function assertReleaseManifest(manifest, options = {}) {
  if (options.isPublishing) {
    if (!options.npmToken?.trim()) {
      throw new Error(
        'NPM_TOKEN is required for publication; no release was created.'
      )
    }
    if (options.tag !== `v${manifest.version}`) {
      throw new Error('Release tag must exactly match package.json version.')
    }
  }
  const sdk = manifest.dependencies?.['@brew.new/sdk']
  if (
    typeof sdk !== 'string' ||
    !/^[~^]?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(sdk)
  ) {
    throw new Error(
      'Release requires a published registry SDK version (exact, ^ or ~ SemVer). Release the SDK first, then replace the source pin and regenerate bun.lock from the actual registry artifact.'
    )
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
    assertReleaseManifest(manifest, {
      isPublishing: process.argv.includes('--publish'),
      npmToken: process.env.NODE_AUTH_TOKEN,
      tag: process.env.GITHUB_REF_NAME,
    })
    console.log('Release preflight passed.')
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
