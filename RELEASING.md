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
artifact. Contact-import coordination uses the separate gate below.

For future upgrades, release the SDK first, then update the dependency and
regenerate `bun.lock` from its actual published artifact. Run frozen
installation, the full checks, and command-doc freshness before releasing the
CLI. A locally packed SDK must not hide dependency failures, and future
lockfile checksums must never be invented. The canvas tests must preserve
`{ revoked: true }`, the `--yes` gate, and one-attempt create/refresh requests.

### Contact Import SDK Gate

The new `contacts import` command requires `contacts.import`, which the
published SDK 13.2.0 does not expose. This branch pins reviewed SDK source
commit `a02b304ef8942a19dcaa437a097d33b49ad78fe8` for coordinated PR validation.
It preserves SDK 13.2.0's features and version while adding the import method,
its `dryRun` and `onConflict` options, and `flows.get`'s `kind`.

A fresh frozen install must build that source dependency without relying on
a locally packed SDK. Do not release the CLI with this temporary source pin.
Deploy the API contract and release the SDK first, then replace the pin with
the actual published SDK version and regenerate `bun.lock` before releasing
the CLI.

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
