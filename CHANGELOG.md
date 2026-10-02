# Changelog

## 0.13.0

Needs `@brew.new/sdk` `^11.6.0` (`insights.list` / `insights.get`,
`emails.comments.list`, `chats.list`, `notifications.list`, and `include` on
`domains.health`, `contacts.get` and `contacts.search`).

Typed reads for what the data command (`data run`, `POST /v1/data`) used to
answer from its tables. `data run` itself is unchanged in this release.

### Added

- **`insights list`** reads Brew Insights (GetBrew/brew-v2#1828): the findings
  the insight engine keeps about the brand's email (at most 200), most severe
  first, with the engine's `freshness` on every page. `--state open|all`,
  `--severity critical|warning|opportunity|info`, `--limit`, `--cursor`,
  `--all`. `--include pulse,report,suggestions,memo` adds what the Insights
  page shows beside the findings: the last 7 days against the 7 before, the
  latest intelligence report, its suggestions (up to 25) and the analysis
  agent's memo, each `null` until it exists. `--all` asks for them on the first
  page only and keeps them, with `freshness`, beside the merged rows. A TTY
  leads with how current the findings are, says when the latest run failed
  (the findings may be stale), and prints each expansion it asked for under
  the table. Free.
- **`insights get <insightId>`**: one finding in full, with its rationale, the
  frozen `metrics` (the only numbers to quote about it), `evidence` links, the
  detector's `method` and the run that produced it. An unknown id and another
  brand's id are the same `404 INSIGHT_NOT_FOUND`. Free.
- **`emails comments list <emailId>`** reads a design's open comment threads,
  newest activity first, as the canvas pins show them (GetBrew/brew-v2#1831):
  where each sits, who is in it, how many messages and the latest one.
  `--include messages` adds each thread's newest messages (author, body,
  mentions; at most 3 threads a page). `--comment-id <cmt_…>` reads one
  thread, `--messages-cursor` its next older messages, and `--comment-id …
  --all` follows that cursor to the first message and prints the whole thread,
  oldest first. A stop mid-walk prints nothing and reports in
  `progress.resumeCursor` the `--messages-cursor` to resume at.
  `--messages-cursor` without `--comment-id`, or `--cursor` with it, exits 2
  before sending. An email the brand does not have is an empty page, not a
  404. Free.
- **`chats list`**: the brand's Brew chats, most recently active first, with
  title (an untitled chat shows its opening prompt on a TTY), status, origin
  and link; `chats get <chatId>` reads one (GetBrew/brew-v2#1831). `--limit`,
  `--cursor`, `--all`. Free.
- **`notifications list`**: the app's bell as a read, newest first: generations,
  sends, imports, domain checks and score runs finishing or failing
  (GetBrew/brew-v2#1831). `--type` keeps one type. A page can hold fewer rows
  than `--limit`, even none, while more follow, so a TTY prints the next
  `--cursor` whenever there is one and `--all` drains through short pages.
  Rows outside the key's scopes are left out, and a comment mention or reply
  never reaches an API key. Reading marks nothing read. Free.
- **`domains health --include scoreHistory,scoreRuns`** adds up to 50 saved
  score snapshots, newest first (`scoreHistory`), and the last 5 automated
  domain score runs (`scoreRuns`) (GetBrew/brew-v2#1830).
- **`contacts get --include openProfile`** and **`contacts search --include
  openProfile`** attach the smart-send open-time profile: 48 UTC half-hour
  open counts, `totalOpens`, `lastOpenedAt`, and once there is enough history
  the best open and send minute (`null` before any opens)
  (GetBrew/brew-v2#1830). The key needs the `emails` scope as well (`403
  INSUFFICIENT_PERMISSIONS` without it). `contacts search` sends it as the
  body's `include` array; a page then holds at most 10 contacts, and a TTY adds
  `OPENS` and `BEST SEND (UTC)` columns.

### Spec sync

- The vendored OpenAPI spec and generated types catch up with the API: the five
  operations above, `include` on `getDomainHealth`, `getContact` and
  `searchContacts`, and `INSIGHT_NOT_FOUND`. They also carry what reached the
  API's main since 0.12.0: the rebuilt email audit (GetBrew/brew-v2#1851:
  `emailJsx` / `emailId` sources, finding `evidence`, an inferred
  `sendingPurpose`) and add-image's `0` / `unknown` answer for an image it
  could not measure (GetBrew/brew-v2#1849).

## 0.12.0

Needs `@brew.new/sdk` `^11.5.0` (`brand.deleteImage`, `content.uploadImage`,
`content.createImageUpload`, `addImage({ uploadId })`).

### Added

- **`content upload-image <file>`** puts a local image file in the brand
  library in one command and prints what `add-image` prints, `assetId`
  included (GetBrew/brew-v2#1819). It opens an upload, POSTs the bytes to its
  `uploadUrl` without the API key (the URL carries its own credential, and is
  never printed in an error), then adds the upload. PNG, JPEG, GIF, WebP,
  AVIF, TIFF or SVG; the type comes from the extension, or `--content-type`.
  `--file-name` sets the name Brew stores it under. A missing or unreadable
  path, a directory, an empty file, an extension it cannot read, a type the
  API does not take, or a file over 20,000,000 bytes (2,097,152 for SVG) exits
  2 before anything is read or sent. Free.
- **`content create-image-upload --file-name --size [--content-type]`**: the
  first step alone, for bytes sent from somewhere else. Prints the `uploadId`,
  `uploadUrl`, `expiresAt` and `maxBytes`, and on a TTY the `curl` and
  `content add-image --upload-id` that finish it (the add-image line keeps the
  `--brand` and `--api-url` it was given). The type is read from the
  name when `--content-type` is absent. No `--idempotency-key`: the route
  never replays (its answer carries a bearer URL).
- **`content add-image --upload-id <id>`** adds an upload whose bytes were
  sent. A repeat returns the same image for 24 hours. `--url`, `--upload-id`
  and an `imageUrls` batch in `--input` are exclusive: two of them exit 2.
- **`brand delete-image <assetId>`** removes one image from the brand library
  and image search, as Delete image on the Assets page does
  (GetBrew/brew-v2#1817). `assetId` is what `brand get-images` lists. It is
  destructive: exit 4 with a `confirmCommand` unless `--yes`, a y/N prompt on
  a TTY. It prints `{ assetId, deleted }`; an id not in the library is
  `deleted: false` and exits 0. The file stays hosted, so emails already using
  it keep rendering. A logo is the API's `400 INVALID_REQUEST`. Free.

### Fixed

- **`content add-image` is free**, and no longer says it consumes credits. Its
  summary said it mirrored an image; it adds it to the brand library and
  returns `{ url, width, height, aspectRatio, assetId }`, which a TTY now
  shows as lines instead of raw JSON.
- `content add-image --input '{"imageUrls":[...]}'` exited 2 ("An image URL is
  required"): a batch import is accepted now and answers the API's `202
  { accepted, skipped, runId }`.
- `content add-image` gives an attempt the SDK's 300 s (the route's own
  limit) instead of 30 s, inside a 300 s whole-command deadline like the
  other long-running commands, so converting a large animation no longer
  times out while the server keeps working. `api POST /v1/content/add-image`
  waits as long.
- A command that sends several requests no longer borrows the replay advice
  of whichever route its last request hit. Every command now answers for
  itself, and only the `api` escape hatch borrows the policy of the route it
  called; the non-replaying advice says "this command does not replay a
  request".

- **`templates list --input '{"count":true}'` (and `groupBy`) no longer
  crashes** with `CLI_UNEXPECTED`: the API's count mode (GetBrew/brew-v2#1821)
  answers `{ count, groups? }`, and the command drew its row table from it in
  every mode. `--json` prints the answer verbatim; a TTY shows `167
  templates`, or one `value  name  count` line per group with the total, the
  group count, the ungrouped count and the `--cursor` for more groups. `--all`
  with a count exits 2 (it pages rows; a count has none).

### Spec sync

- The vendored OpenAPI spec and generated types catch up with the API: the
  two routes above, `uploadId` on add-image and `assetId` on its answer, the
  upload error codes (`404 UPLOAD_NOT_FOUND`, `409 UPLOAD_NOT_RECEIVED`,
  `409 UPLOAD_IN_PROGRESS`, `413 PAYLOAD_TOO_LARGE`), `count` / `groupBy` on
  `GET /v1/templates` (GetBrew/brew-v2#1821), and `409 AUDIENCE_BUILD_ACTIVE`
  on a field delete (GetBrew/brew-v2#1758).

## 0.11.0

Moves to `@brew.new/sdk` `^11.4.0` (typed `total` / `isTotalExact` on
`flows.list`, and the group writes' `moved` / `notMoved`).

### Added

- **`flows list` says how many flows match.** The table now leads with
  `167 flows in total; 25 on this page` from the API's new `total`, which
  counts every flow the query matches across all pages (filters narrow it,
  `--semantic` only orders it), so `flows list --limit 1 --json` answers
  "how many" in one call. When `isTotalExact` is false — the read was cut at
  500 flows — the line says
  `at least …`, and an empty partial read says why instead of `No flows
  found.`, and `--all` counts what it listed (`3 flows in total; 2
  listed`), never "on this page": the API reads at most 500 flows (the newest, or the 500 nearest
  your `--semantic` query) before the filters apply, so matches past those
  are not listed. `--json` passes `total` and `isTotalExact` through, and `--all`
  keeps them on its merged envelope (GetBrew/brew-v2#1805). Against a
  deployment that predates the count, nothing changes.
- **A `--semantic` search the API cannot run** (no search index, or its kill
  switch) now fails with the API's `503 SERVICE_UNAVAILABLE` envelope
  ("Retry without `semantic`") instead of printing an empty table.

- **`emails groups create` / `update --email-ids`** move up to 50 designs
  into a folder in the same call, and `update` no longer requires `--name`, so
  a move alone is one command (GetBrew/brew-v2#1814). The result carries
  `moved` and `notMoved` (each design left where it was, with a reason).
  `update` with neither `--name` nor `--email-ids` exits 2 before sending.

### Spec sync

- The vendored OpenAPI spec and generated types catch up with the API:
  `total` / `isTotalExact` and the `503` on the flows list, `pauseReason:
  'domain_unsendable'`, the `EMAIL_IMAGES_MISSING` error code (`422` on an
  automation run), the trigger update's `409
  CONTRACT_LOCKED_BY_PUBLISHED_AUTOMATIONS`, the payload issue code
  `invalid_email`, and creator attribution on emails, email groups and
  automations (`createdBy` / `createdByUserId`, `publishedBy` /
  `publishedByUserId`; GetBrew/brew-v2#1816).

## 0.10.0

Moves to `@brew.new/sdk` 11 (it pinned `^10.0.0`, so it could not receive an
SDK fix). Every command now goes through an SDK method except the paged
`api-keys list` / `integrations list` reads and the `api` escape hatch, so
they share the SDK's retries and timeouts instead of a single-attempt raw
request.

### Added

- **Cancellation.** Ctrl-C (SIGINT) or SIGTERM stops the request in flight
  wherever it is — connecting, reading the body, backing off, or between
  `--all` pages — and exits `130` / `143` with a `CLI_INTERRUPTED`
  envelope (`type: cancelled`, distinct from the y/N decline
  `CLI_ABORTED`), then re-raises the signal so a calling shell loop stops
  too. A second signal, or 3 s without stopping, exits at once. A
  pre-interrupted command sends nothing.
- **`--timeout <duration>`** (`90`, `90s`, `1500ms`, `5m`): a whole-command
  deadline — every attempt, retry, backoff, `--all` page and response
  body. Long-running commands (`emails generate`/`edit`/`audit`/
  `preview-clients`/`import`/`import-figma`, `content gif`/
  `generate-image`) default to the SDK's own per-call budget; an explicit
  `--timeout` always wins. **`--max-retries <0-10>`** tunes the retry loop.
  Bad values exit 2.
- **Replay advice.** A write whose outcome is unknown — `CLI_TIMEOUT`, the
  new `CLI_CONNECTION`, `CLI_INTERRUPTED`, a 5xx, or `409
  IDEMPOTENCY_IN_PROGRESS` — carries the `idempotencyKey` it was sent with
  and a `retryCommand` that replays it (the API returns the first
  attempt's result) instead of running it twice. A read says nothing
  changed; a route that does not replay says to check state first. An
  interrupted `--all` drain reports `progress` (rows, pages, the cursor to
  resume at).
- `brew-cli api POST` generates an idempotency key when none is given, so
  a failed raw POST can be replayed too.
- `contacts count-by`: exact contact counts per field value, per email
  domain (`--group-by emailDomain`) or per signup period (`--bucket
  day|week|month`), largest group first. `contacts count` gives only the
  total.
- The flags 0.8.1 said would come with SDK 11: `--search` on `emails list`,
  `automations list` and `audiences list`, and `audiences update
  --add-email/--remove-email` (membership by address).

### Fixed

- **A stalled response body no longer hangs the CLI.** SDK timeouts and
  cancellation now cover the body read (`@brew.new/sdk` 11.3), and the raw
  transport and `api` escape hatch — which had no deadline at all — bound
  every attempt, body included: the SDK's 30 s per attempt, or the route's
  own budget when it is long-running (`api POST /v1/emails` waits as long
  as `emails generate`). Pass `--timeout` for longer.
- SDK timeouts report `CLI_TIMEOUT`: they arrived as an `AbortError` that
  fell through to `CLI_UNEXPECTED` (only `emails audit`'s own deadline
  reached `CLI_TIMEOUT`). Failed or dropped connections report
  `CLI_CONNECTION` instead of `CLI_UNEXPECTED`.
- `doctor` and `whoami` no longer turn a Ctrl-C, or their own `--timeout`
  running out, into a report or a warning (`whoami` exited 0 with
  `usage: null`): they stop with `CLI_INTERRUPTED` / `CLI_TIMEOUT`.
- A re-run command (`confirmCommand`, `retryCommand`) never echoes a
  credential header passed to `api --header`: `Authorization`,
  `Proxy-Authorization`, cookies, or any name mentioning an API key, auth, a
  token, secret, password, session or signature.

### Changed

- `@brew.new/sdk` `^10.0.0` → `^11.3.0`. The SDK's own 11.0.0 breaking
  changes are API-side (`emails.previewClients` starts a rendering job, the
  contact `verificationStatus` mirror is gone, `emails.get` returns the
  detail row); the commands already passed those responses through as-is.
- Moved from the raw transport onto SDK methods: `analytics event-counts`,
  `domains unsubscribes list|add|remove|import|export`, `emails get-audit`,
  `emails get-client-preview`, `templates get`, `emails get
  --email-version-id|--run-id`, `brand get-images`, `contracts infer`, and
  `automations triggers contract get|put|validate`. Reads, PUTs and DELETEs
  among them now retry a transient failure; a POST retries with the same
  idempotency key. Five `SDK_SKIP_LIST` entries that existed only because
  of the old pin are gone.
- `analytics event-counts` refuses `cursor` and `automationRunId` from
  `--input` with the API's own reason (exit 2) instead of forwarding them to
  a `400`. `limit` is ignored, as the API ignores it.

## 0.9.0

Its spec is the live one after brew-v2#1708, #1711, #1713 and #1715
(deployed 2026-09-28). #1708 adds `groupBy`/`bucket` to the events read, and the spec
carries brew-v2#1579's per-domain unsubscribe lists, which 0.8.x never had
commands for; `parity-spec` flagged all five routes. It also ships 0.8.1,
which was never tagged.

### Added

- `analytics event-counts`: counts of the email events the same filters
  list, per `--group-by` (one or two of `eventType`, `emailId`,
  `automationId`, `sendId`, `source`, `link`, `recipientDomain`,
  `unsubscribeReason`) and/or `--bucket day|week|month`. Clicks per link:
  `--event-type clicked --group-by link`. Prints the largest groups with the
  total, `otherCount`, and whether the window was truncated. It refuses a
  call with neither `--group-by` nor `--bucket`.
- `domains unsubscribes list|add|remove|import|export`: a marketing domain's
  own unsubscribe list. `add` suppresses the addresses from that domain only,
  `remove` never re-subscribes a brand-wide opt-out, and `import` reads a CSV
  `--file` (or stdin) with `--column`.
- All six use the raw transport until the CLI adopts `@brew.new/sdk` 11.2
  (`analytics.eventCounts`, `domains.unsubscribes.*`).
- `contacts import-csv --date-order month_first|day_first` (brew-v2#1715):
  how to read a date column whose dates read either way (`03/04/2026`). A day
  over 12 in the column wins; without it such a column reads month-first
  with a `DATE_ORDER_ASSUMED` warning. The command also gains `--validate`
  (deliverability check, 2 credits per address), `--consent-source
  api|form|import` (a consent record on every row) and `--input` for the
  full body: the CSV itself, or a consent record with `evidence`, whose
  other fields `--consent-source` keeps. Flags override it.
- `emails clone --title`, `--group-id` and `--group-name`, and
  `emails import-figma --group-id` and `--group-name`: name and file the new
  design, which the API took but the CLI could not send.
- `emails export --sender-email`: the Brevo or Mailjet sender to use.
- `contracts infer` forwards `subjectKind` from the
  `{ "example": {...}, "subjectKind": "trigger" }` form of `--input`; a bare
  example is still sent whole.

### Changed by the API

- `brand get-images` takes `--kind logo|brand|generated` and
  `--sort newest|oldest` and lists the whole asset library the Assets page
  shows, as `ASSET ID`, `KIND`, `URL`, `SIZE`, `ADDED`. brew-v2#1713 retired
  the `type` and `aspectRatio` filters, so `--type` and `--aspect-ratio` (or
  either key in `--input`) now exit 2 naming the way forward. It uses the raw transport, because SDK 10's
  `brand.getImages` cannot send `kind` or `sort`, until the CLI adopts
  `@brew.new/sdk` 11.2.

### Fixed

- `emails export --provider` help and its missing-flag error list `brevo`
  and `mailjet`, which the API accepts.

## 0.8.1

Not tagged or published: `package.json` says 0.8.1, but there is no
`v0.8.1` tag. Pushing the tag publishes it (see `RELEASING.md`).

### Added

- `fields list` sends every parameter its route takes. `--include coverage`
  adds per-field fill stats, `--audience-id <id>` scopes them to one saved
  audience, and `--limit` / `--cursor` / `--all` page. Before, it returned
  the first 100 fields and could not ask for coverage.
- `emails get --email-version-id <id>` reads a saved version (ids from
  `--include versions`), and `--run-id <id>` reads the version a generate or
  edit run produced; pass one or neither. SDK 10's `emails.get` cannot
  select a version, so a selected read uses the raw transport until the CLI
  adopts SDK 11.
- `brands list --status extracting|completed|failed|deleting`, plus
  `--limit` / `--cursor` / `--all`.
- `api-keys list` and `integrations list` take `--limit` / `--cursor` /
  `--all`. SDK 10's methods take no page input, so a paged read uses the raw
  transport; without the flags the command calls the SDK as before.
- `tests/parity-query-params.test.ts` fails when a command without `--input`
  cannot send a query parameter its spec operation takes, as a flag named
  after it in kebab-case. `analytics overview` maps `from` / `to` to
  `--since` / `--until` (RENAMED); `types` follows the trigger-events cursor
  itself (EXEMPT). A stale entry in either map fails too.

### Fixed

- `api-keys create --idempotency-key` no longer promises a safe retry. The
  route never replays a request (a replay would disclose the one-time
  plaintext key again), so a retry mints a second key whatever the key says.
  The flag stays and is still sent (flags are additive-only); its help now
  says so. `tests/idempotency-flags.test.ts` fails when a command promises a
  safe retry on a route whose `x-brew-idempotency` is not `replay` or
  `fail_closed`.
- `emails get-audit --limit` is 1-50 findings per page (default 10). The
  0.8.0 notes and `--help` said 1-100 / default 100, copied from a spec
  that published the shared list limit; the server refuses a `--limit`
  over 50 with a `400`.

### Changed

- The vendored spec and generated types are resynced with the live spec
  after brew-v2#1641, #1645 and #1648. The spec now lists each `--include`
  flag's tokens as `x-brew-include-tokens`; the CLI's help text already
  names the same tokens, and `tests/include-tokens.test.ts` now fails if a
  re-vendored spec and a `--include` help line disagree.
- Resynced again with the live spec after brew-v2#1649, #1650, #1651, #1655,
  #1656, #1658 and #1660. `emails get --include` names the new `text` and
  `links` expansions: the visible body text, and each link destination once
  with its visible text and count. The new list `search`, the audience
  `addEmails` / `removeEmails` edit and contact group counts need SDK 11.1,
  which is not on npm yet, so their flags come when the CLI adopts it.
- Resynced again after brew-v2#1662, #1665 and #1676. The newly typed
  response fields come through as-is:
  - sends and audience runs carry `pauseReason` while paused;
  - an audience run's `nodeStats[].sendId` names each send step's own send;
  - the domain health report types its placement test's `status` and `phase`;
  - `emails restore` answers the restored design.

  No command changes; `--limit` help already says the default is 100.

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
