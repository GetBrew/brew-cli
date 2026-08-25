# Changelog

## 0.5.0

- **Breaking**: the `transactional` command group (`transactional get`,
  `transactional contract get|put|validate`) and the `types --transaction`
  flag are removed. The platform deleted the standalone transactional-email
  object and all `/v1/transactional*` routes. A transactional email is now
  a trigger-fired automation: create a trigger and an automation whose
  `sendEmail` node uses a transactional-purpose sending domain
  (`sendingPurpose: 'transactional'`), then fire it with
  `POST /v1/automations/triggers/{triggerEventId}/fire`
  (`brew-cli automations triggers fire`). Typed payloads now come from
  trigger payload contracts — the `types` command's triggers output and
  `contracts infer`.

- Added `emails audit --file <html>` for the unified production-readiness
  audit. The command sends the exact HTML, subject, preview text, and sending
  purpose to `POST /v1/emails/audit`. Complete audits cost 5 credits. Partial
  audits cost 0 credits and keep their typed result. The request aborts after
  65 seconds, allowing the server's bounded audit plus transport overhead.
  Audit admission is 6 calls per minute per credential or session and 20 calls
  per minute per organization, with at most 4 concurrent audits per
  organization and 16 globally.

- Spec resync for the Liquid templating release: `payload` on sends is
  the recursive nested-JSON contract (typed end to end via the new
  `scripts/generate-types.mjs`, which emits the self-referencing union
  as a standalone alias so `tsc` accepts it).
- `integrations list`, `api-keys list|create|delete` (create prints the
  plaintext secret exactly once; delete is confirm-gated), and
  `emails groups create|update|delete` beside the existing list, with
  spec parity back to zero uncovered.

- `--subject-line <text>` on `emails generate`, `emails import`,
  `emails import-figma`, and `emails edit` — sets the design's default
  inbox subject (distinct from `--title`, the canvas name). Sends still
  take their own `--subject`.
- `emails edit` no longer requires `--prompt`: pass `--subject-line`
  alone to set the subject without an AI run. That call is a
  deterministic in-place patch server-side — no new version, no credits,
  and it returns immediately instead of printing the 30-90s heartbeat.
  `--email-version-id` still requires `--prompt`.

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

- New typed raw-transport commands closed every published-SDK gap, including:
  `brands list/get/create`, `emails clone/export/import-figma/
  preview-clients/create-inbox-placement-test/
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
