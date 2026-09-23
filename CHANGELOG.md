# Changelog

## 0.7.0

Aligns the CLI with the cleaned-up public API v1 and `@brew.new/sdk ^10`.
Spec parity is back to zero uncovered operations and zero phantom routes.

### Breaking

- **Every `get` is a real detail read.** `audiences get`, `automations get`,
  `contacts get`, `domains get` and `emails get` used to fake a detail read
  by calling the list with an id filter, taking `data[0]`, and constructing
  a 404 by hand. Those list filters now `400`. Each command calls
  `GET /{collection}/{id}` and returns the BARE row, and an unknown id
  surfaces the API's own typed `404` (`AUDIENCE_NOT_FOUND`,
  `AUTOMATION_NOT_FOUND`, `CONTACT_NOT_FOUND`, `DOMAIN_NOT_FOUND`,
  `EMAIL_NOT_FOUND`) instead of a CLI-built one. Output shape is unchanged —
  it was already the bare row.
- **The analytics campaign/send/trigger-instance reports are gone.** The
  command names agents know keep working, retargeted:
  `analytics campaigns` → `GET /v1/sends?kind=campaign` (lifetime `stats`
  ride each send row), `analytics sends list|get` → `GET /v1/sends` and
  `GET /v1/sends/{sendId}`, `analytics trigger-instances list` →
  `GET /v1/automations/trigger-instances`. `analytics` itself now carries
  only the reports: `overview`, `events`, `automations`.
- **Lifecycle changes are action sub-paths, not a body verb.**
  `automations runs cancel <id>` posts to
  `POST /v1/automations/runs/{automationRunId}/cancel` (was
  `PATCH /v1/automations/runs` with `{ automationRunId, status }`) and is an
  SDK call again rather than raw transport. The three audience-run actions
  are `automations audience-runs pause|resume|cancel <audienceRunId>`, one
  command per route; only `cancel` is confirm-gated. `automations
  audience-runs control --action <verb>` stays as sugar over them (command
  names are additive-only after release).
- **Trigger readiness has its own route.** `automations triggers ready` calls
  `GET /v1/automations/triggers/{triggerEventId}/readiness` (was
  `GET …/fire`) and returns the bare
  `{ ready, blockers[], payloadSchema, endpoint, publishedAutomations,
  counts }` body.
- **One status vocabulary** across runs, sends, audience builds and
  inbox-placement tests: `queued | scheduled | running | paused | completed |
  partially_completed | failed | canceled`. A step or node reports
  `running | completed | failed | skipped`; an email design reports
  `generating | ready | failed`. Status FILTERS accept only these, so
  `emails list --status complete` becomes `--status ready`, and
  `--status sent` on sends becomes `--status completed`.
- **Renamed request fields.** `emails export --dry-run` and
  `automations run --dry-run` send `dryRun` — the `dry_run` alias is gone
  from the contract and the runtime always rejected it, and the dry-run
  preview answers `dryRun: true`;
  `emails restore --to-version` now takes an `emailVersionId`, not a version
  NUMBER, and sends `{ emailVersionId }`; `analytics events --recipient`
  maps to `recipient` (was `recipientEmail`) and accepts the CSV rule form
  (an address, `@domain`, or a substring, `!` to exclude).
- **List filters that faked a detail read are shims now, not `400`s.** Every
  resource has a real detail read (`… get <id>`). The 0.6 id flags on the
  lists — `automations runs list --run`, `automations triggers list
  --trigger`, `automations audience-runs list --audience-run-id`, `analytics
  sends list --send`, `analytics trigger-instances list --trigger-instance`,
  `flows list --slug` — perform it and answer as 0.6 did: that row as a
  single-row page. `--include` on those lists is accepted only next to its id
  flag; alone (and on `audiences list`) it exits 2 naming the `get` command
  that takes it. `automations audience-runs list --automation-id` is an alias
  of `--automation`, and the list gains `--status`, `--cursor` and `--all`.
  `automations runs list --recipient` is the API's `recipientEmail` filter.
- **`emails list` orders by one timestamp**: `--sort-by updatedAt|createdAt`
  with an inclusive `--since` / `--until` window on it. `--sort` is an alias
  of `--sort-by`; `--created-at-from|to` and `--updated-at-from|to` fold onto
  `--sort-by <column>` plus `--since`/`--until` (one column per page, so
  mixing them exits 2). Pages are newest first: `--order desc` is accepted,
  `--order asc` exits 2.

### Added

- `sends list` and `sends get <sendId>` — the sends root beside the existing
  `sends cancel|pause|resume`. `sends list` filters by `--email`, `--kind`,
  `--automation`, `--automation-run`, `--audience-run`,
  `--trigger-instance`, `--status`, `--message-class` and an updatedAt
  `--since`/`--until` window, with `--all`; `sends get --include events`
  attaches a bounded first page of the send's events.
- `contacts list` — the contact list read (`GET /v1/contacts`) with
  `--search`, `--audience`, `--sort`, `--order` and `--all`. Typed filter
  clauses and counts stay on `contacts search`.
- Detail reads for every collection that gained one: `fields get
  <fieldName>`, `emails groups get <groupId>`, `automations runs get
  <automationRunId> [--include logs]`, `automations audience-runs get
  <audienceRunId>`, `automations triggers get <triggerEventId>
  [--include skill]`, and `emails inbox-placement-tests get <emailId>
  <testId>`.
- `automations trigger-instances list` and `automations trigger-instances
  get <triggerInstanceId>` — trigger instances moved under automations.
- `emails get-inbox-placement-results --test-id` reads the real detail route
  instead of filtering the list, and the list side gains `--limit` /
  `--cursor`. All three inbox-placement commands bind the nested
  `emails.inboxPlacementTests` resource (`create`, `list`, `get`) — SDK 10
  deleted the flat `emails.createInboxPlacementTest` and
  `emails.getInboxPlacementResults`, and the route was always nested.
- `audiences get --include build` alongside `count`, and `emails groups get`
  accepts the literal `ungrouped`.

### Changed

- `@brew.new/sdk` dependency is `^10.0.0`. Every command binds an SDK
  method or a reviewed skip: no CLI command constructs a fake 404 from an
  empty list page any more, and `SPEC_SKIP_LIST` is empty.
- `sends resume` reports the send back as `running` — `sending` was a ninth
  spelling outside the run vocabulary and is gone. An inbox-placement test
  now starts `queued` and joins the same vocabulary; `collecting` is gone.
- Trigger-instance rows carry a lifecycle `state` enum rather than a bare
  string: `received | verified | matched | partially_fired | fired |
  rejected | dead_letter`. `fired` means every matched automation started,
  `partially_fired` that some starts are still being retried, and `rejected`
  carries a `rejectionReason`. The `automations trigger-instances` commands
  document it so agents can branch on it.
- `automations run` surfaces the API's `AUTOMATION_NOT_FOUND` or
  `AUDIENCE_NOT_FOUND` instead of a generic `NOT_FOUND`; the CLI passes API
  error codes through verbatim, so no mapping special-cases them.

### Also in this release

- `flows list` for the public email flows gallery (`GET /v1/flows`): real
  multi-step sequences by brand, with the day each email landed. List cards
  with `--brand-domain`, `--category`, `--type signup|newsletter`,
  `--semantic`, and `--sort newest|emails|span|remixes` (plus `--all`); in
  0.7.0 one flow is `brew-cli flows get <brand domain>`, which returns its
  `anchor` and every step's `subject`, `dayOffset`, `delayDays`, `category`, `previewImage`,
  and `emailId` (a template reference usable as `referenceEmailId` on
  `emails generate`); `--include html` adds each step's rendered HTML. The
  route is organization-wide, so the brand binding is never sent. Now bound
  to `flows.list` — SDK 10 ships it, so the raw-transport stopgap is gone.
- `automations runs cancel <automationRunId>`: the operator cancel for one
  in-flight run of an event-triggered automation or a test run. Destructive
  — the confirmation protocol applies; `--reason` stores an operator note.
  Nothing further is sent, delivered emails are not recalled, and a canceled
  run can never be resumed (`409 RUN_NOT_CANCELLABLE` once it finished).
- Spec resync to the v1 cleanup: 106 operations, including the per-collection
  detail reads, the sends root, `/v1/contacts`,
  `/v1/automations/trigger-instances`, the trigger readiness probe, and the
  run / audience-run action sub-paths.

## Unreleased
- **Fixed**: `automations runs list --status canceled` — the help text and
  the command reference spelled the terminal status `cancelled` (two L); the
  API's enum is `canceled` (one L), so the advertised value was the one the
  server refused with `400`. Both now say `canceled`, and a test pins that
  `--recipient <email>` reaches the API as `recipientEmail` (the one-contact
  run history the server honours since brew-v2 #1621).
- Spec mirror resynced with brew-v2 `main`: the fire `400 payload_mismatch`
  now declares `details.errors[]` / `payloadSchema` / `contractHash` /
  `enforcement` and shows the code the API sends (`INVALID_PAYLOAD`), and the
  runs list documents `recipientEmail`. Generated types follow.
- **Fixed**: a trigger-fire refusal is reported as itself. `POST
  /v1/automations/triggers/{id}/fire` answers with the legacy fire envelope
  (top-level `code`/`message`/`details`, no `error` wrapper, no `type`).
  The raw transport behind `api POST …/fire` kept `code` and `message` but
  dropped `details` — so a `400 INVALID_PAYLOAD` never said which field
  was wrong — and labelled the refusal `type: internal_error`. It now keeps
  `details` and `body`, derives `type` from the HTTP status (`400`/`422`
  → `invalid_request`, `404` → `not_found`, …), and gives a 4xx a
  fix-the-request suggestion instead of retry advice. The typed
  `automations triggers fire` goes through `@brew.new/sdk`; this release
  pins `^9.3.0`, which maps the same envelope, so the typed path prints the
  same `code` and field errors (pinned by an MSW test on the typed command).
- Error envelopes carry `details` (additive): `--json` prints the API's
  `details` object verbatim inside `{ error: { … } }`; human mode lists a
  field-error array (`details.errors[]`: `field`, `message`, expected/got
  types) one line per field under the message, and any other shape as a
  single `Details:` JSON line.
- `docs` points at https://docs.brew.new; `docs.getbrew.io` is retired.

- Raised `@brew.new/sdk` to `^9.2.0`, which ships `flows.list` and
  `automations.runs.cancel`, and moved both commands off the raw transport
  onto the typed client. `Flow.brand` is `{ name, logo? }` in 9.2.0
  (`domain` duplicated `slug` and was dropped); the BRAND column already
  read `brand.name`, so the rendered table is unchanged. The payload
  contract commands still use the raw transport.
- Added `flows list` for the public email flows gallery (`GET /v1/flows`):
  real multi-step sequences by brand, with the day each email landed. List
  cards with `--brand-domain`, `--category`, `--type signup|newsletter`,
  `--semantic`, and `--sort newest|emails|span|remixes` (plus `--all`), or
  fetch one flow with `--slug <brand domain>` for its `anchor` and every
  step's `subject`, `dayOffset`, `delayDays`, `category`, `previewImage`,
  and `emailId` (a template reference usable as `referenceEmailId` on
  `emails generate`); `--include html` adds each step's rendered HTML. The
  route is organization-wide, so the brand binding is never sent. Bound
  through `brew.flows.list(...)`.
- Added `automations runs cancel <automationRunId>` (`PATCH
  /v1/automations/runs`): the operator cancel for one in-flight run of an
  event-triggered automation or a test run. Destructive — the confirmation
  protocol applies; `--reason` stores an operator note. Nothing further is
  sent, delivered emails are not recalled, and a canceled run can never be
  resumed (`409 RUN_NOT_CANCELLABLE` once it finished). Bound through
  `brew.automations.runs.cancel(...)`, which fills in `status: 'canceled'`
  so the command sends only the run id and an optional note.
- Spec resync: `GET /v1/flows` (`Flow`, `FlowStep`, `FlowsListResponse`,
  `FLOW_NOT_FOUND`) and `PATCH /v1/automations/runs`
  (`AutomationRunCancelRequest` / `AutomationRunCancelResponse`).

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
