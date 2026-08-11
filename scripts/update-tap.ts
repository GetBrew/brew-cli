import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Rewrites Formula/brew-cli.rb in GetBrew/homebrew-tap after a release,
 * using the GitHub contents API (no clone needed). Requires:
 *   TAP_GITHUB_TOKEN — a token with repo write on GetBrew/homebrew-tap
 *   dist-bin/checksums.txt — produced by scripts/build-binaries.ts
 * Runs as the final release.yml step; exits 0 with a notice when the
 * token is absent so releases still succeed before the tap is wired.
 */

const token = process.env.TAP_GITHUB_TOKEN
if (token === undefined || token === '') {
  console.log('TAP_GITHUB_TOKEN not set — skipping Homebrew tap bump.')
  process.exit(0)
}

const root = join(import.meta.dirname, '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as {
  version: string
}
const checksums = new Map<string, string>()
for (const line of readFileSync(join(root, 'dist-bin/checksums.txt'), 'utf8')
  .trim()
  .split('\n')) {
  const [digest, artifact] = line.trim().split(/\s+/)
  if (digest !== undefined && artifact !== undefined) {
    checksums.set(artifact, digest)
  }
}

function sha(artifact: string): string {
  const digest = checksums.get(artifact)
  if (digest === undefined) {
    console.error(`missing checksum for ${artifact}`)
    process.exit(1)
  }
  return digest
}

const version = pkg.version
const base = `https://github.com/GetBrew/brew-cli/releases/download/v${version}`
const formula = `class BrewCli < Formula
  desc "Official agent-first CLI for the Brew public API"
  homepage "https://github.com/GetBrew/brew-cli"
  version "${version}"
  license "MIT"

  on_macos do
    if Hardware::CPU.arm?
      url "${base}/brew-cli-darwin-arm64"
      sha256 "${sha('brew-cli-darwin-arm64')}"
    else
      url "${base}/brew-cli-darwin-x64"
      sha256 "${sha('brew-cli-darwin-x64')}"
    end
  end

  on_linux do
    if Hardware::CPU.arm?
      url "${base}/brew-cli-linux-arm64"
      sha256 "${sha('brew-cli-linux-arm64')}"
    else
      url "${base}/brew-cli-linux-x64"
      sha256 "${sha('brew-cli-linux-x64')}"
    end
  end

  def install
    binary = Dir["brew-cli-*"].first
    bin.install binary => "brew-cli"
  end

  test do
    system "#{bin}/brew-cli", "--version"
  end
end
`

const apiUrl =
  'https://api.github.com/repos/GetBrew/homebrew-tap/contents/Formula/brew-cli.rb'
const headers = {
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
  'user-agent': 'brew-cli-release',
}

const current = await fetch(apiUrl, { headers })
let existingSha: string | undefined
if (current.ok) {
  const body = (await current.json()) as { sha?: string }
  existingSha = body.sha
} else if (current.status !== 404) {
  console.error(`tap lookup failed: ${current.status}`)
  process.exit(1)
}

const update = await fetch(apiUrl, {
  method: 'PUT',
  headers,
  body: JSON.stringify({
    message: `brew-cli ${version}`,
    content: Buffer.from(formula).toString('base64'),
    ...(existingSha === undefined ? {} : { sha: existingSha }),
  }),
})
if (!update.ok) {
  console.error(`tap update failed: ${update.status} ${await update.text()}`)
  process.exit(1)
}
console.log(`Homebrew tap updated to ${version}.`)
