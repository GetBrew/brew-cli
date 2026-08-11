# Changelog

## 0.3.0

The trust layer.

- `brew-cli doctor` — auth validity, API reachability, and installed-CLI
  vs live-API drift (diffed against the server's `GET /v1/help` catalog),
  exit-code gated so agents can depend on it. Validated live against a
  dev deployment: 95 commands, zero drift.
- Nightly spec-drift sentinel workflow: downloads the live published
  spec, diffs operations against the vendored copy, and opens/bumps a
  `spec-drift` issue on divergence.
- Commands can return a non-zero `exitCode` alongside their payload
  (doctor uses it; reports print, then the process gates).
- `skills/brew-cli/SKILL.md` — a focused agent skill covering the trust
  loop, auth/dev targeting, the output/exit-code contract, and safe-send
  guardrails.

## 0.2.0

Full public-API coverage: every one of the 75 spec operations now has a
command (spec skip-list is empty).

- 20 new typed raw-transport commands closing every published-SDK gap:
  `brands list/get/create`, `emails clone/export/import-figma/
  preview-clients/audit-accessibility/create-inbox-placement-test/
  get-inbox-placement-results`, `sends pause/resume`,
  `audiences duplicate/from-events`, `automations run` +
  `audience-runs list/control`, `analytics overview`, `domains health`,
  `chats get`. Marked `transport: raw` in the manifest; each swaps to the
  SDK method when the SDK ships it (the parity sentinel flags the moment).
- Request/response types generated from the vendored OpenAPI spec
  (`bun run generate:types`, CI-freshness-checked) — the same
  openapi-typescript chain the SDK uses.
- `fields create` sends the correct wire names (`fieldName`/`fieldType`)
  and typechecks against the SDK contract without a cast.
- Required positional ids reject empty strings (previously an empty id
  built a malformed path and surfaced as a confusing server 405).
- Error envelopes: legacy top-level `{code,message}` bodies (e.g. the
  trigger fire endpoint) are surfaced instead of a generic fallback.
- Validated end-to-end against a live dev deployment: the full lifecycle
  (fields → contacts → audiences → AI generate/edit → clone → scheduled
  campaign → cancel → automations create/publish/test/fire/unpublish →
  brands/analytics/content) ran through the CLI with zero unwanted email
  deliveries and full resource cleanup.

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
