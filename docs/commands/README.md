# brew-cli command reference

<!-- GENERATED FILE — do not edit. Regenerate with `bun run docs:commands`. -->

130 commands. Classes: read (always safe), write
(mutating, retry-safe), destructive (irreversible — the confirmation
protocol applies: interactive y/N on a TTY, exit 4 + JSON envelope with
a `confirmCommand` otherwise, `--yes` to proceed).

## Global flags

- `--json` — JSON output (automatic when stdout is not a TTY)
- `--quiet` — Suppress progress messages on stderr
- `--yes` — Skip the confirmation gate on destructive commands
- `--api-key <key>` — Brew API key (else BREW_API_KEY, else stored login)
- `--brand <brandId>` — Brand id for organization-scoped keys (else BREW_BRAND_ID)
- `--api-url <url>` — API base URL (else BREW_API_URL, else https://brew.new/api)

## Commands

| Command | Class | API route | Summary |
| --- | --- | --- | --- |
| `brew-cli login` | write | — | Store an API key for this machine (validated against the API) |
| `brew-cli logout` | write | — | Remove the stored API key from this machine |
| `brew-cli whoami` | read | — | Show the resolved credential, brand, and API target |
| `brew-cli config list` | read | — | Show the stored configuration (API key masked) |
| `brew-cli config get` | read | — | Read one stored configuration value |
| `brew-cli config set` | write | — | Store a configuration value (brandId or apiUrl) |
| `brew-cli config unset` | write | — | Remove a stored configuration value (brandId or apiUrl) |
| `brew-cli contacts list` | read | `GET /v1/contacts` | List contacts, newest first — free-text search and one audience; typed clauses are `contacts search` |
| `brew-cli contacts search` | read | `POST /v1/contacts/search` | Search contacts with structured filters (the contacts read) |
| `brew-cli contacts get` | read | `GET /v1/contacts/{email}` | Fetch one contact by email — the bare row |
| `brew-cli contacts count` | read | `POST /v1/contacts/search` | Count contacts matching a filter |
| `brew-cli contacts upsert` | write | `POST /v1/contacts` | Create or update one contact by email |
| `brew-cli contacts upsert-many` | write | `POST /v1/contacts` | Create or update a batch of contacts (up to 100 per call) |
| `brew-cli contacts update` | write | `PATCH /v1/contacts/{email}` | Partially update one contact (PATCH; never retried) |
| `brew-cli contacts delete` | destructive | `DELETE /v1/contacts/{email}` | Delete one contact by email (idempotent) |
| `brew-cli contacts delete-many` | destructive | `POST /v1/contacts/batch-delete` | Delete up to 1000 contacts by email |
| `brew-cli contacts validate` | write ($) | `POST /v1/contacts/validate` | Batch-validate email deliverability (no contacts created) |
| `brew-cli contacts import-csv` | write | `POST /v1/contacts/import-csv` | Bulk-import contacts from a CSV file or stdin |
| `brew-cli fields list` | read | `GET /v1/fields` | List custom contact fields |
| `brew-cli fields get` | read | `GET /v1/fields/{fieldName}` | Fetch one contact field definition by name — the bare row |
| `brew-cli fields create` | write | `POST /v1/fields` | Create a custom contact field |
| `brew-cli fields delete` | destructive | `DELETE /v1/fields/{fieldName}` | Delete a custom field definition |
| `brew-cli emails list` | read | `GET /v1/emails` | List email designs; one design is `emails get` |
| `brew-cli emails groups list` | read | `GET /v1/email-groups` | List email groups in display order, including Ungrouped |
| `brew-cli emails groups get` | read | `GET /v1/email-groups/{groupId}` | Fetch one email group by id — the bare row |
| `brew-cli emails groups create` | write | `POST /v1/email-groups` | Create a named email folder (group) |
| `brew-cli emails groups update` | write | `PATCH /v1/email-groups/{groupId}` | Rename an email folder (group) |
| `brew-cli emails groups delete` | destructive | `DELETE /v1/email-groups/{groupId}` | Delete an email folder (group); its emails move to Ungrouped |
| `brew-cli emails get` | read | `GET /v1/emails/{emailId}` | Fetch one email design by id — the bare row |
| `brew-cli emails generate` | write ($) | `POST /v1/emails` | Generate a new on-brand email design from a prompt |
| `brew-cli emails import` | write | `POST /v1/emails/import` | Import existing HTML, MJML, or JSX as a new editable design |
| `brew-cli emails import-figma` | write | `POST /v1/emails/figma` | Convert one Figma frame into an editable design (deterministic, free) |
| `brew-cli emails edit` | write ($) | `PATCH /v1/emails/{emailId}` | AI-edit an email design, and/or set its subject line, title or group (free without a prompt) |
| `brew-cli emails clone` | write | `POST /v1/emails/{emailId}/clone` | Clone a design into a new one (exact snapshot copy, no AI) |
| `brew-cli emails restore` | write | `POST /v1/emails/{emailId}/restore` | Restore a previous version as the new latest (non-destructive) |
| `brew-cli emails delete` | destructive | `DELETE /v1/emails/{emailId}` | Hard-delete an email design and all its versions (idempotent) |
| `brew-cli emails export` | write | `POST /v1/emails/{emailId}/export` | Export a design to a connected ESP as a template (not a send) |
| `brew-cli emails audit` | write ($) | `POST /v1/emails/audit` | Audit raw email content for production readiness (5 credits when complete) |
| `brew-cli emails get-audit` | read | `GET /v1/emails/audits/{auditId}` | Read a saved email audit: one page of its findings (free; never reruns the audit) |
| `brew-cli emails preview-clients` | write ($) | `POST /v1/emails/{emailId}/client-previews` | Start a rendering job across real email clients (10 credits); poll it with `emails get-client-preview` |
| `brew-cli emails get-client-preview` | read | `GET /v1/emails/client-previews/{previewId}` | Poll a client-preview rendering job: per-client screenshot links once it settles (free; never re-renders) |
| `brew-cli emails create-inbox-placement-test` | write ($) | `POST /v1/emails/{emailId}/inbox-placement-tests` | Seed-test where the design lands (inbox vs spam) via a real small send (10 credits) |
| `brew-cli emails get-inbox-placement-results` | read | `GET /v1/emails/{emailId}/inbox-placement-tests` | Inbox placement results: the recent tests, or one test with --test-id |
| `brew-cli emails inbox-placement-tests get` | read | `GET /v1/emails/{emailId}/inbox-placement-tests/{testId}` | Fetch one inbox-placement (seed) test — the bare row, re-poll ~30s until completed |
| `brew-cli emails send` | destructive | `POST /v1/sends` | Send an email: a real campaign, or a safe test with --test |
| `brew-cli sends list` | read | `GET /v1/sends` | List sends (the unit of delivery and analytics) with lifetime stats |
| `brew-cli sends get` | read | `GET /v1/sends/{sendId}` | Fetch one send by id — the bare row with its lifetime stats |
| `brew-cli sends cancel` | destructive | `POST /v1/sends/{sendId}/cancel` | Cancel a scheduled or queued send before it goes out |
| `brew-cli sends pause` | write | `POST /v1/sends/{sendId}/pause` | Pause an in-flight or scheduled send (resumable) |
| `brew-cli sends resume` | write | `POST /v1/sends/{sendId}/resume` | Resume a paused gradual send (the unsent tail is re-spread); the send reports `running` again |
| `brew-cli types` | read | `GET /v1/automations/triggers` | Generate TypeScript payload contracts for this workspace's triggers into your codebase; --check is the CI drift gate (exit 1 on drift). Needs the automations scope |
| `brew-cli audiences list` | read | `GET /v1/audiences` | List audience segments; one segment is `audiences get` |
| `brew-cli audiences get` | read | `GET /v1/audiences/{audienceId}` | Fetch one audience segment by id — the bare row |
| `brew-cli audiences create` | write | `POST /v1/audiences` | Create an audience segment from a filter definition |
| `brew-cli audiences update` | write | `PATCH /v1/audiences/{audienceId}` | Update an audience segment (name and/or filters) |
| `brew-cli audiences duplicate` | write | `POST /v1/audiences/{audienceId}/duplicate` | Copy an audience segment (the copy gets a "(copy)" name) |
| `brew-cli audiences from-events` | write | `POST /v1/audiences/from-events` | Create a frozen audience snapshot from analytics events (async build) |
| `brew-cli audiences delete` | destructive | `DELETE /v1/audiences/{audienceId}` | Delete an audience segment (contacts are kept) |
| `brew-cli automations list` | read | `GET /v1/automations` | List automations (lean rows; `automations get` for the graph) |
| `brew-cli automations get` | read | `GET /v1/automations/{automationId}` | Fetch one automation by id — the bare row, lean by default |
| `brew-cli automations create` | write | `POST /v1/automations` | Create an automation from a graph JSON (starts unpublished) |
| `brew-cli automations update` | write | `PATCH /v1/automations/{automationId}` | Update automation metadata and/or its graph (PATCH) |
| `brew-cli automations publish` | write | `PATCH /v1/automations/{automationId}` | Publish an automation — arms it for live fires; does not itself send |
| `brew-cli automations unpublish` | write | `PATCH /v1/automations/{automationId}` | Unpublish an automation so new trigger fires no longer start runs |
| `brew-cli automations delete` | destructive | `DELETE /v1/automations/{automationId}` | Delete an automation and its version history (cascade) |
| `brew-cli automations test` | write | `POST /v1/automations/{automationId}/test` | Start a suppression-aware TEST run (no real mail is sent) |
| `brew-cli automations run` | destructive | `POST /v1/automations/{automationId}/run` | Run a manual-audience automation (live send; --dry-run previews) |
| `brew-cli automations triggers list` | read | `GET /v1/automations/triggers` | List trigger events (their payload schemas drive fires); one trigger is `automations triggers get` |
| `brew-cli automations triggers get` | read | `GET /v1/automations/triggers/{triggerEventId}` | Fetch one trigger by id — the bare row with its payload schema |
| `brew-cli automations triggers ready` | read | `GET /v1/automations/triggers/{triggerEventId}/readiness` | Preflight a trigger without firing: key + scope + permissions pass/fail, the payload contract, and what a fire would start |
| `brew-cli automations triggers contract get` | read | `GET /v1/automations/triggers/{triggerEventId}/contract` | Read a trigger payload contract: stored when declared, derived otherwise; --format renders ts/zod/jsonschema/skill |
| `brew-cli automations triggers contract put` | write | `PUT /v1/automations/triggers/{triggerEventId}/contract` | Declare (or replace) the stored payload contract for a trigger — tree-validated before any write; omitting --enforcement leaves the stored setting unchanged |
| `brew-cli automations triggers contract validate` | read | `POST /v1/automations/triggers/{triggerEventId}/contract/validate` | Dry-run a payload against a trigger's contract (the fire path's validator) — never fires; invalid payloads still exit 0 |
| `brew-cli contracts infer` | read | `POST /v1/payload-contracts/infer` | Draft a payload contract from a real example payload — nothing is saved; PUT the draft on a trigger |
| `brew-cli data run` | read | `POST /v1/data` | Run a `db …` command over the brand's data |
| `brew-cli automations triggers create` | write | `POST /v1/automations/triggers` | Create a trigger event (title + typed payload schema) |
| `brew-cli automations triggers update` | write | `PATCH /v1/automations/triggers/{triggerEventId}` | Update a trigger event (title, description, payload schema) |
| `brew-cli automations triggers delete` | destructive | `DELETE /v1/automations/triggers/{triggerEventId}` | Delete a trigger event (rejected while automations depend on it) |
| `brew-cli automations triggers fire` | destructive | `POST /v1/automations/triggers/{triggerEventId}/fire` | Fire a trigger event with a payload (starts LIVE runs) |
| `brew-cli automations runs list` | read | `GET /v1/automations/runs` | List automation runs (live + test history); one run is `automations runs get` |
| `brew-cli automations runs get` | read | `GET /v1/automations/runs/{automationRunId}` | Fetch one automation run by id — the bare row |
| `brew-cli automations runs cancel` | destructive | `POST /v1/automations/runs/{automationRunId}/cancel` | Cancel one in-flight automation run (event execution or test run) — nothing further is sent, and it can never be resumed |
| `brew-cli automations audience-runs list` | read | `GET /v1/automations/audience-runs` | List manual-audience runs, newest first; one run is `automations audience-runs get` |
| `brew-cli automations audience-runs get` | read | `GET /v1/automations/audience-runs/{audienceRunId}` | Fetch one manual-audience run by id — the bare row |
| `brew-cli automations audience-runs pause` | write | `POST /v1/automations/audience-runs/{audienceRunId}/pause` | Pause a running manual-audience run at its next step boundary (resumable) |
| `brew-cli automations audience-runs resume` | write | `POST /v1/automations/audience-runs/{audienceRunId}/resume` | Resume a paused manual-audience run, or restart a failed one from its first undelivered send |
| `brew-cli automations audience-runs cancel` | destructive | `POST /v1/automations/audience-runs/{audienceRunId}/cancel` | Cancel a manual-audience run for good — it can never be resumed |
| `brew-cli automations audience-runs control` | destructive | — | Pause, resume, or cancel an in-flight manual-audience run (0.6 form of `audience-runs pause|resume|cancel`) |
| `brew-cli automations trigger-instances list` | read | `GET /v1/automations/trigger-instances` | List fired-trigger instances (the inbound-fire audit log); each row carries a lifecycle `state` |
| `brew-cli automations trigger-instances get` | read | `GET /v1/automations/trigger-instances/{triggerInstanceId}` | Fetch one fired-trigger instance by id — the bare row, with its lifecycle `state` and the runs it started |
| `brew-cli analytics overview` | read | `GET /v1/analytics/overview` | Brand overview: totals, rates, timeseries (default last 7 days) |
| `brew-cli analytics campaigns` | read | `GET /v1/sends` | Lifetime per-campaign KPIs (`sends list --kind campaign`; stats ride each row) |
| `brew-cli analytics automations` | read | `GET /v1/analytics/automations` | Windowed per-automation performance + totals |
| `brew-cli analytics events` | read | `GET /v1/analytics/events` | Unified event explorer (email, automation, trigger, inbound) |
| `brew-cli analytics sends list` | read | `GET /v1/sends` | List campaign/automation sends with delivery stats (`sends list`) |
| `brew-cli analytics sends get` | read | `GET /v1/sends/{sendId}` | Fetch one send by id — the bare row (`sends get`) |
| `brew-cli analytics trigger-instances list` | read | `GET /v1/automations/trigger-instances` | List fired-trigger instances with their lifecycle `state` (`automations trigger-instances list`) |
| `brew-cli brand get` | read | `GET /v1/brand` | Fetch the key's brand + extraction readiness (`ready` flag) |
| `brew-cli brand update` | write | `PATCH /v1/brand` | Update brand identity and/or design-system markdown (PATCH) |
| `brew-cli brand get-images` | read | `GET /v1/brand/images` | Browse or semantically search the brand's image library |
| `brew-cli brands list` | read | `GET /v1/brands` | List every brand in the organization |
| `brew-cli brands get` | read | `GET /v1/brands/{brandId}` | One brand's lifecycle state (the extraction polling endpoint) |
| `brew-cli brands create` | write | `POST /v1/brands` | Create a brand and start async extraction (needs an ORGANIZATION-scoped key); poll `brands get` until ready |
| `brew-cli api-keys list` | read | `GET /v1/api-keys` | List API keys in the organization (already-redacted `keyPreview`, never the secret) |
| `brew-cli api-keys create` | write | `POST /v1/api-keys` | Mint an API key; the plaintext `key` is returned ONCE — this output is the only copy |
| `brew-cli api-keys delete` | destructive | `DELETE /v1/api-keys/{keyId}` | Revoke an API key |
| `brew-cli domains list` | read | `GET /v1/domains` | List sending domains with verification state and DNS records |
| `brew-cli domains get` | read | `GET /v1/domains/{domainId}` | Fetch one sending domain by id — the bare row |
| `brew-cli domains add` | write | `POST /v1/domains` | Add a sending domain (response lists the DNS records to set) |
| `brew-cli domains verify` | write | `POST /v1/domains/{domainId}/verify` | Re-check DNS records and refresh domain verification |
| `brew-cli domains health` | read | `GET /v1/domains/{domainId}/health` | Deliverability health: verdict, signals, DNS/auth, reputation |
| `brew-cli domains update` | write | `PATCH /v1/domains/{domainId}` | Update default sender settings for a domain |
| `brew-cli domains delete` | destructive | `DELETE /v1/domains/{domainId}` | Delete a sending domain |
| `brew-cli content generate-image` | write ($) | `POST /v1/content/generate-image` | Generate or edit an image from a prompt |
| `brew-cli content gif` | write ($) | `POST /v1/content/gif` | Create an animated GIF from a prompt, image, or video |
| `brew-cli content transform` | write ($) | `POST /v1/content/transform` | Optimize or resize a hosted image |
| `brew-cli content html-to-png` | write ($) | `POST /v1/content/html-to-png` | Render HTML to a hosted PNG |
| `brew-cli content add-image` | write ($) | `POST /v1/content/add-image` | Mirror an external image onto Brew-hosted storage |
| `brew-cli templates list` | read | `GET /v1/templates` | List public templates (each row carries the rendered html) |
| `brew-cli templates get` | read | `GET /v1/templates/{templateId}` | Fetch one public template: its links and the referenceEmailId to remix; --include html adds its HTML |
| `brew-cli flows list` | read | `GET /v1/flows` | List public email flows (real multi-step sequences by brand) as cards; `flows get <slug>` reads one |
| `brew-cli flows get` | read | `GET /v1/flows/{slug}` | Fetch one public email flow by brand domain, with every step (day offset, wait, subject, template id) |
| `brew-cli integrations list` | read | `GET /v1/integrations` | List the integration catalog with per-provider connected state (connect via Settings, not this CLI) |
| `brew-cli chats get` | read | `GET /v1/chats/{chatId}` | Brand-scoped digest of a Brew chat (artifacts + transcript tail) |
| `brew-cli health` | read | `GET /v1/health` | Check Brew API liveness (no auth required) |
| `brew-cli usage` | read | `GET /v1/usage` | Show plan, credit balance, and email-send quota |
| `brew-cli doctor` | read | — | Trust check: auth, API reachability, and installed-CLI vs live-API drift |
| `brew-cli docs` | read | — | Documentation pointers; --agent prints the command manifest |
| `brew-cli docs api` | read | `GET /v1/help` | Fetch the live machine-readable API catalog (GET /v1/help) |
| `brew-cli api` | destructive | — | Raw authenticated request against the Brew public API |

## Details

### brew-cli login

Store an API key for this machine (validated against the API)

- Class: write

```bash
brew-cli login
brew-cli login --api-key brew_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
echo "$BREW_API_KEY" | brew-cli login
```

### brew-cli logout

Remove the stored API key from this machine

- Class: write

```bash
brew-cli logout
```

### brew-cli whoami

Show the resolved credential, brand, and API target

- Class: read

```bash
brew-cli whoami
brew-cli whoami --json
```

### brew-cli config list

Show the stored configuration (API key masked)

- Class: read

```bash
brew-cli config list
```

### brew-cli config get

Read one stored configuration value

- Class: read
- Argument `key` — brandId | apiUrl | apiKey

```bash
brew-cli config get brandId
```

### brew-cli config set

Store a configuration value (brandId or apiUrl)

- Class: write
- Argument `key` — brandId | apiUrl
- Argument `value` — The value to store

```bash
brew-cli config set brandId bd_123
```

### brew-cli config unset

Remove a stored configuration value (brandId or apiUrl)

- Class: write
- Argument `key` — brandId | apiUrl

```bash
brew-cli config unset brandId
```

### brew-cli contacts list

List contacts, newest first — free-text search and one audience; typed clauses are `contacts search`

- Route: `GET /v1/contacts`
- Class: read
- SDK: `brew.contacts.list(...)`
- `--search <text>` — Free-text search
- `--audience <audienceId>` — Only members of this saved audience
- `--sort <field>` — Any core column or custom field (default createdAt)
- `--order <order>` — Sort order: asc | desc
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli contacts list --limit 20
brew-cli contacts list --audience aud_3k9sQ --all --json
brew-cli contacts list --search acme --sort email --order asc
```

### brew-cli contacts search

Search contacts with structured filters (the contacts read)

- Route: `POST /v1/contacts/search`
- Class: read
- SDK: `brew.contacts.search(...)`
- `--search <text>` — Free-text search
- `--filter <filters...>` — Structured filter field:operator[:value], repeatable
- `--audience <audienceId>` — Scope to one audience
- `--logic <logic>` — Filter combinator: and | or
- `--sort <field>` — Sort field
- `--order <order>` — Sort order: asc | desc
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli contacts search --filter email:equals:jane@example.com
brew-cli contacts search --search jane --limit 10
brew-cli contacts search --all --json
```

### brew-cli contacts get

Fetch one contact by email — the bare row

- Route: `GET /v1/contacts/{email}`
- Class: read
- SDK: `brew.contacts.get(...)`
- Argument `email` — Email address of the contact (the contact primary key)

```bash
brew-cli contacts get jane@example.com
```

### brew-cli contacts count

Count contacts matching a filter

- Route: `POST /v1/contacts/search`
- Class: read
- SDK: `brew.contacts.count(...)`
- `--search <text>` — Free-text search
- `--filter <filters...>` — Structured filter field:operator[:value], repeatable
- `--audience <audienceId>` — Scope to one audience
- `--logic <logic>` — Filter combinator: and | or
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli contacts count
brew-cli contacts count --filter subscribed:equals:true
```

### brew-cli contacts upsert

Create or update one contact by email

- Route: `POST /v1/contacts`
- Class: write
- SDK: `brew.contacts.upsert(...)`
- `--email <email>` — Email address (the identity)
- `--first-name <name>` — First name
- `--last-name <name>` — Last name
- `--subscribed <bool>` — Subscription state: true | false
- `--custom <pairs...>` — Custom field key=value, repeatable
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli contacts upsert --email jane@example.com --first-name Jane
brew-cli contacts upsert --email j@x.com --custom plan=pro --custom seats=4
```

### brew-cli contacts upsert-many

Create or update a batch of contacts (up to 100 per call)

- Route: `POST /v1/contacts`
- Class: write
- SDK: `brew.contacts.upsertMany(...)`
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli contacts upsert-many --input '{"contacts":[{"email":"a@x.com"}]}'
cat contacts.json | brew-cli contacts upsert-many --input -
```

### brew-cli contacts update

Partially update one contact (PATCH; never retried)

- Route: `PATCH /v1/contacts/{email}`
- Class: write
- SDK: `brew.contacts.patch(...)`
- Argument `email` — Email address of the contact
- `--first-name <name>` — First name
- `--last-name <name>` — Last name
- `--subscribed <bool>` — Subscription state: true | false
- `--set <pairs...>` — Field key=value, repeatable
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli contacts update jane@example.com --first-name Jane
brew-cli contacts update j@x.com --set plan=enterprise
```

### brew-cli contacts delete

Delete one contact by email (idempotent)

- Route: `DELETE /v1/contacts/{email}`
- Class: destructive
- SDK: `brew.contacts.delete(...)`
- Argument `email` — Email address of the contact to delete

```bash
brew-cli contacts delete jane@example.com --yes
```

### brew-cli contacts delete-many

Delete up to 1000 contacts by email

- Route: `POST /v1/contacts/batch-delete`
- Class: destructive
- SDK: `brew.contacts.deleteMany(...)`
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli contacts delete-many --input '{"emails":["a@x.com","b@x.com"]}' --yes
cat emails.json | brew-cli contacts delete-many --input - --yes
```

### brew-cli contacts validate

Batch-validate email deliverability (no contacts created)

- Route: `POST /v1/contacts/validate`
- Class: write
- Consumes Brew credits
- SDK: `brew.contacts.validate(...)`
- `--emails <emails...>` — Email address(es) to validate, repeatable
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli contacts validate --emails jane@example.com bob@example.com
brew-cli contacts validate --input '{"emails":["jane@example.com"]}'
```

### brew-cli contacts import-csv

Bulk-import contacts from a CSV file or stdin

- Route: `POST /v1/contacts/import-csv`
- Class: write
- SDK: `brew.contacts.importCsv(...)`
- `--file <path>` — CSV file to import, or - for stdin
- `--mapping <pairs...>` — Column mapping csvColumn=fieldName, repeatable
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli contacts import-csv --file contacts.csv
cat contacts.csv | brew-cli contacts import-csv --file - --mapping Email=email
```

### brew-cli fields list

List custom contact fields

- Route: `GET /v1/fields`
- Class: read
- SDK: `brew.fields.list(...)`

```bash
brew-cli fields list
```

### brew-cli fields get

Fetch one contact field definition by name — the bare row

- Route: `GET /v1/fields/{fieldName}`
- Class: read
- SDK: `brew.fields.get(...)`
- Argument `fieldName` — Field name (a core column or a custom field)

```bash
brew-cli fields get loyalty_tier
```

### brew-cli fields create

Create a custom contact field

- Route: `POST /v1/fields`
- Class: write
- SDK: `brew.fields.create(...)`
- `--name <name>` — Field name (camelCase)
- `--type <type>` — Field type: string | number | date | bool
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli fields create --name plan --type string
```

### brew-cli fields delete

Delete a custom field definition

- Route: `DELETE /v1/fields/{fieldName}`
- Class: destructive
- SDK: `brew.fields.delete(...)`
- Argument `fieldName` — Name of the field to delete

```bash
brew-cli fields delete plan --yes
```

### brew-cli emails list

List email designs; one design is `emails get`

- Route: `GET /v1/emails`
- Class: read
- SDK: `brew.emails.list(...)`
- `--status <status>` — Filter by status: generating | ready | failed
- `--group-id <groupId>` — Filter by one group id; use ungrouped for no saved group
- `--sort-by <field>` — Timestamp the page is ordered by and that --since/--until bound: updatedAt (default) | createdAt
- `--since <iso>` — Inclusive lower bound on the --sort-by timestamp (ISO-8601)
- `--until <iso>` — Inclusive upper bound on the --sort-by timestamp (ISO-8601)
- `--sort <field>` — 0.6 alias of --sort-by
- `--order <order>` — 0.6 flag: pages are newest first; only desc is accepted
- `--created-at-from <iso>` — 0.6 alias of --sort-by createdAt --since <iso>
- `--created-at-to <iso>` — 0.6 alias of --sort-by createdAt --until <iso>
- `--updated-at-from <iso>` — 0.6 alias of --sort-by updatedAt --since <iso>
- `--updated-at-to <iso>` — 0.6 alias of --sort-by updatedAt --until <iso>
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli emails list --status ready --limit 10
brew-cli emails list --group-id ungrouped
brew-cli emails list --sort-by createdAt --since 2026-08-01T00:00:00Z
brew-cli emails list --all --json
```

### brew-cli emails groups list

List email groups in display order, including Ungrouped

- Route: `GET /v1/email-groups`
- Class: read
- SDK: `brew.emailGroups.list(...)`
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli emails groups list
brew-cli emails groups list --all --json
```

### brew-cli emails groups get

Fetch one email group by id — the bare row

- Route: `GET /v1/email-groups/{groupId}`
- Class: read
- SDK: `brew.emailGroups.get(...)`
- Argument `groupId` — Group id (`grp_…`, or the literal `ungrouped`)

```bash
brew-cli emails groups get grp_2f1c9d8a
brew-cli emails groups get ungrouped
```

### brew-cli emails groups create

Create a named email folder (group)

- Route: `POST /v1/email-groups`
- Class: write
- SDK: `brew.emailGroups.create(...)`
- `--name <name>` — Folder label, 1-60 chars (Ungrouped is reserved)
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails groups create --name Welcome
```

### brew-cli emails groups update

Rename an email folder (group)

- Route: `PATCH /v1/email-groups/{groupId}`
- Class: write
- SDK: `brew.emailGroups.update(...)`
- Argument `groupId` — Named group id (grp_*); Ungrouped cannot be renamed
- `--name <name>` — New folder label, 1-60 chars
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli emails groups update grp_welcome --name "Welcome series"
```

### brew-cli emails groups delete

Delete an email folder (group); its emails move to Ungrouped

- Route: `DELETE /v1/email-groups/{groupId}`
- Class: destructive
- SDK: `brew.emailGroups.delete(...)`
- Argument `groupId` — Named group id (grp_*); Ungrouped cannot be deleted

```bash
brew-cli emails groups delete grp_welcome --yes
```

### brew-cli emails get

Fetch one email design by id — the bare row

- Route: `GET /v1/emails/{emailId}`
- Class: read
- SDK: `brew.emails.get(...)`
- Argument `emailId` — Design id returned by emails generate/import
- `--include <tokens>` — Comma-separated expansions: html, versions

```bash
brew-cli emails get eml_2SmZOWV3ZQ7W5x6g3m4p
brew-cli emails get eml_2SmZOWV3ZQ7W5x6g3m4p --include html,versions
```

### brew-cli emails generate

Generate a new on-brand email design from a prompt

- Route: `POST /v1/emails`
- Class: write
- Consumes Brew credits
- SDK: `brew.emails.generate(...)`
- `--prompt <text>` — What the email should be
- `--reference-email-id <emailId>` — Existing design or template to base the layout on
- `--content-urls <urls...>` — Page URL(s) to pull copy and imagery from, repeatable
- `--group-id <groupId>` — Destination group id; omit or use ungrouped for Ungrouped
- `--subject-line <text>` — The design's default inbox subject line
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails generate --prompt "Product-launch email for the fall sale"
brew-cli emails generate --prompt "Welcome email" --group-id grp_welcome
brew-cli emails generate --prompt "Welcome email" --subject-line "Welcome to Brew"
brew-cli emails generate --prompt "Welcome email" --content-urls https://example.com/pricing
```

### brew-cli emails import

Import existing HTML, MJML, or JSX as a new editable design

- Route: `POST /v1/emails/import`
- Class: write
- SDK: `brew.emails.import(...)`
- `--file <path>` — Source file to import, or - for stdin
- `--format <format>` — Source format: html | mjml | jsx
- `--title <title>` — Design title
- `--base-url <url>` — Base URL for resolving relative asset links
- `--subject-line <text>` — The design's default inbox subject line
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails import --file newsletter.html --format html --title "Legacy newsletter"
brew-cli emails import --file newsletter.html --format html --subject-line "This month at Brew"
cat email.html | brew-cli emails import --file - --format html
```

### brew-cli emails import-figma

Convert one Figma frame into an editable design (deterministic, free)

- Route: `POST /v1/emails/figma`
- Class: write
- SDK: `brew.emails.importFigma(...)`
- `--url <figmaUrl>` — Figma frame link; must include a node-id query parameter
- `--title <title>` — Design title (default: the Figma frame name)
- `--format <format>` — Representation returned in content: jsx (default) or html
- `--subject-line <text>` — The design's default inbox subject line
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails import-figma --url "https://www.figma.com/design/abc123/Launch?node-id=1-2"
brew-cli emails import-figma --url "https://www.figma.com/design/abc123/Launch?node-id=1-2" --subject-line "Launch day is here"
```

### brew-cli emails edit

AI-edit an email design, and/or set its subject line, title or group (free without a prompt)

- Route: `PATCH /v1/emails/{emailId}`
- Class: write
- Consumes Brew credits
- SDK: `brew.emails.edit(...)`
- Argument `emailId` — Design id to edit
- `--prompt <text>` — The edit instruction
- `--email-version-id <id>` — Edit from a specific version (default: latest); needs --prompt
- `--content-urls <urls...>` — Page URL(s) to pull copy and imagery from, repeatable
- `--subject-line <text>` — The design's default inbox subject line; alone it skips the AI run
- `--title <text>` — Rename the design (its canvas name); alone it skips the AI run
- `--group-id <groupId>` — Move the design into this existing group; alone it skips the AI run
- `--ungroup` — Move the design to Ungrouped (groupId: null)
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli emails edit eml_2SmZOWV3ZQ7W5x6g3m4p --prompt "Tighten the hero copy"
brew-cli emails edit eml_2SmZOWV3ZQ7W5x6g3m4p --subject-line "Your September roundup"
brew-cli emails edit eml_2SmZOWV3ZQ7W5x6g3m4p --title "Fall sale v2" --group-id grp_7Hq2
brew-cli emails edit eml_2SmZOWV3ZQ7W5x6g3m4p --ungroup
```

### brew-cli emails clone

Clone a design into a new one (exact snapshot copy, no AI)

- Route: `POST /v1/emails/{emailId}/clone`
- Class: write
- SDK: `brew.emails.clone(...)`
- Argument `emailId` — Design id to clone
- `--email-version-id <id>` — Exact source version to clone (default: latest)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails clone eml_2SmZOWV3ZQ7W5x6g3m4p
brew-cli emails clone eml_2SmZOWV3ZQ7W5x6g3m4p --email-version-id emv_9f2kX
```

### brew-cli emails restore

Restore a previous version as the new latest (non-destructive)

- Route: `POST /v1/emails/{emailId}/restore`
- Class: write
- SDK: `brew.emails.restore(...)`
- Argument `emailId` — Design id to restore
- `--to-version <emailVersionId>` — Version id to restore (from `emails get <emailId> --include versions`)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails restore eml_2SmZOWV3ZQ7W5x6g3m4p --to-version emv_7Hq2
```

### brew-cli emails delete

Hard-delete an email design and all its versions (idempotent)

- Route: `DELETE /v1/emails/{emailId}`
- Class: destructive
- SDK: `brew.emails.delete(...)`
- Argument `emailId` — Design id to delete

```bash
brew-cli emails delete eml_2SmZOWV3ZQ7W5x6g3m4p --yes
```

### brew-cli emails export

Export a design to a connected ESP as a template (not a send)

- Route: `POST /v1/emails/{emailId}/export`
- Class: write
- SDK: `brew.emails.export(...)`
- Argument `emailId` — Design id to export
- `--provider <provider>` — Connected ESP: braze, hubspot, klaviyo, mailchimp, iterable, postmark, onesignal, mailgun, sendgrid
- `--template-name <name>` — Template name in the ESP (default: the email title)
- `--dry-run` — Validate design, ownership, and ESP connection without creating a template
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails export eml_2SmZOWV3ZQ7W5x6g3m4p --provider klaviyo
brew-cli emails export eml_2SmZOWV3ZQ7W5x6g3m4p --provider mailchimp --template-name "Fall sale" --dry-run
```

### brew-cli emails audit

Audit raw email content for production readiness (5 credits when complete)

- Route: `POST /v1/emails/audit`
- Class: write
- Consumes Brew credits
- SDK: `brew.emails.auditEmail(...)`
- `--file <path>` — Email HTML file to audit, or - for stdin
- `--subject <text>` — Inbox subject line
- `--preview-text <text>` — Inbox preview text; an explicit empty value stays empty
- `--sending-purpose <purpose>` — marketing | transactional (default: marketing)
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails audit --file newsletter.html --subject "August update" --sending-purpose marketing
cat email.html | brew-cli emails audit --file - --subject "Receipt" --sending-purpose transactional
brew-cli emails audit --input '{"emailHtml":"<p>Hello</p>","subject":"Hello"}'
```

### brew-cli emails get-audit

Read a saved email audit: one page of its findings (free; never reruns the audit)

- Route: `GET /v1/emails/audits/{auditId}`
- Class: read
- Argument `auditId` — The auditId `emails audit` returned (reports are kept 7 days)
- `--limit <n>` — Findings per page, 1-50 (default 10)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page

```bash
brew-cli emails get-audit 6f1e2d3c-4b5a-4c7d-8e9f-0a1b2c3d4e5f
brew-cli emails get-audit 6f1e2d3c-4b5a-4c7d-8e9f-0a1b2c3d4e5f --limit 20
```

### brew-cli emails preview-clients

Start a rendering job across real email clients (10 credits); poll it with `emails get-client-preview`

- Route: `POST /v1/emails/{emailId}/client-previews`
- Class: write
- Consumes Brew credits
- SDK: `brew.emails.previewClients(...)`
- Argument `emailId` — Design id to preview
- `--clients <ids...>` — Client id(s) to render, repeatable (e.g. applemail16 iphone16_18); default: a popular spread
- `--email-version-id <id>` — Render this saved version (default: the latest)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails preview-clients eml_2SmZOWV3ZQ7W5x6g3m4p
brew-cli emails preview-clients eml_2SmZOWV3ZQ7W5x6g3m4p --clients applemail16 outlook2021_win11_lm_dt
PREVIEW_ID=$(brew-cli emails preview-clients eml_2SmZOWV3ZQ7W5x6g3m4p --json | jq -r .previewId) && brew-cli emails get-client-preview "$PREVIEW_ID"
```

### brew-cli emails get-client-preview

Poll a client-preview rendering job: per-client screenshot links once it settles (free; never re-renders)

- Route: `GET /v1/emails/client-previews/{previewId}`
- Class: read
- Argument `previewId` — The previewId `emails preview-clients` returned

```bash
brew-cli emails get-client-preview prv_0b7f3c1e-9a2d-4e8b-b6c5-3d1f2a9e8c47
brew-cli emails get-client-preview prv_0b7f3c1e-9a2d-4e8b-b6c5-3d1f2a9e8c47 --json | jq '.previews[] | {label, status, imageUrl}'
```

### brew-cli emails create-inbox-placement-test

Seed-test where the design lands (inbox vs spam) via a real small send (10 credits)

- Route: `POST /v1/emails/{emailId}/inbox-placement-tests`
- Class: write
- Consumes Brew credits
- SDK: `brew.emails.inboxPlacementTests.create(...)`
- Argument `emailId` — Design id to test
- `--domain <domainId>` — Verified sending domain id the seed send goes out on
- `--subject <text>` — Seed-send subject (default: the email title)
- `--preview-text <text>` — Preheader override for this test
- `--email-version-id <id>` — Pin a specific design version (default: latest)
- `--providers <domains...>` — Restrict seed mailbox providers, repeatable (e.g. gmail.com outlook.com)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails create-inbox-placement-test eml_2SmZOWV3ZQ7W5x6g3m4p --domain kx7bkh53hasmfeh5kd7sqgykt187g8ww
brew-cli emails create-inbox-placement-test eml_2SmZOWV3ZQ7W5x6g3m4p --domain kx7bkh53hasmfeh5kd7sqgykt187g8ww --subject "Variant B" --providers gmail.com outlook.com
```

### brew-cli emails get-inbox-placement-results

Inbox placement results: the recent tests, or one test with --test-id

- Route: `GET /v1/emails/{emailId}/inbox-placement-tests`
- Class: read
- SDK: `brew.emails.inboxPlacementTests.list(...)`
- Argument `emailId` — Design id the tests ran on
- `--test-id <id>` — One test: live status + per-provider placement (re-poll ~30s until completed)
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli emails get-inbox-placement-results eml_2SmZOWV3ZQ7W5x6g3m4p
brew-cli emails get-inbox-placement-results eml_2SmZOWV3ZQ7W5x6g3m4p --test-id ibp_2f1c9d8a
```

### brew-cli emails inbox-placement-tests get

Fetch one inbox-placement (seed) test — the bare row, re-poll ~30s until completed

- Route: `GET /v1/emails/{emailId}/inbox-placement-tests/{testId}`
- Class: read
- SDK: `brew.emails.inboxPlacementTests.get(...)`
- Argument `emailId` — Design id the test ran on
- Argument `testId` — Test id returned by `emails create-inbox-placement-test`

```bash
brew-cli emails inbox-placement-tests get eml_2SmZOWV3ZQ7W5x6g3m4p ibp_2f1c9d8a
```

### brew-cli emails send

Send an email: a real campaign, or a safe test with --test

- Route: `POST /v1/sends`
- Class: destructive
- SDK: `brew.emails.send(...)`
- Argument `emailId` — Design id to send
- `--test` — Test delivery to --to only; skips the confirmation gate
- `--to <emails...>` — Recipient(s): required for --test, ad-hoc list for campaigns
- `--subject <text>` — Subject line
- `--audience <audienceId>` — Campaign audience segment
- `--domain <domainId>` — Verified sending domain id
- `--schedule-at <iso>` — Schedule the campaign for an ISO-8601 time (default: now)
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails send eml_1 --test --to qa@example.com --subject "Preview"
brew-cli emails send eml_1 --subject "Fall sale" --domain dom_1 --audience aud_1 --yes
brew-cli emails send eml_1 --subject "Fall sale" --domain dom_1 --audience aud_1 --schedule-at 2026-09-01T09:00:00Z --yes
```

### brew-cli sends list

List sends (the unit of delivery and analytics) with lifetime stats

- Route: `GET /v1/sends`
- Class: read
- SDK: `brew.sends.list(...)`
- `--email <emailId>` — Only sends of this design
- `--kind <kind>` — campaign | automation
- `--automation <automationId>` — Filter by automation
- `--automation-run <automationRunId>` — Deliveries of one automation run
- `--audience-run <audienceRunId>` — Deliveries of one manual-audience run
- `--trigger-instance <triggerInstanceId>` — Deliveries started by one fired trigger instance
- `--status <status>` — scheduled | queued | running | paused | completed | partially_completed | failed | canceled
- `--message-class <class>` — marketing | transactional
- `--since <datetime>` — Inclusive lower bound on updatedAt (ISO-8601)
- `--until <datetime>` — Inclusive upper bound on updatedAt (ISO-8601)
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli sends list --status completed
brew-cli sends list --email eml_1 --all --json
brew-cli sends list --automation-run arun_9f2kX
```

### brew-cli sends get

Fetch one send by id — the bare row with its lifetime stats

- Route: `GET /v1/sends/{sendId}`
- Class: read
- SDK: `brew.sends.get(...)`
- Argument `sendId` — Send id to fetch
- `--include <tokens>` — Comma-separated expansions: events

```bash
brew-cli sends get snd_9f2kX
brew-cli sends get snd_9f2kX --include events
```

### brew-cli sends cancel

Cancel a scheduled or queued send before it goes out

- Route: `POST /v1/sends/{sendId}/cancel`
- Class: destructive
- SDK: `brew.sends.cancel(...)`
- Argument `sendId` — Send id to cancel

```bash
brew-cli sends cancel snd_9f2kX --yes
```

### brew-cli sends pause

Pause an in-flight or scheduled send (resumable)

- Route: `POST /v1/sends/{sendId}/pause`
- Class: write
- SDK: `brew.sends.pause(...)`
- Argument `sendId` — Send id to pause
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli sends pause snd_123
```

### brew-cli sends resume

Resume a paused gradual send (the unsent tail is re-spread); the send reports `running` again

- Route: `POST /v1/sends/{sendId}/resume`
- Class: write
- SDK: `brew.sends.resume(...)`
- Argument `sendId` — Send id to resume
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli sends resume snd_123
```

### brew-cli types

Generate TypeScript payload contracts for this workspace's triggers into your codebase; --check is the CI drift gate (exit 1 on drift). Needs the automations scope

- Route: `GET /v1/automations/triggers`
- Class: read
- Derived from `brew.automations.triggers.list(...)`
- `--out <file>` — Output file (default brew-contracts.ts)
- `--check` — Verify the output file is up to date instead of writing; exits 1 on drift

```bash
brew-cli types
brew-cli types --out src/brew-contracts.ts
brew-cli types --check
```

### brew-cli audiences list

List audience segments; one segment is `audiences get`

- Route: `GET /v1/audiences`
- Class: read
- SDK: `brew.audiences.list(...)`
- `--include <tokens>` — 0.6 flag: includes ride the detail read now (`audiences get --include count,build`)
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli audiences list
brew-cli audiences list --limit 10
brew-cli audiences list --all --json
```

### brew-cli audiences get

Fetch one audience segment by id — the bare row

- Route: `GET /v1/audiences/{audienceId}`
- Class: read
- SDK: `brew.audiences.get(...)`
- Argument `audienceId` — Audience id to fetch
- `--include <tokens>` — Comma-separated expansions: count, build

```bash
brew-cli audiences get aud_3k9sQ
brew-cli audiences get aud_3k9sQ --include count,build
```

### brew-cli audiences create

Create an audience segment from a filter definition

- Route: `POST /v1/audiences`
- Class: write
- SDK: `brew.audiences.create(...)`
- `--name <name>` — Audience name
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli audiences create --name VIP --input '{"filters":{"filters":[{"field":"plan","operator":"equals","value":"vip"}],"logicalOperator":"and"}}'
```

### brew-cli audiences update

Update an audience segment (name and/or filters)

- Route: `PATCH /v1/audiences/{audienceId}`
- Class: write
- SDK: `brew.audiences.update(...)`
- Argument `audienceId` — Audience id to update
- `--name <name>` — New audience name
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli audiences update aud_3k9sQ --name "VIP customers"
brew-cli audiences update aud_3k9sQ --input '{"filters":{"filters":[{"field":"plan","operator":"equals","value":"vip"}],"logicalOperator":"and"}}'
```

### brew-cli audiences duplicate

Copy an audience segment (the copy gets a "(copy)" name)

- Route: `POST /v1/audiences/{audienceId}/duplicate`
- Class: write
- SDK: `brew.audiences.duplicate(...)`
- Argument `audienceId` — Audience id to duplicate
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli audiences duplicate aud_3k9sQ
```

### brew-cli audiences from-events

Create a frozen audience snapshot from analytics events (async build)

- Route: `POST /v1/audiences/from-events`
- Class: write
- SDK: `brew.audiences.fromEvents(...)`
- `--name <name>` — Audience name
- `--event-types <types...>` — Event type(s), repeatable: sent, delivered, delivery_delayed, opened, clicked, bounced, complained, failed, skipped, unsubscribed
- `--since <datetime>` — Cohort window start (ISO-8601, max 90 days back)
- `--until <datetime>` — Cohort window end (ISO-8601, default now)
- `--send-id <sendId>` — Scope to one campaign send
- `--email-id <emailId>` — Scope to one email design
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli audiences from-events --name "Opened in July" --event-types opened --since 2026-07-01T00:00:00Z --until 2026-08-01T00:00:00Z
brew-cli audiences from-events --event-types opened clicked --since 2026-07-01T00:00:00Z --input '{"cohort":{"recipient":["@acme.com"]}}'
```

### brew-cli audiences delete

Delete an audience segment (contacts are kept)

- Route: `DELETE /v1/audiences/{audienceId}`
- Class: destructive
- SDK: `brew.audiences.delete(...)`
- Argument `audienceId` — Audience id to delete

```bash
brew-cli audiences delete aud_3k9sQ --yes
```

### brew-cli automations list

List automations (lean rows; `automations get` for the graph)

- Route: `GET /v1/automations`
- Class: read
- SDK: `brew.automations.list(...)`
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli automations list
brew-cli automations list --all --json
```

### brew-cli automations get

Fetch one automation by id — the bare row, lean by default

- Route: `GET /v1/automations/{automationId}`
- Class: read
- SDK: `brew.automations.get(...)`
- Argument `automationId` — Id of the automation
- `--include <tokens>` — Comma-separated expansions: graph, versions

```bash
brew-cli automations get am_123
brew-cli automations get am_123 --include graph,versions
```

### brew-cli automations create

Create an automation from a graph JSON (starts unpublished)

- Route: `POST /v1/automations`
- Class: write
- SDK: `brew.automations.create(...)`
- `--name <name>` — Automation name
- `--description <text>` — Automation description
- `--trigger <triggerEventId>` — Trigger event id that starts the automation
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
cat welcome-flow.json | brew-cli automations create --input -
brew-cli automations create --name "Welcome flow" --input '{"triggerEventId":"tev_1","nodes":[],"connections":[]}'
```

### brew-cli automations update

Update automation metadata and/or its graph (PATCH)

- Route: `PATCH /v1/automations/{automationId}`
- Class: write
- SDK: `brew.automations.patch(...)`
- Argument `automationId` — Id of the automation to update
- `--name <name>` — New name
- `--description <text>` — New description
- `--trigger <triggerEventId>` — New trigger event id
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli automations update am_123 --name "Welcome flow v2"
cat graph.json | brew-cli automations update am_123 --input -
```

### brew-cli automations publish

Publish an automation — arms it for live fires; does not itself send

- Route: `PATCH /v1/automations/{automationId}`
- Class: write
- SDK: `brew.automations.publish(...)`
- Argument `automationId` — Id of the automation to publish
- `--automation-version <automationVersionId>` — Publish a specific historical version (default: latest)

```bash
brew-cli automations publish am_123
brew-cli automations publish am_123 --automation-version amv_456
```

### brew-cli automations unpublish

Unpublish an automation so new trigger fires no longer start runs

- Route: `PATCH /v1/automations/{automationId}`
- Class: write
- SDK: `brew.automations.unpublish(...)`
- Argument `automationId` — Id of the automation to unpublish

```bash
brew-cli automations unpublish am_123
```

### brew-cli automations delete

Delete an automation and its version history (cascade)

- Route: `DELETE /v1/automations/{automationId}`
- Class: destructive
- SDK: `brew.automations.delete(...)`
- Argument `automationId` — Id of the automation to delete

```bash
brew-cli automations delete am_123 --yes
```

### brew-cli automations test

Start a suppression-aware TEST run (no real mail is sent)

- Route: `POST /v1/automations/{automationId}/test`
- Class: write
- SDK: `brew.automations.test(...)`
- Argument `automationId` — Id of the automation to test
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli automations test am_123
brew-cli automations test am_123 --input '{"userId":"u_1"}'
```

### brew-cli automations run

Run a manual-audience automation (live send; --dry-run previews)

- Route: `POST /v1/automations/{automationId}/run`
- Class: destructive
- SDK: `brew.automations.run(...)`
- Argument `automationId` — Manual-audience automation id to run
- `--dry-run` — Preview the resolved plan without sending (skips the gate)
- `--schedule-at <iso>` — Launch at an ISO-8601 time instead of now
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli automations run auto_abc --dry-run
brew-cli automations run auto_abc --yes
brew-cli automations run auto_abc --schedule-at 2026-09-01T09:00:00Z --input '{"gradualSend":{"startingPercentage":10,"incrementPercentage":20,"interval":{"value":1,"unit":"day"},"timeZone":"America/New_York"}}' --yes
```

### brew-cli automations triggers list

List trigger events (their payload schemas drive fires); one trigger is `automations triggers get`

- Route: `GET /v1/automations/triggers`
- Class: read
- SDK: `brew.automations.triggers.list(...)`
- `--trigger <triggerEventId>` — 0.6 shim: read ONE trigger as a single-row page (`automations triggers get` is the real read)
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli automations triggers list
brew-cli automations triggers list --all --json
```

### brew-cli automations triggers get

Fetch one trigger by id — the bare row with its payload schema

- Route: `GET /v1/automations/triggers/{triggerEventId}`
- Class: read
- SDK: `brew.automations.triggers.get(...)`
- Argument `triggerEventId` — Trigger id (tri_…, or an integration composite id)
- `--include <tokens>` — Expansions: skill (a SKILL.md-shaped wiring brief)

```bash
brew-cli automations triggers get tri_signup
brew-cli automations triggers get tri_signup --include skill
```

### brew-cli automations triggers ready

Preflight a trigger without firing: key + scope + permissions pass/fail, the payload contract, and what a fire would start

- Route: `GET /v1/automations/triggers/{triggerEventId}/readiness`
- Class: read
- SDK: `brew.automations.triggers.readiness(...)`
- Argument `triggerEventId` — Trigger id (tri_…, or an integration composite id)

```bash
brew-cli automations triggers ready tri_signup
```

### brew-cli automations triggers contract get

Read a trigger payload contract: stored when declared, derived otherwise; --format renders ts/zod/jsonschema/skill

- Route: `GET /v1/automations/triggers/{triggerEventId}/contract`
- Class: read
- Argument `triggerEventId` — Trigger id (tri_…, or an integration composite id)
- `--format <format>` — Rendering: json (default, the contract object) or ts | zod | jsonschema | skill ({format, content})

```bash
brew-cli automations triggers contract get tri_signup
brew-cli automations triggers contract get tri_signup --format ts
brew-cli automations triggers contract get tri_signup --format skill --json | jq -r .content
```

### brew-cli automations triggers contract put

Declare (or replace) the stored payload contract for a trigger — tree-validated before any write; omitting --enforcement leaves the stored setting unchanged

- Route: `PUT /v1/automations/triggers/{triggerEventId}/contract`
- Class: write
- Argument `triggerEventId` — Trigger id (tri_…)
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--enforcement <mode>` — off (advisory, the default) | prune (drop fields not on the list) | strict (reject a payload carrying them)

```bash
brew-cli automations triggers contract put tri_signup --input '{"fields":[{"key":"email","type":"string","required":true}]}'
brew-cli automations triggers contract put tri_signup --enforcement strict
```

### brew-cli automations triggers contract validate

Dry-run a payload against a trigger's contract (the fire path's validator) — never fires; invalid payloads still exit 0

- Route: `POST /v1/automations/triggers/{triggerEventId}/contract/validate`
- Class: read
- Argument `triggerEventId` — Trigger id (tri_…)
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--enforcement <mode>` — Preview a mode other than the stored one: prune | strict

```bash
brew-cli automations triggers contract validate tri_signup --input '{"payload":{"email":"jane@example.com"}}'
```

### brew-cli contracts infer

Draft a payload contract from a real example payload — nothing is saved; PUT the draft on a trigger

- Route: `POST /v1/payload-contracts/infer`
- Class: read
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli contracts infer --input '{"email":"jane@example.com","order":{"total":9.5}}'
```

### brew-cli data run

Run a `db …` command over the brand's data

- Route: `POST /v1/data`
- Class: read
- SDK: `brew.data.run(...)`
- Argument `command` — The db command line, e.g. 'db find audiences --fields name'

```bash
brew-cli data run 'db ls'
brew-cli data run 'db find contacts --since 30d --fields email --limit 20'
brew-cli data run 'db agg analyticsEvents --since 7d --group-by eventType --bucket day'
```

### brew-cli automations triggers create

Create a trigger event (title + typed payload schema)

- Route: `POST /v1/automations/triggers`
- Class: write
- SDK: `brew.automations.triggers.create(...)`
- `--title <title>` — Trigger event title
- `--description <text>` — Trigger event description
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli automations triggers create --title user.signup --input '{"payloadSchema":{"type":"object","fields":[{"key":"userId","type":"string","required":true}]}}'
```

### brew-cli automations triggers update

Update a trigger event (title, description, payload schema)

- Route: `PATCH /v1/automations/triggers/{triggerEventId}`
- Class: write
- SDK: `brew.automations.triggers.patch(...)`
- Argument `triggerEventId` — Id of the trigger event to update
- `--title <title>` — New title
- `--description <text>` — New description
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli automations triggers update tev_123 --title user.signup.v2
brew-cli automations triggers update tev_123 --input '{"payloadSchema":{"type":"object","fields":[]}}'
```

### brew-cli automations triggers delete

Delete a trigger event (rejected while automations depend on it)

- Route: `DELETE /v1/automations/triggers/{triggerEventId}`
- Class: destructive
- SDK: `brew.automations.triggers.delete(...)`
- Argument `triggerEventId` — Id of the trigger event to delete

```bash
brew-cli automations triggers delete tev_123 --yes
```

### brew-cli automations triggers fire

Fire a trigger event with a payload (starts LIVE runs)

- Route: `POST /v1/automations/triggers/{triggerEventId}/fire`
- Class: destructive
- SDK: `brew.automations.triggers.fire(...)`
- Argument `triggerEventId` — Id of the trigger event to fire
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli automations triggers fire tri_signup --input '{"payload":{"email":"jane@example.com"}}' --yes
```

### brew-cli automations runs list

List automation runs (live + test history); one run is `automations runs get`

- Route: `GET /v1/automations/runs`
- Class: read
- SDK: `brew.automations.runs.list(...)`
- `--automation <automationId>` — Filter by automation
- `--trigger <triggerEventId>` — Filter by trigger event
- `--trigger-instance <triggerInstanceId>` — Filter by fired trigger instance
- `--status <status>` — queued | running | completed | failed | canceled
- `--mode <mode>` — live | test
- `--recipient <email>` — Only runs for this recipient (case-insensitive match on the run row's recipientEmail)
- `--run <automationRunId>` — 0.6 shim: read ONE run as a single-row page (`automations runs get` is the real read)
- `--include <tokens>` — With --run only: detail includes (`logs`)
- `--since <datetime>` — Runs started at/after (ISO-8601)
- `--until <datetime>` — Runs started at/before (ISO-8601)
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli automations runs list --automation am_123 --status failed
brew-cli automations runs list --trigger-instance tin_2f1c9d8a
```

### brew-cli automations runs get

Fetch one automation run by id — the bare row

- Route: `GET /v1/automations/runs/{automationRunId}`
- Class: read
- SDK: `brew.automations.runs.get(...)`
- Argument `automationRunId` — Run id (from `automations runs list`, a test start, or a fire)
- `--include <tokens>` — Expansions: logs (newest 100 per-node execution logs)

```bash
brew-cli automations runs get run_9f2kX
brew-cli automations runs get run_9f2kX --include logs
```

### brew-cli automations runs cancel

Cancel one in-flight automation run (event execution or test run) — nothing further is sent, and it can never be resumed

- Route: `POST /v1/automations/runs/{automationRunId}/cancel`
- Class: destructive
- SDK: `brew.automations.runs.cancel(...)`
- Argument `automationRunId` — Run id to cancel (from `automations runs list`, a test start, or a fire response)
- `--reason <text>` — Operator note stored on the run
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli automations runs cancel run_9f2kX --reason "wrong audience" --yes
```

### brew-cli automations audience-runs list

List manual-audience runs, newest first; one run is `automations audience-runs get`

- Route: `GET /v1/automations/audience-runs`
- Class: read
- SDK: `brew.automations.audienceRuns.list(...)`
- `--automation <automationId>` — Only runs of this automation
- `--automation-id <automationId>` — 0.6 alias of --automation
- `--audience-run-id <audienceRunId>` — 0.6 shim: read ONE run as a single-row page (`automations audience-runs get` is the real read)
- `--status <status>` — queued | scheduled | running | paused | completed | failed | canceled
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli automations audience-runs list
brew-cli automations audience-runs list --automation am_123 --status running
```

### brew-cli automations audience-runs get

Fetch one manual-audience run by id — the bare row

- Route: `GET /v1/automations/audience-runs/{audienceRunId}`
- Class: read
- SDK: `brew.automations.audienceRuns.get(...)`
- Argument `audienceRunId` — Audience run id to fetch

```bash
brew-cli automations audience-runs get arun_01HZ
```

### brew-cli automations audience-runs pause

Pause a running manual-audience run at its next step boundary (resumable)

- Route: `POST /v1/automations/audience-runs/{audienceRunId}/pause`
- Class: write
- SDK: `brew.automations.audienceRuns.pause(...)`
- Argument `audienceRunId` — Audience run id to pause
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli automations audience-runs pause arun_01HZ
```

### brew-cli automations audience-runs resume

Resume a paused manual-audience run, or restart a failed one from its first undelivered send

- Route: `POST /v1/automations/audience-runs/{audienceRunId}/resume`
- Class: write
- SDK: `brew.automations.audienceRuns.resume(...)`
- Argument `audienceRunId` — Audience run id to resume
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli automations audience-runs resume arun_01HZ
```

### brew-cli automations audience-runs cancel

Cancel a manual-audience run for good — it can never be resumed

- Route: `POST /v1/automations/audience-runs/{audienceRunId}/cancel`
- Class: destructive
- SDK: `brew.automations.audienceRuns.cancel(...)`
- Argument `audienceRunId` — Audience run id to cancel
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli automations audience-runs cancel arun_01HZ --yes
```

### brew-cli automations audience-runs control

Pause, resume, or cancel an in-flight manual-audience run (0.6 form of `audience-runs pause|resume|cancel`)

- Class: destructive
- Derived from `brew.automations.audienceRuns.pause(...)`, `brew.automations.audienceRuns.resume(...)`, `brew.automations.audienceRuns.cancel(...)`
- Argument `audienceRunId` — Audience run id to control
- `--action <action>` — pause (resumable) | resume | cancel (final)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli automations audience-runs control arun_01HZ --action pause
brew-cli automations audience-runs control arun_01HZ --action cancel --yes
```

### brew-cli automations trigger-instances list

List fired-trigger instances (the inbound-fire audit log); each row carries a lifecycle `state`

- Route: `GET /v1/automations/trigger-instances`
- Class: read
- SDK: `brew.automations.triggerInstances.list(...)`
- `--trigger <triggerEventId>` — Filter by trigger event
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli automations trigger-instances list --trigger tri_signup
brew-cli automations trigger-instances list --all --json
```

### brew-cli automations trigger-instances get

Fetch one fired-trigger instance by id — the bare row, with its lifecycle `state` and the runs it started

- Route: `GET /v1/automations/trigger-instances/{triggerInstanceId}`
- Class: read
- SDK: `brew.automations.triggerInstances.get(...)`
- Argument `triggerInstanceId` — Instance id returned by a fire, or by the instances list

```bash
brew-cli automations trigger-instances get tin_2f1c9d8a
```

### brew-cli analytics overview

Brand overview: totals, rates, timeseries (default last 7 days)

- Route: `GET /v1/analytics/overview`
- Class: read
- SDK: `brew.analytics.overview(...)`
- `--since <datetime>` — Window start (ISO-8601, default 7 days ago)
- `--until <datetime>` — Window end (ISO-8601, default now)
- `--source <sources>` — CSV of send sources: audience, api, automation_manual, automation_integration, automation_custom
- `--automation-id <ids>` — CSV of automation ids (max 20)
- `--email-id <emailId>` — Scope to one email design
- `--audience-id <ids>` — CSV of audience ids (max 20)
- `--trigger-event-id <ids>` — CSV of integration trigger-event ids (max 10)
- `--domain <domain>` — Sending domain (fromEmail match)
- `--recipient <rules>` — CSV of recipient rules: full address, @domain, substring; prefix ! to exclude

```bash
brew-cli analytics overview
brew-cli analytics overview --since 2026-08-01T00:00:00Z --source audience --json
```

### brew-cli analytics campaigns

Lifetime per-campaign KPIs (`sends list --kind campaign`; stats ride each row)

- Route: `GET /v1/sends`
- Class: read
- Derived from `brew.sends.list(...)`
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli analytics campaigns
brew-cli analytics campaigns --all --json
```

### brew-cli analytics automations

Windowed per-automation performance + totals

- Route: `GET /v1/analytics/automations`
- Class: read
- SDK: `brew.analytics.automations(...)`
- `--since <datetime>` — Window start (ISO-8601)
- `--until <datetime>` — Window end (ISO-8601)
- `--automation <automationId>` — Narrow to one automation
- `--limit <n>` — Page size, 1-100 (default 100)
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli analytics automations
brew-cli analytics automations --since 2026-07-01 --until 2026-08-01
```

### brew-cli analytics events

Unified event explorer (email, automation, trigger, inbound)

- Route: `GET /v1/analytics/events`
- Class: read
- SDK: `brew.analytics.events(...)`
- `--since <datetime>` — Window start (ISO-8601)
- `--until <datetime>` — Window end (ISO-8601)
- `--recipient <rules>` — CSV of recipient rules (max 10): an address, @domain, or substring; prefix ! to exclude
- `--event-type <type>` — Filter by event type (e.g. opened, clicked)
- `--automation <automationId>` — Filter by automation
- `--send <sendId>` — Filter by campaign send
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli analytics events --since 2026-08-01 --event-type clicked
brew-cli analytics events --recipient jane@example.com --all --json
```

### brew-cli analytics sends list

List campaign/automation sends with delivery stats (`sends list`)

- Route: `GET /v1/sends`
- Class: read
- Derived from `brew.sends.list(...)`
- `--send <sendId>` — 0.6 shim: read ONE send as a single-row page (`sends get` is the real read)
- `--include <tokens>` — With --send only: detail includes (`events`)
- `--email <emailId>` — Filter by email design
- `--kind <kind>` — campaign | automation
- `--status <status>` — scheduled | queued | running | paused | completed | partially_completed | failed | canceled
- `--since <datetime>` — Window start (ISO-8601)
- `--until <datetime>` — Window end (ISO-8601)
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli analytics sends list --status completed
brew-cli analytics sends list --email eml_1 --all --json
```

### brew-cli analytics sends get

Fetch one send by id — the bare row (`sends get`)

- Route: `GET /v1/sends/{sendId}`
- Class: read
- Derived from `brew.sends.get(...)`
- Argument `sendId` — Id of the send
- `--include <tokens>` — Comma-separated expansions: events

```bash
brew-cli analytics sends get snd_123
brew-cli analytics sends get snd_123 --include events
```

### brew-cli analytics trigger-instances list

List fired-trigger instances with their lifecycle `state` (`automations trigger-instances list`)

- Route: `GET /v1/automations/trigger-instances`
- Class: read
- Derived from `brew.automations.triggerInstances.list(...)`
- `--trigger <triggerEventId>` — Filter by trigger event
- `--trigger-instance <triggerInstanceId>` — 0.6 shim: read ONE instance as a single-row page (`automations trigger-instances get` is the real read)
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli analytics trigger-instances list --trigger tri_signup
brew-cli analytics trigger-instances list --all --json
```

### brew-cli brand get

Fetch the key's brand + extraction readiness (`ready` flag)

- Route: `GET /v1/brand`
- Class: read
- SDK: `brew.brand.get(...)`
- `--include <tokens>` — Comma-separated embeds: identity | emailDesign | imageStyle | logos

```bash
brew-cli brand get
brew-cli brand get --include identity,logos
```

### brew-cli brand update

Update brand identity and/or design-system markdown (PATCH)

- Route: `PATCH /v1/brand`
- Class: write
- SDK: `brew.brand.patch(...)`
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli brand update --input '{"identity":{"tagline":"Brew better email"}}'
cat brand-patch.json | brew-cli brand update --input -
```

### brew-cli brand get-images

Browse or semantically search the brand's image library

- Route: `GET /v1/brand/images`
- Class: read
- SDK: `brew.brand.getImages(...)`
- `--query <text>` — Semantic search over image descriptions
- `--type <type>` — Filter by image category
- `--aspect-ratio <ratio>` — Filter by aspect ratio (e.g. 16:9)
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli brand get-images
brew-cli brand get-images --query "team photo" --aspect-ratio 16:9
```

### brew-cli brands list

List every brand in the organization

- Route: `GET /v1/brands`
- Class: read
- SDK: `brew.brands.list(...)`

```bash
brew-cli brands list --json
```

### brew-cli brands get

One brand's lifecycle state (the extraction polling endpoint)

- Route: `GET /v1/brands/{brandId}`
- Class: read
- SDK: `brew.brands.get(...)`
- Argument `brandId` — Brand id to fetch

```bash
brew-cli brands get kx7b3s7fapqz8mjm12ekz1kxdx87yceg
```

### brew-cli brands create

Create a brand and start async extraction (needs an ORGANIZATION-scoped key); poll `brands get` until ready

- Route: `POST /v1/brands`
- Class: write
- SDK: `brew.brands.create(...)`
- `--url <url>` — Website to extract the brand from
- `--instructions <text>` — Guidance for the extraction (tone sources, brand color, …)
- `--include-paths <paths...>` — Site path(s) the crawl must include, repeatable
- `--exclude-paths <paths...>` — Site path(s) the crawl must skip, repeatable
- `--exclude-subdomains <subdomains...>` — Subdomain(s) the crawl must skip, repeatable
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli brands create --url acme.com
brew-cli brands create --url acme.com --instructions "Primary brand color is the deep navy in the header"
```

### brew-cli api-keys list

List API keys in the organization (already-redacted `keyPreview`, never the secret)

- Route: `GET /v1/api-keys`
- Class: read
- SDK: `brew.apiKeys.list(...)`

```bash
brew-cli api-keys list
brew-cli api-keys list --json
```

### brew-cli api-keys create

Mint an API key; the plaintext `key` is returned ONCE — this output is the only copy

- Route: `POST /v1/api-keys`
- Class: write
- SDK: `brew.apiKeys.create(...)`
- `--name <name>` — Label for the key
- `--permissions <scopes...>` — all | contacts | emails | automations | transactional | domains | sends | audiences | brands (default: all)
- `--brand-id <brandId>` — Bind the NEW key to this brand id (omit for an organization-wide key); not the acting --brand
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli api-keys create --name CI --permissions emails domains
brew-cli api-keys create --name "Acme key" --brand-id kx7b3s7fapqz8mjm12ekz1kxdx87yceg
```

### brew-cli api-keys delete

Revoke an API key

- Route: `DELETE /v1/api-keys/{keyId}`
- Class: destructive
- SDK: `brew.apiKeys.revoke(...)`
- Argument `keyId` — API key id to revoke

```bash
brew-cli api-keys delete kd7b3s7fapqz8mjm12ekz1kxdx87yceg --yes
```

### brew-cli domains list

List sending domains with verification state and DNS records

- Route: `GET /v1/domains`
- Class: read
- SDK: `brew.domains.list(...)`
- `--sendable-only` — Only domains currently able to send
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli domains list
brew-cli domains list --sendable-only --json
```

### brew-cli domains get

Fetch one sending domain by id — the bare row

- Route: `GET /v1/domains/{domainId}`
- Class: read
- SDK: `brew.domains.get(...)`
- Argument `domainId` — Domain id to fetch

```bash
brew-cli domains get dom_3k9sQ
```

### brew-cli domains add

Add a sending domain (response lists the DNS records to set)

- Route: `POST /v1/domains`
- Class: write
- SDK: `brew.domains.add(...)`
- Argument `domain` — Domain name to add (e.g. mail.example.com)
- `--region <region>` — Sending region (us-east-1)
- `--custom-return-path <subdomain>` — Custom Return-Path subdomain
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli domains add mail.example.com
```

### brew-cli domains verify

Re-check DNS records and refresh domain verification

- Route: `POST /v1/domains/{domainId}/verify`
- Class: write
- SDK: `brew.domains.verify(...)`
- Argument `domainId` — Domain id to verify

```bash
brew-cli domains verify dom_8s1Kj
```

### brew-cli domains health

Deliverability health: verdict, signals, DNS/auth, reputation

- Route: `GET /v1/domains/{domainId}/health`
- Class: read
- SDK: `brew.domains.health(...)`
- Argument `domainId` — Domain id to inspect

```bash
brew-cli domains health kx7bkh53hasmfeh5kd7sqgykt187g8ww
```

### brew-cli domains update

Update default sender settings for a domain

- Route: `PATCH /v1/domains/{domainId}`
- Class: write
- SDK: `brew.domains.updateSettings(...)`
- Argument `domainId` — Domain id to update
- `--default-sender-name <name>` — Default From display name
- `--default-from-email <email>` — Default From address on this domain
- `--default-reply-to-email <email>` — Default Reply-To address
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli domains update dom_8s1Kj --default-sender-name "Brew Coffee"
```

### brew-cli domains delete

Delete a sending domain

- Route: `DELETE /v1/domains/{domainId}`
- Class: destructive
- SDK: `brew.domains.delete(...)`
- Argument `domainId` — Domain id to delete

```bash
brew-cli domains delete dom_8s1Kj --yes
```

### brew-cli content generate-image

Generate or edit an image from a prompt

- Route: `POST /v1/content/generate-image`
- Class: write
- Consumes Brew credits
- SDK: `brew.content.generateImage(...)`
- `--prompt <text>` — What to generate
- `--mode <mode>` — text-to-image | image-editing
- `--aspect-ratio <ratio>` — e.g. 16:9, 3:2, 1:1, 9:16
- `--model <model>` — Image model override
- `--image1 <url>` — Source image for image-editing
- `--image2 <url>` — Second source image for image-editing
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli content generate-image --prompt "hero shot of a ceramic mug" --aspect-ratio 16:9
```

### brew-cli content gif

Create an animated GIF from a prompt, image, or video

- Route: `POST /v1/content/gif`
- Class: write
- Consumes Brew credits
- SDK: `brew.content.gif(...)`
- `--from <source>` — prompt | image | video
- `--prompt <text>` — What to animate
- `--image-url <url>` — Source image (from: image)
- `--video-url <url>` — Source video (from: video)
- `--duration <seconds>` — Clip duration in seconds
- `--fps <n>` — Frames per second
- `--aspect-ratio <ratio>` — e.g. 16:9, 1:1, 9:16
- `--loop <bool>` — Loop the GIF: true | false
- `--width <n>` — Output width (from: video)
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli content gif --prompt "steam rising from a coffee cup"
brew-cli content gif --image-url https://cdn.example.com/mug.png --prompt "gentle zoom"
```

### brew-cli content transform

Optimize or resize a hosted image

- Route: `POST /v1/content/transform`
- Class: write
- Consumes Brew credits
- SDK: `brew.content.transform(...)`
- `--url <url>` — Image URL to transform
- `--operation <op>` — optimize | resize (default: optimize)
- `--width <n>` — Target width (resize)
- `--height <n>` — Target height (resize)
- `--prompt <text>` — Guidance for the resize
- `--resolution <res>` — 1K | 2K | 4K (resize)
- `--output-format <format>` — png | jpeg | webp (resize)
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli content transform --url https://cdn.example.com/hero.png
brew-cli content transform --url https://cdn.example.com/hero.png --operation resize --width 1200 --height 630
```

### brew-cli content html-to-png

Render HTML to a hosted PNG

- Route: `POST /v1/content/html-to-png`
- Class: write
- Consumes Brew credits
- SDK: `brew.content.htmlToPng(...)`
- `--file <path>` — HTML file to render, or - for stdin
- `--width <n>` — Viewport width in pixels
- `--max-height <n>` — Clip the render at this height
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli content html-to-png --file email.html --width 600
cat snippet.html | brew-cli content html-to-png --file -
```

### brew-cli content add-image

Mirror an external image onto Brew-hosted storage

- Route: `POST /v1/content/add-image`
- Class: write
- Consumes Brew credits
- SDK: `brew.content.addImage(...)`
- `--url <url>` — Image URL to mirror
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli content add-image --url https://cdn.example.com/logo.png
```

### brew-cli templates list

List public templates (each row carries the rendered html)

- Route: `GET /v1/templates`
- Class: read
- SDK: `brew.templates.list(...)`
- `--brand-name <name>` — Filter by gallery brand name
- `--category <category>` — Filter by category
- `--semantic <text>` — Semantic search over the gallery
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli templates list --category welcome
brew-cli templates list --semantic "minimal product launch" --json
```

### brew-cli templates get

Fetch one public template: its links and the referenceEmailId to remix; --include html adds its HTML

- Route: `GET /v1/templates/{templateId}`
- Class: read
- Argument `templateId` — Template id: the TEMPLATE column (emailId) of `templates list`
- `--include <tokens>` — Expansions: html (the rendered HTML; a large page arrives as a content.url download link instead)

```bash
brew-cli templates get seed-vercel-newsletter
brew-cli templates get seed-vercel-newsletter --include html --json
```

### brew-cli flows list

List public email flows (real multi-step sequences by brand) as cards; `flows get <slug>` reads one

- Route: `GET /v1/flows`
- Class: read
- SDK: `brew.flows.list(...)`
- `--brand-domain <domain>` — Filter the list by brand domain
- `--category <category>` — Filter by dominant step category (welcome, newsletter, …)
- `--type <type>` — Filter by how the sequence starts: signup | newsletter
- `--semantic <text>` — Semantic search over the sequences (relevance order)
- `--sort <order>` — List order: newest (default) | emails | span | remixes
- `--slug <domain>` — 0.6 shim: read ONE flow with its steps as a single-row page (`flows get <slug>` is the real read)
- `--include <keys>` — With --slug only: `html` adds each step's rendered HTML
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli flows list --type signup --sort emails
brew-cli flows list --brand-domain brew.new --json
brew-cli flows list --semantic "developer onboarding drip"
```

### brew-cli flows get

Fetch one public email flow by brand domain, with every step (day offset, wait, subject, template id)

- Route: `GET /v1/flows/{slug}`
- Class: read
- SDK: `brew.flows.get(...)`
- Argument `slug` — The brand domain a `flows list` card carries (e.g. brew.new)
- `--include <keys>` — Comma-separated expansions: html (each step’s rendered HTML, best-effort per step)

```bash
brew-cli flows get brew.new
brew-cli flows get brew.new --include html --json
```

### brew-cli integrations list

List the integration catalog with per-provider connected state (connect via Settings, not this CLI)

- Route: `GET /v1/integrations`
- Class: read
- SDK: `brew.integrations.list(...)`

```bash
brew-cli integrations list
brew-cli integrations list --json
```

### brew-cli chats get

Brand-scoped digest of a Brew chat (artifacts + transcript tail)

- Route: `GET /v1/chats/{chatId}`
- Class: read
- SDK: `brew.chats.get(...)`
- Argument `chatId` — Brew chat id (from the chat URL / the app)

```bash
brew-cli chats get Hk2mZ8t9QbY3sW1vR0pLd
```

### brew-cli health

Check Brew API liveness (no auth required)

- Route: `GET /v1/health`
- Class: read
- SDK: `brew.health.get(...)`

```bash
brew-cli health
```

### brew-cli usage

Show plan, credit balance, and email-send quota

- Route: `GET /v1/usage`
- Class: read
- SDK: `brew.usage.get(...)`

```bash
brew-cli usage
brew-cli usage --json
```

### brew-cli doctor

Trust check: auth, API reachability, and installed-CLI vs live-API drift

- Class: read

```bash
brew-cli doctor
brew-cli doctor --json
```

### brew-cli docs

Documentation pointers; --agent prints the command manifest

- Class: read
- `--agent` — Print the machine-readable manifest of every command

```bash
brew-cli docs
brew-cli docs --agent
```

### brew-cli docs api

Fetch the live machine-readable API catalog (GET /v1/help)

- Route: `GET /v1/help`
- Class: read
- SDK: `brew.help.get(...)`

```bash
brew-cli docs api --json
```

### brew-cli api

Raw authenticated request against the Brew public API

- Class: destructive
- Argument `method` — GET | POST | PATCH | DELETE
- Argument `path` — API path, e.g. /v1/contacts/search
- `--data <json>` — JSON request body, or - to read stdin
- `--header <headers...>` — Extra header(s) as "Name: value"
- `--idempotency-key <key>` — Idempotency-Key header for safe POST retries

```bash
brew-cli api GET /v1/fields
brew-cli api POST /v1/contacts/search --data '{"limit":5}' --yes
brew-cli api GET /v1/llms.txt
```

## Known gaps

SDK methods intentionally without a dedicated command:

- `automations.triggers.getContract` — covered by `automations triggers contract get` (raw route, bound pre-SDK-v9; SDK-method migration tracked separately)
- `automations.triggers.putContract` — covered by `automations triggers contract put` (raw route, bound pre-SDK-v9)
- `automations.triggers.validatePayload` — covered by `automations triggers contract validate` (raw route, bound pre-SDK-v9)
- `payloadContracts.infer` — covered by `contracts infer` (raw route, bound pre-SDK-v9)
- `contacts.searchAll` — auto-pager covered by `contacts search --all`
- `analytics.eventsAll` — auto-pager covered by `analytics events --all`
- `sends.listAll` — auto-pager covered by `sends list --all`
- `automations.triggerInstances.listAll` — auto-pager covered by `automations trigger-instances list --all`
- `brand.update` — SDK alias of brand.patch, exposed as `brand update`
- `withBrand` — client scoping helper activated by the global `--brand`; not an API command

Public API operations not yet available (tracked by the spec parity test):

