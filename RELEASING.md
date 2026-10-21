# Releasing `@brew.new/cli`

Tag-driven, mirroring `@brew.new/sdk`. One command sequence ships npm,
standalone binaries, the GitHub Release, and the Homebrew tap.

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

### App email SDK gate

`send`, `app-emails` and the `types` key registry call `brew.send` and
`brew.appEmails`, which no published SDK has yet:
GetBrew/typescript-sdk#55 (`send`, `automations.triggers.fireByKey`) and
GetBrew/typescript-sdk#64 (`appEmails`, the auth adapters), planned as 13.1.0
and 13.2.0, after the SDK's 13.0.0 above. Until 13.2.0 is on npm, the
dependency and `bun.lock` stay on the published `^13.0.0`, and typecheck and
parity fail in CI on these commands. Publish the SDK first, then
`bun add @brew.new/sdk@^13.2.0` (it regenerates `bun.lock` from the
registry; never hand-write a lockfile entry), run a frozen install, the full
checks and `docs:commands:check`, and release the CLI.

The API side must be live first: GetBrew/brew-v2#2169 deployed (the by-key
fire, `/v1/app-emails`, the team sandbox), and the live spec
(`https://brew.new/openapi/public-api-v1.yaml`, what the spec-drift
sentinel reads) matching `openapi/public-api-v1.yaml`,
which is #2169 at `6f8ef50544`.

```bash
# on a clean main with CI green
npm version <patch|minor|major> --no-git-tag-version
git add package.json && git commit -m "Release vX.Y.Z"
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z        # <-- triggers .github/workflows/release.yml
```

The workflow then:

1. Asserts `package.json#version` matches the tag.
2. Runs tsc + lint + tests (incl. both parity suites) + docs freshness +
   build.
3. `npm publish --provenance --access public` (`NPM_TOKEN` secret).
4. Compiles standalone binaries via `bun build --compile` for
   darwin-arm64/x64, linux-x64/arm64, windows-x64
   (`scripts/build-binaries.ts`) and attaches them + `checksums.txt` to an
   auto-generated GitHub Release.
5. Rewrites `Formula/brew-cli.rb` in `GetBrew/homebrew-tap`
   (`scripts/update-tap.ts`; skipped with a notice when
   `TAP_GITHUB_TOKEN` is absent).

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

- **`NPM_TOKEN`** (repo secret): npm Automation token with publish access
  to the `@brew.new` org — same recipe as
  [typescript-sdk/RELEASING.md](https://github.com/GetBrew/typescript-sdk/blob/main/RELEASING.md).
- **`TAP_GITHUB_TOKEN`** (repo secret): fine-grained PAT with contents
  write on `GetBrew/homebrew-tap`.
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
