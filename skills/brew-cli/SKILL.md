---
name: brew-cli
description: Drive the Brew email platform from the terminal with brew-cli — explore, check, test, and review contacts, emails, audiences, automations, domains, and analytics through typed commands over the public API. Use whenever a task touches Brew data or verifies Brew API behavior, especially against a local dev server.
---

# brew-cli for agents

One typed command per public-API operation (95 commands, generated docs in
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
  required. Errors are JSON envelopes on stderr with stable `code`s and
  `requestId`.
- Destructive commands (sends, deletes, fires, cancels) never hang: they
  exit 4 with a `confirmCommand` to re-run once a human approves, or take
  `--yes`. Do not pass `--yes` for real campaign sends without an explicit
  human instruction; `emails send --test --to you@x.com` is the safe lane.
- `--input '<json>'` (or `-` for stdin) carries full request bodies;
  positional ids always win over `--input`. `--all` drains pagination.
  `--idempotency-key` makes POST retries safe.

## Recipes

```bash
brew-cli docs --agent                  # machine-readable manifest of every command
brew-cli docs api                      # the live API catalog (/v1/help)
brew-cli contacts search --filter email:contains:@acme.com --json
brew-cli emails get <emailId> --include html,versions
brew-cli api GET '/v1/analytics/sends?sendId=<id>'   # raw escape hatch for anything else
```

To verify an API change you just made in the Brew repo: start the dev
server, point `BREW_API_URL` at it, and hit the changed route through the
dedicated command (or `brew-cli api`) — the CLI prints the exact envelope
your change produced.
