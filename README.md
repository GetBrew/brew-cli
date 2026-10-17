# brew-cli

Official agent-first command-line interface for the [Brew](https://brew.new)
public API — manage contacts, email designs, campaigns, automations,
audiences, domains, and analytics from the terminal, a script, or an AI
agent.

Built as a thin shell over [`@brew.new/sdk`](https://www.npmjs.com/package/@brew.new/sdk):
the SDK carries the typed transport (retries, idempotency, error
envelopes, types generated from the canonical OpenAPI spec), the CLI adds
the command surface and the agent contract. One source of truth end to
end: Zod contracts → OpenAPI → SDK → CLI, drift-gated at every hop.

## Install

```bash
npm install -g @brew.new/cli        # or run without installing:
npx @brew.new/cli --help
```

```bash
brew install getbrew/tap/brew-cli   # standalone binary (macOS/Linux)
```

Prebuilt binaries for macOS (arm64/x64), Linux (x64/arm64), and Windows
are attached to every [GitHub Release](https://github.com/GetBrew/brew-cli/releases).

## Quick start

```bash
brew-cli login                       # sign in through the browser (or --paste a key)
brew-cli doctor                      # trust check: auth, reachability, CLI-vs-API drift (exit-code gated)
brew-cli doctor --project            # this app vs its brew.json: files, key, SDK, keys, domain, auth hook
brew-cli whoami
brew-cli contacts search --filter email:equals:jane@example.com
brew-cli emails list --limit 10
brew-cli emails send em_123 --test --to you@company.com
brew-cli content upload-image ./logo.png   # a local image into the brand library
```

Every command supports `--json` (automatic when stdout is piped), prints
data on stdout and progress on stderr, and documents itself:

```bash
brew-cli emails send --help
```

## Set up Brew in your app: `init`

```bash
npx @brew.new/cli init       # or, installed: brew-cli init
```

Short launchers (`npx brew.new init`, `npm create brew`) live in
`packages/launchers/` and are not on npm yet.

`init` reads the project (framework, auth library, package manager,
monorepo, editors), signs you in through the browser, and then:

1. sets up and publishes the auth and lifecycle starter kit for your auth
   library (`app-emails kit`);
2. installs `@brew.new/sdk` with your package manager;
3. writes `lib/brew.ts` (a lazy `getBrew()`), `lib/brew-auth.ts` (Better
   Auth callbacks, the Auth.js provider, or welcome/auth helpers),
   `lib/brew-contracts.ts` (payload types and the `brew.send` key
   registry), a Supabase Send Email Hook function when you use Supabase
   Auth, `.env.example` and `brew.json`;
4. puts the app key in `.env.local` (mode 0600, git-ignored, never under a
   `NEXT_PUBLIC_`/`VITE_`/`PUBLIC_` name);
5. prints patches for your auth config; after review, the report's
   `--apply-patches <id>@<hash>` command applies each one only while its
   file still matches the hash it was reviewed against (an Auth.js config
   without a database adapter gets a manual step instead, since Auth.js
   email sign-in needs one);
6. adds the Brew MCP server for the editors the project uses, an
   `AGENTS.md` block, and (in Claude Code projects) the agent skills;
7. sends you a test email from the team sandbox.

Every file is create-only: a file you changed is reported
`kept-user-version` and left alone, and a re-run with nothing new changes
nothing. Until a sending domain verifies, app emails reach members of
your Brew organization only; `--domain mail.example.com` adds a
transactional domain and prints its DNS records without waiting, plus the
domain's page in Brew, where **Connect automatically** (Entri) adds the
records at your DNS provider. That button runs in the Brew app: the API
has no endpoint for it, so the CLI cannot do it for you.

`--app-url https://app.example.com` shows the app's URL on the sign-in
approval page. With an organization API key (`BREW_API_KEY` or
`--api-key`), init also picks the brand whose website is the app, or
creates one from the URL (`POST /v1/brands`, organization keys with the
`brands` scope) and waits for it (`--no-wait` leaves that to a re-run). A
key bound to one brand is never moved: a mismatch is reported.

### The auth provider's own emails (Supabase, Clerk)

Nothing about your auth provider changes under a bare `--yes`. Without the
flags below, init prints the manual steps.

- **Supabase Auth**: `--configure-supabase` connects Brew as the hosted
  Send Email Hook (`integrations connect supabase_auth`) and points
  Authentication > Hooks > Send Email at it through the Supabase
  Management API, using a Supabase personal access token from
  `SUPABASE_ACCESS_TOKEN` on this machine (sent to api.supabase.com only,
  never to Brew). The previous hook settings go into `brew.json` first
  (a previous hook secret into `.env.local`, never `brew.json`).
  `--dry-run --json` shows the exact PATCH with the secret replaced. The
  self-hosted Edge Function init writes stays the alternative.
- **Clerk**: connect Clerk's `email.created` webhook first
  (`integrations connect clerk`). `--configure-clerk` then turns off
  "Delivered by Clerk" for exactly the templates Brew publishes, through
  Clerk's Backend API with `CLERK_SECRET_KEY` (shell or `.env.local`), and
  only once `integrations connection clerk` reports `active`, so no email
  is dropped in between.

`init --rollback-provider --yes` puts back what either flag changed, from
`brew.json`.

### Hosted auth hooks: `integrations connect`

```bash
# the secret comes from an environment variable or stdin, never a flag value
brew-cli integrations connect supabase_auth --signing-secret-env SEND_EMAIL_HOOK_SECRET \
  --project-url https://<ref>.supabase.co --yes
printenv CLERK_WEBHOOK_SIGNING_SECRET | brew-cli integrations connect clerk --signing-secret-stdin --yes
brew-cli integrations connection clerk   # pending_verification until the first signed delivery, then active
```

`connect` prints `{ connectionId, webhookUrl, status }` (and each auth
email it set up): paste `webhookUrl` into Supabase's hook or Clerk's
endpoint.

### Check a project: `doctor --project`

`brew-cli doctor --project [--json]` checks the app against its
`brew.json`: managed files unchanged, `BREW_API_KEY` in `.env.local`,
git-ignored and never under a `NEXT_PUBLIC_`/`VITE_`/`PUBLIC_` name,
`@brew.new/sdk` declared and installed at the version the generated files
need, and with the app key: every key in `brew.json` set up and published
(`GET /v1/app-emails`), a verified sending domain, and the hosted auth
hook's status. Any failed check exits 1.

Agents run it in two steps and read one JSON report
(`schemas/init-report.json`: `status`, `steps[]`, `files[]`, `patches[]`,
`nextSteps[]` with `actor: agent | human`, `agentInstructions`):

```bash
npx @brew.new/cli init --dry-run --json   # the plan; no writes, no sign-in, no mutating requests
npx @brew.new/cli init --yes --json       # exit 3: show the person nextSteps' link + code, then run its resume command
```

Exit codes: 0 `complete` or `action_required` (blocking `nextSteps` left),
1 `failed`, 2 usage or a monorepo root with several apps (pick one with
`--app apps/web`), 3 sign-in required, 4 confirmation required.

## Send app email by key

An app email is a trigger with a stable key (`auth.password-reset`,
`order.paid`), wired to a design and a published automation. Your code
sends it with `brew.send(key, payload)` from `@brew.new/sdk`; the CLI does
the same from a terminal or an agent:

```bash
brew-cli app-emails kit --stack better-auth --yes      # auth + lifecycle starter kit, published
brew-cli app-emails upsert order.paid --source-file emails/order-paid.tsx --yes
brew-cli app-emails list                                # sender and readiness per key
brew-cli send auth.password-reset --to you@example.com --data '{"confirmationUrl":"https://…"}' --yes
brew-cli types --out lib/brew-contracts.ts              # payload types + the brew.send key registry
```

Until a sending domain verifies, app emails go out from the team-only
sandbox: members of your Brew organization receive them, under a daily
cap. `send`, `upsert` and `kit` are destructive (they send or publish) and
exit 4 without `--yes` off a terminal. `upsert` and `kit` need a key with
both the `automations` and `emails` scopes. A mistyped key, format, set or
stack exits 2 before any request. `types` adds a
`declare module '@brew.new/sdk'` block for keyed triggers; pass
`--no-registry` in a project that does not install the SDK.

## Move from Resend: `migrate resend`

```bash
printf %s "$RESEND_API_KEY" | brew-cli migrate resend --resend-key-stdin           # plan: writes brew.migration.json, changes nothing
printf %s "$RESEND_API_KEY" | brew-cli migrate resend --resend-key-stdin --apply \
  --domain news.example.com --yes                                                    # copy it into your Brew brand
```

The plan reads the Resend account (with a full-access key that stays on
this machine and is never sent to Brew) at 2 requests a second, reads your
Brew brand, and scans the project for `resend.emails.send` and
`resend.batch.send`. `--apply` (destructive class: exit 4 without `--yes`)
then copies:

| Resend | Brew |
| --- | --- |
| Templates (`{{{VAR}}}`) | App emails by key, imported with `placeholders: "resend"` |
| React Email files | App emails by key, props as merge tags (`props: "merge_tags"`) |
| Contacts | Contacts (subscribed with an import consent record; unsubscribed stay unsubscribed) |
| Segments, topics | A boolean contact field each, and an audience on it |
| Suppressions, unsubscribed contacts | `--domain`'s unsubscribe list |
| Draft broadcasts | Brew draft emails (nothing is sent) |
| Domains, webhooks, automations | Reported only |

Progress lives in `brew.migration.json` (ids, keys, counts and cursors,
never an address, a name or a key), so an interrupted apply resumes where
it stopped. Brew signs with the same DKIM selector as Resend
(`resend._domainkey`): the plan suggests a subdomain to verify in Brew
until cutover. Sends that do not carry over (raw `html`, `attachments`,
`cc`, …) become `edit-file` next steps with a suggested
`getBrew().send(key, payload)`; `--rewrite-imports` moves a file to
`@brew.new/sdk/resend` only when every send through it is a migrated
template.

## Connect your AI editor to Brew (MCP)

```bash
brew-cli mcp install                               # the editors this project uses
brew-cli mcp install --client cursor claude-code   # or name them
brew-cli mcp install --client all --dry-run --json # plan only
```

`mcp install` adds the Brew MCP server (`https://brew.new/api/mcp`, or the
origin of `--api-url` + `/api/mcp`) to each client's config, merging a
`brew` entry and keeping every other server:

| Client | `--client` | Project file (`--scope project`, default) | User file (`--scope user`) |
| --- | --- | --- | --- |
| Cursor | `cursor` | `.cursor/mcp.json` | `~/.cursor/mcp.json` |
| VS Code | `vscode` | `.vscode/mcp.json` | the profile's `mcp.json` |
| Claude Code | `claude-code` | `.mcp.json` | prints `claude mcp add --scope user …` |
| Gemini CLI | `gemini` | `.gemini/settings.json` | `~/.gemini/settings.json` |
| Devin Desktop (Windsurf) | `windsurf` | (user only) | `~/.config/devin/mcp_config.json` (`$XDG_CONFIG_HOME/devin/`, Windows `%APPDATA%\devin\`) |
| Codex | `codex` | (user only) | `~/.codex/config.toml` (`$CODEX_HOME`) |

Without `--client` it configures the clients it detects (`.cursor/`,
`.vscode/`, `.claude/` or `CLAUDECODE=1`, `.gemini/`); a detected Devin
Desktop (`.windsurf/` or `.devin/`) or Codex is reported with its snippet
but only written when you name it, since its config lives in your home
directory. `--auth oauth` (default) writes the URL only and the client
signs in on first use; Codex signs in only through its own command, so its
result carries `nextStep: "codex mcp login brew"`. `--auth env` adds an
`Authorization` header that the client fills from `BREW_API_KEY` at
connect time: `${env:BREW_API_KEY}` for Cursor, VS Code and Devin Desktop,
`${BREW_API_KEY}` for Claude Code and Gemini CLI, `bearer_token_env_var`
for Codex. The client reads the variable from the environment it was
started with, so an editor opened from the Dock or Start menu may not see
a variable your shell exports. A literal key is never written.

An existing `brew` entry is never replaced: the same settings report
`unchanged`, other settings come back `manual` with the snippet to paste.
So does a config with comments, and a config that is a symbolic link
whose target leaves the project (or your home directory, for user
files). `--print` prints the snippets and writes nothing. Each result is
`created`, `updated`, `unchanged`, `manual` or `printed`; Cursor and
VS Code results carry a one-click install `deeplink`.

## Authentication

### Sign in through the browser

```bash
brew-cli login            # opens brew.new, then waits for approval
brew-cli login --no-open  # print the link instead of opening a browser
```

On an interactive terminal, `login` starts a sign-in on brew.new, prints
the link and a code, and opens the page in your browser. Check that the
code on the page matches the one in your terminal, pick a brand, and
approve. The CLI then prints `Signed in as <you> to <brand>` and stores a
new brand key, named `CLI · <computer>`, in `~/.config/brew-cli/config.json`
(mode 0600). It is an ordinary brand key: it is listed, and can be revoked,
under Settings, API keys.

The key never passes through the browser. The CLI makes a one-time key
pair, Brew encrypts the new key to it on approval, and the CLI collects it
by polling, so sign-in also works from GitHub Codespaces, Replit, Gitpod,
an SSH session or CI: there the CLI does not try to open a browser, and you
open the link on any device.

For agents and scripts, which cannot wait at a prompt:

```bash
brew-cli login --no-wait --json   # exit 3: {"status":"pending","verificationUrl":…,"userCode":…,"expiresAt":…,"resumeCommand":…}
brew-cli login --resume           # after the person approved: collects and stores the key
brew-cli login --resume --wait 2m # wait at most two minutes, else exit 3 pending again
```

`--no-wait` keeps the pending sign-in (its poll secret and private key) in
`~/.config/brew-cli/pending-auth.json` (mode 0600) until it is approved,
denied or expired. A denied or expired sign-in exits 3 with
`CLI_LOGIN_DENIED` or `CLI_LOGIN_EXPIRED`; run `login` again. A sign-in
lasts ten minutes.

### API keys

```bash
brew-cli login --paste                        # paste a key at the prompt
brew-cli login --api-key brew_xxxxxxxx        # or pass it
echo "$BREW_API_KEY" | brew-cli login         # or pipe it
```

| Precedence | Source |
| --- | --- |
| 1 | `--api-key <key>` flag |
| 2 | `BREW_API_KEY` environment variable |
| 3 | `~/.config/brew-cli/config.json` (written by `brew-cli login`, mode 0600) |

Keys are created at [brew.new/settings/api](https://brew.new/settings/api).
A key is scoped either to ONE brand or to the whole organization.
Organization-scoped keys must name a brand on brand-scoped commands:
`--brand <brandId>`, `BREW_BRAND_ID`, or `brew-cli config set brandId …`.
Other environments: `--api-url http://localhost:3000/api` or
`BREW_API_URL`.

## Agent contract

Designed for AI agents as first-class users:

- **Structured everything** — `--json` prints API envelopes verbatim;
  auto-enabled when stdout is not a TTY. Errors are JSON envelopes on
  stderr with stable `code`s, the `x-request-id`, and `details` when
  the API names the offending fields (a trigger fire's `400 INVALID_PAYLOAD`).
- **Semantic exit codes** — `0` ok · `1` API/runtime · `2` usage ·
  `3` auth · `4` confirmation required · `130` interrupted (SIGINT) ·
  `143` terminated (SIGTERM). After printing its envelope an interrupted
  CLI re-raises the signal, so a shell loop around it stops too.
- **Every request is bounded** — the deadline covers the response body,
  not only the headers. `--timeout <duration>` (`90s`, `1500ms`, `5m`)
  caps the whole command, retries and `--all` pages included; long-running
  commands (`emails generate`, `content gif`, …) default to the SDK's own
  per-call budget. `--max-retries <n>` tunes the retry loop. Ctrl-C stops
  a request wherever it is.
- **Replay, don't repeat** — the API keeps working after the CLI
  disconnects, so a write that timed out, lost its connection or was
  interrupted may still complete. Its envelope carries the
  `idempotencyKey` it was sent with and a `retryCommand` that replays it
  (the first attempt's result, not a second write) instead of running it
  twice. The replay needs the API's idempotency store: while it is
  degraded, writes other than sends run without it, so for a write that
  must not happen twice (creating a brand, say) pass `--max-retries 0` and
  check whether it landed before you re-run it.
- **Confirmation protocol** — irreversible commands (sends, deletes,
  trigger fires) never hang waiting for input: non-interactive callers
  get exit `4` plus a JSON envelope containing a ready-to-run
  `confirmCommand`; pass `--yes` to proceed. Humans on a TTY get a y/N
  prompt. Test sends (`emails send --test`) skip the gate. Sign-in works
  the same way: `login --no-wait --json` exits `3` with the link and code
  to show a person, and a `resumeCommand` to run once they approved.
  Printed commands (`confirmCommand`, `retryCommand`, `resumeCommand`,
  "run … login") start the way the CLI was invoked: a wrapper that runs it
  through a package runner sets `BREW_CLI_INVOKED_AS` (for example
  `npx -y @brew.new/cli@<version>`), so they re-run through it.
- **No fuzzy matching** — unknown commands fail hard with exit 2.
- **Machine-readable discovery** — `brew-cli docs --agent` prints the
  full manifest (commands, flags, classes, routes, env, exit codes);
  `brew-cli docs api` fetches the live `GET /v1/help` catalog;
  `brew-cli api <method> <path>` is the raw escape hatch for anything
  the CLI has no dedicated command for yet.
- **Pipes and stdin** — `--input <json|->` and `--file <path|->`
  everywhere bodies or files are needed; `--all` drains cursor
  pagination; `--idempotency-key` makes retries safe across process
  restarts.

## Command reference

The full generated reference lives in
[`docs/commands/README.md`](./docs/commands/README.md). Resource groups:
`contacts`, `fields`, `emails` (+ `groups`, `comments`), `sends`,
`audiences`, `automations` (+ `triggers`, `runs`, `audience-runs`,
`trigger-instances`), `analytics`, `insights`, `brand`, `content`,
`templates`, `flows`, `chats`, `notifications`, `mcp`, plus
`login`/`logout`/`whoami`/`config`/`usage`/`health`/`docs`/`api`.

Every collection with ids to look up has a real detail read — `<group> get
<id>` returns the bare row, and an unknown id surfaces the API's own typed
`404`. `notifications list` and `emails comments list` are list-only (one
comment thread is `emails comments list <emailId> --comment-id <id>`).

## How this repo stays in sync with the API, MCP, and SDK

The app repo's Zod contracts generate the OpenAPI spec, which is mirrored
into this repo (`openapi/public-api-v1.yaml`) and the SDK: byte-identically,
except that a release can leave out blocks another open PR owns (0.13.0
keeps `main`'s email-audit and add-image blocks for the PR that ships them). Two parity tests gate CI here:

- **SDK parity** walks the installed `@brew.new/sdk` client and fails if
  any method lacks a command or a reviewed skip entry — so an SDK upgrade
  that ships new surface fails the build until the CLI ships it too.
- **Spec parity** walks the vendored spec and fails on any operation
  without a command route or a reviewed skip — including operations the
  SDK itself has not wrapped yet, making this repo the outermost
  completeness sentinel of the whole chain.
- **The nightly spec-drift sentinel** downloads the live published spec
  and diffs it against the vendored copy, opening a labeled issue the day
  the real API grows past this CLI.
- **`brew-cli doctor`** closes the loop at runtime: it diffs the installed
  command surface against the server's live `GET /v1/help` catalog and
  exit-codes the verdict, so agents can gate work on a current, authed,
  in-sync CLI. Agents: see [`skills/brew-cli/SKILL.md`](./skills/brew-cli/SKILL.md).

Contributor guide: [`AGENTS.md`](./AGENTS.md) · Release process:
[`RELEASING.md`](./RELEASING.md).

## License

MIT
