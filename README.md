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
brew-cli login                       # paste an API key from https://brew.new/settings/api
brew-cli doctor                      # trust check: auth, reachability, CLI-vs-API drift (exit-code gated)
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
  prompt. Test sends (`emails send --test`) skip the gate. Printed
  commands (`confirmCommand`, `retryCommand`, "run … login") start the
  way the CLI was invoked: a launcher such as `npx -y brew.new@<version>`
  sets `BREW_CLI_INVOKED_AS`, so they re-run through it.
- **Saved email recovery** — `409 EMAIL_RESULT_UNAVAILABLE` means the
  generation or edit committed. Do not repeat the write. Read the exact
  saved result using `error.details.emailId` and `emailVersionId`:
  `brew-cli emails get <emailId> --email-version-id <emailVersionId> --include html`.
  The error preserves these identifiers and the API's recovery guidance.
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

Filtered list pages can be empty while more pages remain. Follow their cursor
or use `--all`. When `--all` receives a repeated or cyclic cursor, it exits with code 1 and
`CLI_PAGINATION` on stderr. It emits no truncated success payload. Error details
include the fetched page and item counts; a cyclic cursor is not offered as a
resume point. This also covers resumed lists and a comment thread's older
message slices. Empty pages with an advancing cursor continue normally.

## Command reference

The full generated reference lives in
[`docs/commands/README.md`](./docs/commands/README.md). Resource groups:
`contacts`, `fields`, `emails` (+ `groups`, `comments`), `sends`,
`audiences`, `automations` (+ `triggers`, `runs`, `audience-runs`,
`trigger-instances`), `analytics`, `insights`, `brand`, `brands`, `content`,
`templates`, `flows`, `chats`, `notifications`, `mcp`, plus
`canvas sessions` and `login`/`logout`/`whoami`/`config`/`usage`/`health`/`docs`/`api`.

For an embedded editor, create brands with an organization-scoped key,
poll `brands get <brandId>` until `ready: true`, then use `--brand <brandId>`
to generate or import emails and create scoped `canvas sessions` grants.
Keep API keys on the host's backend; pass only the scoped session credentials
to the browser. See the [white-label integration guide](https://docs.brew.new/sdks/typescript/white-label-email-editor)
for the complete SDK and host authorization flow. Imports accept HTML, MJML,
JSX, and saved EML messages; JSON output includes the import's `assetReport`
with asset counts and warnings.

`emails generate --lang <code>` names the language of the copy (ISO 639-1, or
`zh-Hans` / `zh-Hant`); omit it and Brew detects it. `emails edit <emailId>
--lang <code>` sets it without an AI run, and Brew keeps that value from then
on; `--clear-lang` clears it so Brew reads the language again. `emails get`
returns it as `lang`.

Every collection with ids to look up has a real detail read — `<group> get
<id>` returns the bare row, and an unknown id surfaces the API's own typed
`404`. `notifications list` and `emails comments list` are list-only (one
comment thread is `emails comments list <emailId> --comment-id <id>`).

## How this repo stays in sync with the API, MCP, and SDK

The app repo's Zod contracts generate the OpenAPI spec, which is mirrored
into this repo (`openapi/public-api-v1.yaml`) and the SDK byte for byte.
Two parity tests gate CI here:

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

Development and release checks use Bun 1.3.10, pinned in every workflow.
Command metadata is supplied by CLI composition to `docs` and `doctor`; these
handlers do not import the live registry.

## License

MIT
