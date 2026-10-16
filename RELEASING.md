# Releasing `@brew.new/cli`

Tag-driven, mirroring `@brew.new/sdk`. One command sequence ships npm,
standalone binaries, the GitHub Release, and the Homebrew tap.

## Ship a version

### Canvas SDK Migration Gate

The canvas session commands now use `brew.canvas.sessions.create`, `refresh`,
and `revoke`. This change requires the SDK fix that preserves the revocation
JSON response. Do not release these commands with an SDK version that discards
that response.

For coordinated PR validation, the dependency and Bun lockfile pin the immutable
SDK source commit containing the fix. Bun prepares its distribution from its own
frozen build dependencies. A fresh frozen CLI install must pass all checks using
that source dependency; a locally packed SDK must not hide dependency failures.

Release the SDK first (planned 13.0.0 under its method-signature version policy),
then update `@brew.new/sdk` to `^13.0.0` in this package and regenerate `bun.lock`
from the published registry artifact, replacing the temporary Git source pin.
Run frozen installation, the full checks, and command-doc freshness before
releasing the CLI. Never invent a future lockfile
checksum. The canvas tests must preserve `{ revoked: true }`, the `--yes` gate,
and one-attempt create/refresh requests.

### App email SDK gate

`send`, `app-emails` and the `types` key registry call `brew.send` and
`brew.appEmails`, which no published SDK has yet:
GetBrew/typescript-sdk#55 (`send`, `automations.triggers.fireByKey`) and
GetBrew/typescript-sdk#64 (`appEmails`, the auth adapters), planned as 13.1.0
and 13.2.0, after the SDK's 13.0.0 above. Until 13.2.0 is on npm, the
dependency and `bun.lock` stay on the pin above, and typecheck and parity
fail in CI on these commands. Publish the SDK first, then
`bun add @brew.new/sdk@^13.2.0` (it regenerates `bun.lock` from the
registry; never hand-write a lockfile entry), run a frozen install, the full
checks and `docs:commands:check`, and release the CLI.

```bash
# on a clean main with CI green
npm version <patch|minor|major> --no-git-tag-version
bun run sync:launchers          # brew.new + create-brew follow the CLI version
git add package.json packages/launchers && git commit -m "Release vX.Y.Z"
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
5. Publishes the launchers `brew.new` (`npx brew.new init`) and
   `create-brew` (`npm create brew`) from `packages/launchers/`, after the
   sync check, a pack smoke and a registry smoke install
   (`scripts/smoke-launchers.ts --registry`). Each is the CLI's version and
   depends on exactly that `@brew.new/cli`. This step never fails the
   release: the CLI is already out, so a version npm already has is skipped,
   and a failed check or publish (for example a launcher name the token
   does not own yet) leaves a warning on the run. Neither name is on npm
   today; until they are reserved, docs and generated files point at
   `npx @brew.new/cli`.
6. Rewrites `Formula/brew-cli.rb` in `GetBrew/homebrew-tap`
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

- **The launcher names**: `brew.new` and `create-brew` must be owned on
  npm by the account behind `NPM_TOKEN` (reserve them with a `0.0.x`
  placeholder first), and the token must be allowed to publish unscoped
  packages. Until then the launcher step warns and skips them.

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
