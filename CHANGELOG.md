# Changelog

## 0.1.1

Adversarial-review + live-validation fix wave.

- SECURITY: the exit-4 confirmation envelope no longer echoes a raw
  `--api-key` value in `confirmCommand`.
- SECURITY/correctness: `--input` bodies can no longer retarget a
  different resource than the positional id on `emails edit`,
  `audiences update`, and `domains update`.
- The `emails send` confirmation summary now reads the merged send
  (including `--input` bodies): inline `test:true` skips the gate,
  audiences/recipients/schedules are named accurately.
- Bare invocations and bare groups (`brew-cli contacts`) now exit 2;
  commander usage errors emit the structured JSON envelope in JSON mode.
- Global flags now work in every position (`brew-cli --json usage`,
  `brew-cli contacts --json count`); the flag nearest the leaf wins.
- `content transform` infers `operation: resize` when sizing knobs are
  present (previously produced a strict-schema 400).
- `whoami` degrades to `usage: null` on server outages instead of
  failing (auth errors still exit 3).
- X-Brand-Id path classification boundary-matches and ignores query
  strings; `api` GET+`--data` is a usage error; query-stringed
  `/v1/health` stays anonymous; transport failures include their cause.
- Removed `emails audit-accessibility`: SDK 8.0.0 issues GET for the
  POST-only spec operation (upstream bug, skip-listed both ways).
- Added derived `domains get`; `emails restore` gained
  `--idempotency-key`.

## 0.1.0

Initial release.

- Command surface over the published `@brew.new/sdk` 8.0.0: contacts,
  fields, emails, sends, audiences, domains, automations (+ triggers,
  runs), analytics, brand, content, templates, plus
  login/logout/whoami/config/usage/health/docs and the `api` escape
  hatch.
- Agent contract: `--json` + auto-JSON on non-TTY, stdout=data /
  stderr=progress, exit codes 0/1/2/3/4, exit-4 confirmation envelopes
  with `confirmCommand`, `--input <json|->` / `--file <path|->` / `--all`
  / `--idempotency-key`, machine-readable `docs --agent` manifest.
- Parity sentinels: SDK-surface and OpenAPI-spec parity tests fail CI
  until every operation has a command or a reviewed skip entry.
- Distribution: npm with provenance, standalone binaries (macOS
  arm64/x64, Linux x64/arm64, Windows x64), Homebrew tap
  (`brew install getbrew/tap/brew-cli`).
