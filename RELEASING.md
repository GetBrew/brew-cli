# Releasing `@brew.new/cli`

Tag-driven, mirroring `@brew.new/sdk`. One command sequence ships npm,
standalone binaries, the GitHub Release, and the Homebrew tap.

## Ship a version

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
