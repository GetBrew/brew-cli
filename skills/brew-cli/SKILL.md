---
name: brew-cli
description: Drive the Brew email platform from the terminal with brew-cli — explore, check, test, and review contacts, emails, audiences, automations, domains, and analytics through typed commands over the public API. Use whenever a task touches Brew data or verifies Brew API behavior, especially against a local dev server.
---

# brew-cli for agents

One typed command per public-API operation (the generated reference is
`docs/commands/README.md`; `brew-cli docs --agent` lists every command).
JSON output is automatic when stdout is piped.

## Start every session with the trust check

```bash
brew-cli doctor
```

Exit 0 = API reachable, auth valid, and this CLI covers every live
operation. Exit 1 = read the report: `DRIFT` lines list live operations
this build lacks (update the CLI); auth/reachability failures name the fix.

## Auth and targeting

- `BREW_API_KEY` env var (or `brew-cli login` once, or `--api-key`).
- No key and a person to ask? Sign in through their browser without
  blocking on it:

  ```bash
  brew-cli login --no-wait --json   # exit 3: {status: "pending", verificationUrl, userCode, expiresAt, resumeCommand}
  ```

  Show the person `verificationUrl` and `userCode`, and ask them to approve
  on brew.new only if the code on the page matches. Then run the
  `resumeCommand` (`brew-cli login --resume`): exit 0 stores the key and
  reports `userEmail` and `brandName`; exit 3 with `status: "pending"`
  means not approved yet (add `--wait 2m` to wait for it); exit 3 with
  `CLI_LOGIN_DENIED` or `CLI_LOGIN_EXPIRED` means start over. Never ask for
  or print the key itself. A plain `brew-cli login` off a terminal exits 2
  instead of waiting.
- Default target is production. For a local dev server:
  `BREW_API_URL=http://localhost:3000/api` (Brew repo dev keys live in
  `.env.test.local` as `TEST_API_KEY`).
- Organization-scoped keys need `--brand <brandId>` / `BREW_BRAND_ID` on
  brand-scoped commands (`brands list` shows ids).

## Connect your editor to the Brew MCP server

```bash
brew-cli mcp install                          # the clients this project uses (.cursor/, .vscode/, .claude/, .gemini/)
brew-cli mcp install --client cursor claude-code --dry-run --json
brew-cli mcp install --client codex --auth env   # header filled from BREW_API_KEY by the client
brew-cli mcp install --client vscode --print     # print the snippet, write nothing
```

It merges a `brew` entry into each client's config and keeps every other
server. `--auth oauth` (default) writes the URL only; `--auth env` adds an
`Authorization` header the client expands from `BREW_API_KEY` in its own
environment (`${env:…}` in Cursor, VS Code, Devin Desktop), never a
literal key. An existing `brew` entry with other settings, a config with
comments, or a symbolic link leaving the project comes back `manual` with
the snippet to paste. Devin Desktop (`--client windsurf`,
`~/.config/devin/mcp_config.json`) and Codex live in your home directory:
only written when named with `--client`. After a Codex OAuth entry, run
the result's `nextStep` (`codex mcp login brew`). Results: `created |
updated | unchanged | manual | printed`, plus one-click `deeplink`s for
Cursor and VS Code.

## App emails: send by key

An app email is a keyed trigger wired to a design and a published
automation. Code sends it with `brew.send(key, payload)` (SDK) or:

```bash
brew-cli app-emails kit --stack better-auth --yes   # auth + lifecycle starter kit; exit 1 = a key failed, re-run
brew-cli app-emails upsert order.paid --source-file emails/order-paid.tsx --yes   # one email from your own source
brew-cli app-emails list                             # sender (domain | sandbox | none) and readiness per key
brew-cli send auth.password-reset --to you@example.com --data '{"confirmationUrl":"https://…"}' --yes
brew-cli types --out lib/brew-contracts.ts           # payload types + the BrewTriggerKeyRegistry augmentation
```

Before a sending domain verifies, app emails use the team-only sandbox:
they reach members of the Brew organization only, under a daily cap
(`sender.mode: "sandbox"`). `send` is destructive (real email): it exits 4
without `--yes`. `upsert` and `kit` publish, so they confirm too;
`upsert --no-publish` saves without the gate. `upsert` and `kit` need a key
with the `automations` and `emails` scopes (403 otherwise).
`409 APP_EMAIL_EDITED_IN_BREW` means a teammate edited the design in Brew:
keep it, or pass `--overwrite`.
`automations triggers create --key <key>` gives any trigger a key.

## Moving from Resend

`brew-cli migrate resend` plans by default (writes `brew.migration.json`,
changes nothing); `--apply --yes` copies templates, React Email files,
contacts, segments, topics, suppressions and draft broadcasts, and
resumes when re-run. Pass the Resend key on stdin with
`--resend-key-stdin`; it never goes to Brew. The
`brew-migrate-from-resend` skill has the full mapping.

## The contract you can rely on

- Exit codes: 0 ok · 1 API error · 2 usage · 3 auth · 4 confirmation
  required · 130/143 interrupted by SIGINT/SIGTERM. Errors are JSON
  envelopes on stderr with stable `code`s and `requestId`.
- A write that ends `CLI_TIMEOUT`, `CLI_CONNECTION` or `CLI_INTERRUPTED`
  (or a 5xx) may still complete on the server. Re-run the envelope's
  `retryCommand` — it carries the same `--idempotency-key`, so the API
  replays the first attempt instead of running it twice. Never re-run the
  original command with a fresh key. A `409 IDEMPOTENCY_IN_PROGRESS` means
  the first attempt is still running: wait, then re-run `retryCommand`.
  While the API's idempotency store is degraded, writes other than sends
  run without the replay guarantee: for a write that must not happen
  twice, pass `--max-retries 0` and check whether it landed before re-running.
- `--timeout <duration>` bounds the whole command (body, retries, pages);
  use it to fit a tool-call budget. `--max-retries 0` for one attempt.
- Destructive commands (sends, deletes, fires, cancels) never hang: they
  exit 4 with a `confirmCommand` to re-run once a human approves, or take
  `--yes`. `confirmCommand` and `retryCommand` start the way you invoked
  the CLI (`brew-cli …`, or a package-runner prefix such as
  `npx -y @brew.new/cli@<version> …`), so run them as printed. Do not pass `--yes` for real campaign sends without an explicit
  human instruction; `emails send --test --to you@x.com` is the safe lane.
- `--input '<json>'` (or `-` for stdin) carries full request bodies;
  positional ids always win over `--input`. `--all` drains pagination.
  `--idempotency-key` makes POST retries safe (except `api-keys create`,
  whose route never replays).
- Every collection with ids to look up has a real detail read (`<group> get
  <id>`) returning the BARE row; list routes reject id filters
  (`notifications list` and `emails comments list` are list-only). Runs, sends, audience builds and
  inbox-placement tests share ONE status vocabulary: `queued | scheduled |
  running | paused | completed | partially_completed | failed | canceled`.

## Recipes

```bash
brew-cli docs --agent                  # machine-readable manifest of every command
brew-cli docs api                      # the live API catalog (/v1/help)
brew-cli contacts search --filter email:contains:@acme.com --json
brew-cli emails get <emailId> --include html,versions
brew-cli emails get <emailId> --email-version-id <id>   # a saved version (ids from --include versions)
brew-cli emails preview-clients <emailId>        # starts a rendering job (10 credits)
brew-cli emails get-client-preview <previewId>   # poll it; screenshots are previews[].imageUrl
brew-cli sends get <sendId> --include events
brew-cli insights list --severity critical       # what Brew Insights found; insights get <id> for one in full
brew-cli insights list --include pulse,report,suggestions,memo --json
brew-cli emails comments list <emailId> --include messages   # teammates' comment threads on a design
brew-cli emails comments list <emailId> --comment-id <cmt_…> --all --json   # one thread, every message
brew-cli chats list                              # recent Brew chats; chats get <chatId> to resume one
brew-cli notifications list --type email_send_failed   # what finished or failed (reading marks nothing read)
brew-cli domains health <domainId> --include scoreHistory,scoreRuns
brew-cli contacts get <email> --include openProfile     # smart-send open-time profile (needs the emails scope)
brew-cli content upload-image ./logo.png         # a local file into the brand library (free); prints its assetId
brew-cli brand delete-image <assetId> --yes      # remove one library image (destructive; its URL keeps working)
brew-cli api GET '/v1/sends?kind=campaign'   # raw escape hatch for anything else
```

To verify an API change you just made in the Brew repo: start the dev
server, point `BREW_API_URL` at it, and hit the changed route through the
dedicated command (or `brew-cli api`) — the CLI prints the exact envelope
your change produced.
