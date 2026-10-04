---
name: brew-cli
description: Drive the Brew email platform from the terminal with brew-cli — explore, check, test, and review contacts, emails, audiences, automations, domains, and analytics through typed commands over the public API. Use whenever a task touches Brew data or verifies Brew API behavior, especially against a local dev server.
---

# brew-cli for agents

One typed command per public-API operation (144 commands, generated docs in
`docs/commands/README.md`). JSON output is automatic when stdout is piped.

## Start every session with the trust check

```bash
brew-cli doctor
```

Exit 0 = API reachable, auth valid, and this CLI covers every live
operation. Exit 1 = read the report: `DRIFT` lines list live operations
this build lacks (update the CLI); auth/reachability failures name the fix.

## Auth and targeting

- `BREW_API_KEY` env var (or `brew-cli login` once, or `--api-key`).
- Default target is production. For a local dev server:
  `BREW_API_URL=http://localhost:3000/api` (Brew repo dev keys live in
  `.env.test.local` as `TEST_API_KEY`).
- Organization-scoped keys need `--brand <brandId>` / `BREW_BRAND_ID` on
  brand-scoped commands (`brands list` shows ids).

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
  `--yes`. Do not pass `--yes` for real campaign sends without an explicit
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
