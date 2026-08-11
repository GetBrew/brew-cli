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
```

Every command supports `--json` (automatic when stdout is piped), prints
data on stdout and progress on stderr, and documents itself:

```bash
brew-cli emails send --help
```

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
  stderr with stable `code`s and the `x-request-id`.
- **Semantic exit codes** — `0` ok · `1` API/runtime · `2` usage ·
  `3` auth · `4` confirmation required.
- **Confirmation protocol** — irreversible commands (sends, deletes,
  trigger fires) never hang waiting for input: non-interactive callers
  get exit `4` plus a JSON envelope containing a ready-to-run
  `confirmCommand`; pass `--yes` to proceed. Humans on a TTY get a y/N
  prompt. Test sends (`emails send --test`) skip the gate.
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
`contacts`, `fields`, `emails`, `sends`, `audiences`, `automations`
(+ `triggers`, `runs`), `analytics`, `brand`, `content`, `templates`,
plus `login`/`logout`/`whoami`/`config`/`usage`/`health`/`docs`/`api`.

## How this repo stays in sync with the API, MCP, and SDK

The app repo's Zod contracts generate the OpenAPI spec, which is mirrored
byte-identically into this repo (`openapi/public-api-v1.yaml`) and the
SDK. Two parity tests gate CI here:

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
