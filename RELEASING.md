# Releasing `@brew.new/cli`

Tag-driven, mirroring `@brew.new/sdk`. One command sequence ships npm,
standalone binaries, the GitHub Release, and the Homebrew tap.

## Release protection

Configure the `npm-release` GitHub environment with approval and a deployment
rule for release tags. Keep publish credentials in that environment. Protect
`main` and release tags, grant tag creation to the release operators, and
verify the release commit is on `main` before tagging.

## Ship a version

### Canvas SDK Migration Gate

The canvas session commands now use `brew.canvas.sessions.create`, `refresh`,
and `revoke`. This change requires the SDK fix that preserves the revocation
JSON response. Do not release these commands with an SDK version that discards
that response.

SDK 13.0.0 preserves the revocation JSON response and is the minimum supported
SDK release for these commands. CLI 0.17.0 consumes that published registry
artifact.

For future upgrades, release the SDK first, then update the dependency and
regenerate `bun.lock` from its actual published artifact. Run frozen
installation, the full checks, and command-doc freshness before releasing the
CLI. A locally packed SDK must not hide dependency failures, and future
lockfile checksums must never be invented. The canvas tests must preserve
`{ revoked: true }`, the `--yes` gate, and one-attempt create/refresh requests.

### Contact Import SDK Minimum

`contacts import` and the `contacts import-csv` naming and row results use
`contacts.import` and the import response from SDK 13.3.0, the minimum this
CLI depends on (`^13.3.0`).

### Integration Events SDK Gate

`integrations events list`, `integrations events get` and
`automations triggers ensure-integration-event` call `integrations.events.list`,
`integrations.events.get` and `automations.triggers.ensureIntegrationEvent`,
which the published SDK 13.4.0 does not expose. Until an SDK release has
them, the CLI pins reviewed SDK source commit
`9fbe435d9b135791861739d322fa648c521bdb98` (GetBrew/typescript-sdk#88). It
preserves SDK 13.4.0's features and version while adding those methods.

A fresh frozen install must build that source dependency without relying on
a locally packed SDK. Do not release the CLI with this temporary source pin.
Deploy the API contract (GetBrew/brew-v2#2411) and release the SDK first, then
replace the pin with the actual published SDK version and regenerate
`bun.lock` before releasing the CLI.

### Image Import SDK Gate

`emails import-image` calls `emails.importImage` and imports
`IMPORT_IMAGE_DEFAULT_TIMEOUT_MS`, which no published SDK exposes yet. The
pin is now SDK source commit `ce17a70fafd0cf499649a5498dee30c88c9fc64e`
(GetBrew/typescript-sdk#110), which also contains the integration events
commit above. The API contract is live (GetBrew/brew-v2#3119). Release the
SDK with both, then replace the pin with that published version and
regenerate `bun.lock` before releasing the CLI.

```bash
# on a release branch based on main with CI green
npm version <patch|minor|major> --no-git-tag-version
git add package.json && git commit -m "Release vX.Y.Z"
# Merge the release commit through a reviewed pull request.
git switch main
git pull --ff-only
git tag vX.Y.Z
git push origin vX.Y.Z        # <-- triggers .github/workflows/release.yml
```

The build job checks the tag and runs typecheck, lint, tests, docs freshness,
and the build with read-only repository access. It packages the npm archive
and compiles binaries for macOS arm64 and x64, Linux arm64 and x64, and
Windows x64. [Binary build script](./scripts/build-binaries.ts)

The protected publish job verifies the archive name and version, attaches the
binaries and `checksums.txt` to a GitHub Release, and publishes the same npm
archive with lifecycle scripts disabled. It then runs the tap updater from
the release commit. The updater skips the tap when `TAP_GITHUB_TOKEN` is
absent. [Homebrew updater](./scripts/update-tap.ts)

On a partial failure, rerun the publish job to reuse its original build
artifact. The job accepts an existing npm version only when its SHA-512
integrity matches the archive. It verifies the SHA-256 digests of GitHub
Release assets before updating Homebrew.

The user-visible version comes from `package.json` at build time (tsup
`__CLI_VERSION__` define) — never hand-edit a version constant.

The release job uses GitHub-hosted `ubuntu-latest`: npm rejects provenance
from self-hosted runners. `CI_RUNNER_SMALL` controls CI and the spec sentinel;
it must not select the publishing runner.

## Install channels (what users get)

```bash
npm install -g @brew.new/cli     # or: npx @brew.new/cli …
brew install getbrew/tap/brew-cli
# or download a binary from the GitHub Release
```

## One-time setup

- Store **`NPM_TOKEN`** in the `npm-release` environment. Use a token with
  publish access to the CLI package, following
  [typescript-sdk/RELEASING.md](https://github.com/GetBrew/typescript-sdk/blob/main/RELEASING.md).
- Store **`TAP_GITHUB_TOKEN`** in the same environment. Use a fine-grained PAT
  with contents write on `GetBrew/homebrew-tap`.
- Remove repository-level copies after checking their workflow consumers.
  The release workflow builds and tests before it publishes with npm
  lifecycle scripts disabled.
- The tap repo itself: `GetBrew/homebrew-tap` with a `Formula/` directory
  (the release workflow writes `Formula/brew-cli.rb`).

## Version policy

| Change | Bump |
| --- | --- |
| New command, new flag, new optional behavior | minor |
| Bug fix, docs, internal refactor | patch |
| Removing/renaming a command, flag, exit code, or envelope field | major |

Published versions are immutable — ship a follow-up rather than fixing in
place. `npm deprecate` is the long-term knob.
