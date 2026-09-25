# Changelog

## 0.8.1

Not tagged or published: `package.json` says 0.8.1, but there is no
`v0.8.1` tag. Pushing the tag publishes it (see `RELEASING.md`).

### Fixed

- `emails get-audit --limit` is 1-50 findings per page (default 10). The
  0.8.0 notes and `--help` said 1-100 / default 100, copied from a spec
  that published the shared list limit; the server refuses a `--limit`
  over 50 with a `400`. The vendored spec and generated types are
  resynced with the live spec after brew-v2#1641.

## 0.8.0

Released 2026-09-25 (tag `v0.8.0`, npm `@brew.new/cli@0.8.0`).

Syncs the CLI with the live public API v1 spec after the MCP task refactor
(brew-v2#1588): 110 operations, and spec parity is back to zero uncovered.
The SDK dependency stays `^10.0.0` because SDK 11 is not on npm yet, so the
three new reads call the API through the raw transport until the CLI adopts
it.

### Breaking

- **`emails preview-clients` starts a rendering job.** The API no longer
  blocks for screenshots. It answers `202` with the admitted job, or `200`
  with the existing job for the same version and clients, and the command
  prints that job: `previewId`, `status` (`queued | running | completed |
  partially_completed | failed`), per-client `status`, `reason` and
  `retryable`, `pending`, `nextPollAfterMs`, `expiresAt` and `credits`. The
  `ready`, `partial` and `processing` values are gone. Poll the job with
  `emails get-client-preview` for the screenshots; while it is `queued` or
  `running`, stderr names that command. The 10 credits are reserved at
  admission and released if nothing renders.
- **Contacts drop `verificationStatus`**, the deprecated mirror of
  `validationStatus`, from contact rows and contact write responses. The CLI
  prints what the API sends, so read `validationStatus`.

### Added

- `emails get-client-preview <previewId>` polls a rendering job
  (`GET /v1/emails/client-previews/{previewId}`). Poll again after
  `nextPollAfterMs` while it is `queued` or `running`. Once it settles, each
  client has its `imageUrl`, or a `reason` and whether it is `retryable`.
  Polling is free and never renders again. An expired or unknown id is
  `404 PREVIEW_NOT_FOUND`.
- `emails get-audit <auditId>` reads a saved audit
  (`GET /v1/emails/audits/{auditId}`): one page of findings with the
  report's summary, checks, metrics and `pagination` (`cursor`, `hasMore`,
  `returned`, `storedFindings`). `--limit` (1-100, default 100) and
  `--cursor` page through the stored findings. Reading is free and never
  reruns the audit. `emails audit` returns the `auditId`; reports are kept
  seven days, then `404 AUDIT_NOT_FOUND`.
- `templates get <templateId>` reads one gallery template
  (`GET /v1/templates/{templateId}`): metadata, `previewImage`, `viewUrl`
  and the `referenceEmailId` that `emails generate --reference-email-id`
  remixes. `--include html` adds the rendered HTML, or a `content.url`
  download link when the page is large. The id is the TEMPLATE column of
  `templates list`. The route is organization-wide, so no brand binding is
  sent. An unknown id is `404 TEMPLATE_NOT_FOUND`.
- Fields the API added, printed as it sends them: `emails get` returns the
  detail row, with `previewStatus` (`available | unavailable | not_ready`)
  and, after a failed generation, `errorMessage` and `errorCause`;
  `automations test` answers with `testMode`, and a test run read through
  `automations runs get` or `list` carries `testCoverage`; `data run` adds
  `stdout`, `stderr`, `pagination` and `retryCommand`; contact write
  warnings name the contact (`email`); send, automation and trigger-contract
  warnings gain `RESUBSCRIBE_SKIPPED` and `RECIPIENTS_EXCLUDED`.

### Fixed

- `emails edit` sends a `title`- or `groupId`-only patch. The API takes
  any of `prompt`, `title`, `subjectLine` and `groupId`, but the CLI exited
  2 unless `--prompt` or `--subject-line` was set. New flags `--title`,
  `--group-id` and `--ungroup` (moves the design to Ungrouped,
  `groupId: null`) cover the free in-place patch without `--input`;
  `--group-id` with `--ungroup` is a usage error.
- `emails preview-clients --email-version-id <id>` renders a saved version
  instead of the latest.

### Not yet

- `emails get` cannot select a saved version or a generation run. The API's
  new `emailVersionId` and `runId` params need SDK 11, whose `emails.get`
  forwards them; SDK 10 sends only `include`. Meanwhile:
  `brew-cli api GET '/v1/emails/<emailId>?emailVersionId=<id>'`.
- Other new request fields have no dedicated flag yet: `templates list`
  takes `query` and `representation`, and `automations test` takes
  `scenario`, through `--input`; the test's `--input` must also carry
  `payload`, or the whole object is sent as the payload.

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
  `flows list --slug` — perform it (also when the id rides `--input`) and
  answer as 0.6 did: that row as a single-row page. `--include` on those lists is accepted only next to its id
  flag; alone (and on `audiences list`) it exits 2 naming the `get` command
  that takes it. `automations audience-runs list --automation-id` is an alias
  of `--automation`, and the list gains `--status`, `--cursor` and `--all`.
  `automations runs list --recipient` is the API's `recipientEmail` filter.
- **`emails list` orders by one timestamp**: `--sort-by updatedAt|createdAt`
  with an inclusive `--since` / `--until` window on it. `--sort` is an alias
  of `--sort-by`; `--created-at-from|to` and `--updated-at-from|to` fold onto
  `--sort-by <column>` plus `--since`/`--until` (one column per page, so
  mixing them, or windowing one column while sorting by the other, exits 2). Pages are newest first: `--order desc` is accepted,
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

### Fixed

- **A trigger-fire refusal is reported as itself.** In 0.6.0 a documented
  `400 INVALID_PAYLOAD` from `automations triggers fire` printed as
  `unknown_error` / `internal_error` with retry advice and a dead
  `docs.getbrew.io` link, and `api POST …/fire` dropped `details`, so neither
  said which field was wrong. Both now print the API's own `code` and
  `type`, fix-the-request advice for a 4xx (retry advice stays on
  408/429/5xx), and the API's `details` — for a payload refusal,
  `details.errors[]` names every offending field. The API answers the fire
  in the standard `{ error: { … } }` envelope; the raw transport also still
  reads the old top-level fire envelope.
- **Error envelopes carry `details`** (additive): `--json` prints the API's
  `details` object verbatim inside `{ error: { … } }`; human mode lists a
  field-error array (`details.errors[]`: `field`, `message`, expected/got
  types) one line per field under the message, and any other shape as a
  single `Details:` JSON line.
- `automations runs list --status` advertised `cancelled` (two L); the API's
  value is `canceled`, so the advertised spelling was the one the server
  refused with `400`. A test pins that `--recipient <email>` reaches the API
  as `recipientEmail`, the one-contact run history.
- `docs` links point at https://docs.brew.new; `docs.getbrew.io` is retired.

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
