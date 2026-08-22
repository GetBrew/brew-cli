# brew-cli command reference

<!-- GENERATED FILE — do not edit. Regenerate with `bun run docs:commands`. -->

106 commands. Classes: read (always safe), write
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
| `brew-cli contacts search` | read | `POST /v1/contacts/search` | Search contacts with structured filters (the contacts read) |
| `brew-cli contacts get` | read | `POST /v1/contacts/search` | Fetch one contact by email |
| `brew-cli contacts count` | read | `POST /v1/contacts/search` | Count contacts matching a filter |
| `brew-cli contacts upsert` | write | `POST /v1/contacts` | Create or update one contact by email |
| `brew-cli contacts upsert-many` | write | `POST /v1/contacts` | Create or update a batch of contacts (up to 100 per call) |
| `brew-cli contacts update` | write | `PATCH /v1/contacts/{email}` | Partially update one contact (PATCH; never retried) |
| `brew-cli contacts delete` | destructive | `DELETE /v1/contacts/{email}` | Delete one contact by email (idempotent) |
| `brew-cli contacts delete-many` | destructive | `POST /v1/contacts/batch-delete` | Delete up to 1000 contacts by email |
| `brew-cli contacts validate` | write ($) | `POST /v1/contacts/validate` | Batch-validate email deliverability (no contacts created) |
| `brew-cli contacts import-csv` | write | `POST /v1/contacts/import-csv` | Bulk-import contacts from a CSV file or stdin |
| `brew-cli fields list` | read | `GET /v1/fields` | List custom contact fields |
| `brew-cli fields create` | write | `POST /v1/fields` | Create a custom contact field |
| `brew-cli fields delete` | destructive | `DELETE /v1/fields/{fieldName}` | Delete a custom field definition |
| `brew-cli emails list` | read | `GET /v1/emails` | List email designs (the single email read) |
| `brew-cli emails groups list` | read | `GET /v1/email-groups` | List email groups in display order, including Ungrouped |
| `brew-cli emails groups create` | write | `POST /v1/email-groups` | Create a named email folder (group) |
| `brew-cli emails groups update` | write | `PATCH /v1/email-groups/{groupId}` | Rename an email folder (group) |
| `brew-cli emails groups delete` | destructive | `DELETE /v1/email-groups/{groupId}` | Delete an email folder (group); its emails move to Ungrouped |
| `brew-cli emails get` | read | `GET /v1/emails` | Fetch one email design by id |
| `brew-cli emails generate` | write ($) | `POST /v1/emails` | Generate a new on-brand email design from a prompt |
| `brew-cli emails import` | write | `POST /v1/emails/import` | Import existing HTML, MJML, or JSX as a new editable design |
| `brew-cli emails import-figma` | write | `POST /v1/emails/figma` | Convert one Figma frame into an editable design (deterministic, free) |
| `brew-cli emails edit` | write ($) | `PATCH /v1/emails/{emailId}` | AI-edit an email design, and/or set its subject line (subject-only is free) |
| `brew-cli emails clone` | write | `POST /v1/emails/{emailId}/clone` | Clone a design into a new one (exact snapshot copy, no AI) |
| `brew-cli emails restore` | write | `POST /v1/emails/{emailId}/restore` | Restore a previous version as the new latest (non-destructive) |
| `brew-cli emails delete` | destructive | `DELETE /v1/emails/{emailId}` | Hard-delete an email design and all its versions (idempotent) |
| `brew-cli emails export` | write | `POST /v1/emails/{emailId}/export` | Export a design to a connected ESP as a template (not a send) |
| `brew-cli emails audit-accessibility` | write ($) | `POST /v1/emails/{emailId}/accessibility-audit` | WCAG 2.1 audit of the latest rendered HTML (5 credits) |
| `brew-cli emails preview-clients` | write ($) | `POST /v1/emails/{emailId}/client-previews` | Render the design across real email clients (10 credits) |
| `brew-cli emails create-inbox-placement-test` | write ($) | `POST /v1/emails/{emailId}/inbox-placement-tests` | Seed-test where the design lands (inbox vs spam) via a real small send (10 credits) |
| `brew-cli emails get-inbox-placement-results` | read | `GET /v1/emails/{emailId}/inbox-placement-tests` | Inbox placement results: one test with --test-id, else the recent tests |
| `brew-cli emails send` | destructive | `POST /v1/sends` | Send an email: a real campaign, or a safe test with --test |
| `brew-cli sends cancel` | destructive | `POST /v1/sends/{sendId}/cancel` | Cancel a scheduled or queued send before it goes out |
| `brew-cli sends pause` | write | `POST /v1/sends/{sendId}/pause` | Pause an in-flight or scheduled send (resumable) |
| `brew-cli sends resume` | write | `POST /v1/sends/{sendId}/resume` | Resume a paused gradual send (the unsent tail is re-spread) |
| `brew-cli transactional get` | read | `GET /v1/transactional/{transactionId}` | Read a transactional email object: locked design/domain/envelope; Liquid workspaces add `variableTree` + a fireable `examplePayload` |
| `brew-cli types` | read | `GET /v1/automations/triggers` | Generate TypeScript payload contracts (triggers + transactional objects) into your codebase; --check is the CI drift gate |
| `brew-cli audiences list` | read | `GET /v1/audiences` | List audience segments |
| `brew-cli audiences get` | read | `GET /v1/audiences` | Fetch one audience segment by id |
| `brew-cli audiences create` | write | `POST /v1/audiences` | Create an audience segment from a filter definition |
| `brew-cli audiences update` | write | `PATCH /v1/audiences/{audienceId}` | Update an audience segment (name and/or filters) |
| `brew-cli audiences duplicate` | write | `POST /v1/audiences/{audienceId}/duplicate` | Copy an audience segment (the copy gets a "(copy)" name) |
| `brew-cli audiences from-events` | write | `POST /v1/audiences/from-events` | Create a frozen audience snapshot from analytics events (async build) |
| `brew-cli audiences delete` | destructive | `DELETE /v1/audiences/{audienceId}` | Delete an audience segment (contacts are kept) |
| `brew-cli automations list` | read | `GET /v1/automations` | List automations (lean rows; `automations get` for the graph) |
| `brew-cli automations get` | read | `GET /v1/automations` | Fetch one automation by id |
| `brew-cli automations create` | write | `POST /v1/automations` | Create an automation from a graph JSON (starts unpublished) |
| `brew-cli automations update` | write | `PATCH /v1/automations/{automationId}` | Update automation metadata and/or its graph (PATCH) |
| `brew-cli automations publish` | write | `PATCH /v1/automations/{automationId}` | Publish an automation — arms it for live fires; does not itself send |
| `brew-cli automations unpublish` | write | `PATCH /v1/automations/{automationId}` | Unpublish an automation so new trigger fires no longer start runs |
| `brew-cli automations delete` | destructive | `DELETE /v1/automations/{automationId}` | Delete an automation and its version history (cascade) |
| `brew-cli automations test` | write | `POST /v1/automations/{automationId}/test` | Start a suppression-aware TEST run (no real mail is sent) |
| `brew-cli automations run` | destructive | `POST /v1/automations/{automationId}/run` | Run a manual-audience automation (live send; --dry-run previews) |
| `brew-cli automations triggers list` | read | `GET /v1/automations/triggers` | List trigger events (their payload schemas drive fires) |
| `brew-cli automations triggers ready` | read | `GET /v1/automations/triggers/{triggerEventId}/fire` | Preflight a trigger without firing: key + scope + permissions pass/fail, the payload contract, and what a fire would start |
| `brew-cli automations triggers create` | write | `POST /v1/automations/triggers` | Create a trigger event (title + typed payload schema) |
| `brew-cli automations triggers update` | write | `PATCH /v1/automations/triggers/{triggerEventId}` | Update a trigger event (title, description, payload schema) |
| `brew-cli automations triggers delete` | destructive | `DELETE /v1/automations/triggers/{triggerEventId}` | Delete a trigger event (rejected while automations depend on it) |
| `brew-cli automations triggers fire` | destructive | `POST /v1/automations/triggers/{triggerEventId}/fire` | Fire a trigger event with a payload (starts LIVE runs) |
| `brew-cli automations runs list` | read | `GET /v1/automations/runs` | List automation runs (live + test history) |
| `brew-cli automations audience-runs list` | read | `GET /v1/automations/audience-runs` | List manual-audience runs (newest first) |
| `brew-cli automations audience-runs control` | destructive | `POST /v1/automations/audience-runs/{audienceRunId}/control` | Pause, resume, or cancel an in-flight manual-audience run |
| `brew-cli analytics overview` | read | `GET /v1/analytics/overview` | Brand overview: totals, rates, timeseries (default last 7 days) |
| `brew-cli analytics campaigns` | read | `GET /v1/analytics/campaigns` | Lifetime per-campaign KPIs (sent, opened, clicked, bounced) |
| `brew-cli analytics automations` | read | `GET /v1/analytics/automations` | Windowed per-automation performance + totals |
| `brew-cli analytics events` | read | `GET /v1/analytics/events` | Unified event explorer (email, automation, trigger, inbound) |
| `brew-cli analytics sends list` | read | `GET /v1/analytics/sends` | List campaign/automation sends with delivery stats |
| `brew-cli analytics sends get` | read | `GET /v1/analytics/sends` | Fetch one send by id |
| `brew-cli analytics trigger-instances list` | read | `GET /v1/analytics/trigger-instances` | List fired-trigger instances (ingest + match history) |
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
| `brew-cli domains get` | read | `GET /v1/domains` | Fetch one sending domain by id |
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

Fetch one contact by email

- Route: `POST /v1/contacts/search`
- Class: read
- Derived from `brew.contacts.search(...)`
- Argument `email` — Email address of the contact

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

List email designs (the single email read)

- Route: `GET /v1/emails`
- Class: read
- SDK: `brew.emails.list(...)`
- `--status <status>` — Filter by status: streaming | complete | error
- `--group-id <groupId>` — Filter by one group id; use ungrouped for no saved group
- `--sort <field>` — Sort by updatedAt | createdAt | title
- `--order <order>` — Sort order: asc | desc
- `--created-at-from <iso>` — Created at or after (ISO)
- `--created-at-to <iso>` — Created at or before (ISO)
- `--updated-at-from <iso>` — Updated at or after (ISO)
- `--updated-at-to <iso>` — Updated at or before (ISO)
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli emails list --status complete --limit 10
brew-cli emails list --group-id ungrouped --sort title --order asc
brew-cli emails list --updated-at-from 2026-08-01T00:00:00Z
brew-cli emails list --all --json
```

### brew-cli emails groups list

List email groups in display order, including Ungrouped

- Route: `GET /v1/email-groups`
- Class: read
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli emails groups list
brew-cli emails groups list --all --json
```

### brew-cli emails groups create

Create a named email folder (group)

- Route: `POST /v1/email-groups`
- Class: write
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
- Argument `groupId` — Named group id (grp_*); Ungrouped cannot be deleted

```bash
brew-cli emails groups delete grp_welcome --yes
```

### brew-cli emails get

Fetch one email design by id

- Route: `GET /v1/emails`
- Class: read
- Derived from `brew.emails.list(...)`
- Argument `emailId` — Design id returned by emails generate/import
- `--include <tokens>` — Comma-separated expansions: html,versions

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

AI-edit an email design, and/or set its subject line (subject-only is free)

- Route: `PATCH /v1/emails/{emailId}`
- Class: write
- Consumes Brew credits
- SDK: `brew.emails.edit(...)`
- Argument `emailId` — Design id to edit
- `--prompt <text>` — The edit instruction
- `--email-version-id <id>` — Edit from a specific version (default: latest); needs --prompt
- `--content-urls <urls...>` — Page URL(s) to pull copy and imagery from, repeatable
- `--subject-line <text>` — The design's default inbox subject line; alone it skips the AI run
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli emails edit eml_2SmZOWV3ZQ7W5x6g3m4p --prompt "Tighten the hero copy"
brew-cli emails edit eml_2SmZOWV3ZQ7W5x6g3m4p --subject-line "Your September roundup"
```

### brew-cli emails clone

Clone a design into a new one (exact snapshot copy, no AI)

- Route: `POST /v1/emails/{emailId}/clone`
- Class: write
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
- `--to-version <n>` — Version number to restore
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails restore eml_2SmZOWV3ZQ7W5x6g3m4p --to-version 2
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
- Argument `emailId` — Design id to export
- `--provider <provider>` — Connected ESP: braze, hubspot, klaviyo, mailchimp, iterable, postmark, onesignal, mailgun, sendgrid
- `--template-name <name>` — Template name in the ESP (default: the email title)
- `--dry-run` — Validate design, ownership, and ESP connection without creating a template
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails export eml_2SmZOWV3ZQ7W5x6g3m4p --provider klaviyo
brew-cli emails export eml_2SmZOWV3ZQ7W5x6g3m4p --provider mailchimp --template-name "Fall sale" --dry-run
```

### brew-cli emails audit-accessibility

WCAG 2.1 audit of the latest rendered HTML (5 credits)

- Route: `POST /v1/emails/{emailId}/accessibility-audit`
- Class: write
- Consumes Brew credits
- Argument `emailId` — Design id to audit
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails audit-accessibility eml_2SmZOWV3ZQ7W5x6g3m4p
```

### brew-cli emails preview-clients

Render the design across real email clients (10 credits)

- Route: `POST /v1/emails/{emailId}/client-previews`
- Class: write
- Consumes Brew credits
- Argument `emailId` — Design id to preview
- `--clients <ids...>` — Client id(s) to render, repeatable (e.g. applemail16 iphone16_18); default: a popular spread
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli emails preview-clients eml_2SmZOWV3ZQ7W5x6g3m4p
brew-cli emails preview-clients eml_2SmZOWV3ZQ7W5x6g3m4p --clients applemail16 outlook2021_win11_lm_dt
```

### brew-cli emails create-inbox-placement-test

Seed-test where the design lands (inbox vs spam) via a real small send (10 credits)

- Route: `POST /v1/emails/{emailId}/inbox-placement-tests`
- Class: write
- Consumes Brew credits
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

Inbox placement results: one test with --test-id, else the recent tests

- Route: `GET /v1/emails/{emailId}/inbox-placement-tests`
- Class: read
- Argument `emailId` — Design id the tests ran on
- `--test-id <id>` — One test: live status + per-provider placement (re-poll ~30s until completed)

```bash
brew-cli emails get-inbox-placement-results eml_2SmZOWV3ZQ7W5x6g3m4p
brew-cli emails get-inbox-placement-results eml_2SmZOWV3ZQ7W5x6g3m4p --test-id ibp_2f1c9d8a
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
- Argument `sendId` — Send id to pause
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli sends pause snd_123
```

### brew-cli sends resume

Resume a paused gradual send (the unsent tail is re-spread)

- Route: `POST /v1/sends/{sendId}/resume`
- Class: write
- Argument `sendId` — Send id to resume
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli sends resume snd_123
```

### brew-cli transactional get

Read a transactional email object: locked design/domain/envelope; Liquid workspaces add `variableTree` + a fireable `examplePayload`

- Route: `GET /v1/transactional/{transactionId}`
- Class: read
- Argument `transactionId` — Transactional email id (txn_…) from Email Actions → Transactional Email

```bash
brew-cli transactional get txn_8fK2mQ4pLx
```

### brew-cli types

Generate TypeScript payload contracts (triggers + transactional objects) into your codebase; --check is the CI drift gate

- Route: `GET /v1/automations/triggers`
- Class: read
- `--out <file>` — Output file (default brew-contracts.ts)
- `--transaction <transactionIds...>` — Transactional object ids (txn_…) to include, contract derived from each pinned template
- `--check` — Verify the output file is up to date instead of writing; exits 1 on drift

```bash
brew-cli types
brew-cli types --out src/brew-contracts.ts --transaction txn_8fK2mQ4pLx
brew-cli types --check
```

### brew-cli audiences list

List audience segments

- Route: `GET /v1/audiences`
- Class: read
- SDK: `brew.audiences.list(...)`
- `--include <tokens>` — Comma-separated expansions: count
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli audiences list
brew-cli audiences list --include count --limit 10
brew-cli audiences list --all --json
```

### brew-cli audiences get

Fetch one audience segment by id

- Route: `GET /v1/audiences`
- Class: read
- Derived from `brew.audiences.list(...)`
- Argument `audienceId` — Audience id to fetch
- `--include <tokens>` — Comma-separated expansions: count

```bash
brew-cli audiences get aud_3k9sQ
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
- Argument `audienceId` — Audience id to duplicate
- `--idempotency-key <key>` — Idempotency-Key for safe retries (auto-generated otherwise)

```bash
brew-cli audiences duplicate aud_3k9sQ
```

### brew-cli audiences from-events

Create a frozen audience snapshot from analytics events (async build)

- Route: `POST /v1/audiences/from-events`
- Class: write
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

Fetch one automation by id

- Route: `GET /v1/automations`
- Class: read
- Derived from `brew.automations.list(...)`
- Argument `automationId` — Id of the automation
- `--include <tokens>` — Comma-separated expansions: graph | versions

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

List trigger events (their payload schemas drive fires)

- Route: `GET /v1/automations/triggers`
- Class: read
- SDK: `brew.automations.triggers.list(...)`
- `--trigger <triggerEventId>` — Fetch one trigger event (single-row page)
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli automations triggers list
brew-cli automations triggers list --trigger tev_123
```

### brew-cli automations triggers ready

Preflight a trigger without firing: key + scope + permissions pass/fail, the payload contract, and what a fire would start

- Route: `GET /v1/automations/triggers/{triggerEventId}/fire`
- Class: read
- Argument `triggerEventId` — Trigger id (tri_…, or an integration composite id)

```bash
brew-cli automations triggers ready tri_signup
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
brew-cli automations triggers fire tev_123 --input '{"payload":{"userId":"u_1"}}' --yes
```

### brew-cli automations runs list

List automation runs (live + test history)

- Route: `GET /v1/automations/runs`
- Class: read
- SDK: `brew.automations.runs.list(...)`
- `--run <automationRunId>` — Fetch one run (single-row page)
- `--include <tokens>` — Comma-separated expansions: logs
- `--automation <automationId>` — Filter by automation
- `--trigger <triggerEventId>` — Filter by trigger event
- `--trigger-instance <triggerInstanceId>` — Filter by fired trigger instance
- `--recipient <email>` — Filter by recipient email
- `--status <status>` — pending | running | completed | failed | cancelled
- `--mode <mode>` — live | test
- `--since <datetime>` — Runs started at/after (ISO-8601)
- `--until <datetime>` — Runs started at/before (ISO-8601)
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli automations runs list --automation am_123 --status failed
brew-cli automations runs list --run arun_123 --include logs
```

### brew-cli automations audience-runs list

List manual-audience runs (newest first)

- Route: `GET /v1/automations/audience-runs`
- Class: read
- `--audience-run-id <id>` — Fetch a single audience run by id
- `--automation-id <id>` — Filter runs to a single automation
- `--limit <n>` — Max rows, 1-200 (default 50)

```bash
brew-cli automations audience-runs list
brew-cli automations audience-runs list --automation-id auto_abc --limit 20
```

### brew-cli automations audience-runs control

Pause, resume, or cancel an in-flight manual-audience run

- Route: `POST /v1/automations/audience-runs/{audienceRunId}/control`
- Class: destructive
- Argument `audienceRunId` — Audience run id to control
- `--action <action>` — pause (resumable) | resume | cancel (final)

```bash
brew-cli automations audience-runs control arun_01HZ --action pause
brew-cli automations audience-runs control arun_01HZ --action cancel --yes
```

### brew-cli analytics overview

Brand overview: totals, rates, timeseries (default last 7 days)

- Route: `GET /v1/analytics/overview`
- Class: read
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

Lifetime per-campaign KPIs (sent, opened, clicked, bounced)

- Route: `GET /v1/analytics/campaigns`
- Class: read
- SDK: `brew.analytics.campaigns(...)`
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
- `--recipient <email>` — Filter by recipient email
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

List campaign/automation sends with delivery stats

- Route: `GET /v1/analytics/sends`
- Class: read
- SDK: `brew.analytics.sends.list(...)`
- `--send <sendId>` — Fetch one send (single-row page)
- `--email <emailId>` — Filter by email design
- `--include <tokens>` — Comma-separated expansions: events
- `--status <status>` — scheduled | queued | sending | sent | failed | canceled
- `--since <datetime>` — Window start (ISO-8601)
- `--until <datetime>` — Window end (ISO-8601)
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli analytics sends list --status sent
brew-cli analytics sends list --email em_123 --all --json
```

### brew-cli analytics sends get

Fetch one send by id

- Route: `GET /v1/analytics/sends`
- Class: read
- Derived from `brew.analytics.sends.list(...)`
- Argument `sendId` — Id of the send
- `--include <tokens>` — Comma-separated expansions: events

```bash
brew-cli analytics sends get snd_123
brew-cli analytics sends get snd_123 --include events
```

### brew-cli analytics trigger-instances list

List fired-trigger instances (ingest + match history)

- Route: `GET /v1/analytics/trigger-instances`
- Class: read
- SDK: `brew.analytics.triggerInstances.list(...)`
- `--trigger <triggerEventId>` — Filter by trigger event
- `--trigger-instance <triggerInstanceId>` — Fetch one instance (single-row page)
- `--limit <n>` — Page size, 1-100 (default 100)
- `--cursor <cursor>` — Opaque pagination cursor from a previous page
- `--all` — Follow the cursor and return every page as one result
- `--input <json>` — Full JSON request body, or - to read stdin (flags override it)

```bash
brew-cli analytics trigger-instances list --trigger tev_123
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

```bash
brew-cli brands list --json
```

### brew-cli brands get

One brand's lifecycle state (the extraction polling endpoint)

- Route: `GET /v1/brands/{brandId}`
- Class: read
- Argument `brandId` — Brand id to fetch

```bash
brew-cli brands get kx7b3s7fapqz8mjm12ekz1kxdx87yceg
```

### brew-cli brands create

Create a brand and start async extraction (needs an ORGANIZATION-scoped key); poll `brands get` until ready

- Route: `POST /v1/brands`
- Class: write
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

```bash
brew-cli api-keys list
brew-cli api-keys list --json
```

### brew-cli api-keys create

Mint an API key; the plaintext `key` is returned ONCE — this output is the only copy

- Route: `POST /v1/api-keys`
- Class: write
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

Fetch one sending domain by id

- Route: `GET /v1/domains`
- Class: read
- Derived from `brew.domains.list(...)`
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

### brew-cli integrations list

List the integration catalog with per-provider connected state (connect via Settings, not this CLI)

- Route: `GET /v1/integrations`
- Class: read

```bash
brew-cli integrations list
brew-cli integrations list --json
```

### brew-cli chats get

Brand-scoped digest of a Brew chat (artifacts + transcript tail)

- Route: `GET /v1/chats/{chatId}`
- Class: read
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

- `contacts.searchAll` — auto-pager covered by `contacts search --all`
- `analytics.eventsAll` — auto-pager covered by `analytics events --all`
- `analytics.sends.listAll` — auto-pager covered by `analytics sends list --all`
- `analytics.triggerInstances.listAll` — auto-pager covered by `analytics trigger-instances list --all`
- `brand.update` — SDK alias of brand.patch, exposed as `brand update`
- `emails.auditAccessibility` — SDK 8.0.0 issues GET for the POST-only operation (upstream bug); `emails audit-accessibility` binds via raw transport instead

Public API operations not yet available (tracked by the spec parity test):

