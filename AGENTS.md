# brew-cli — Agent Guidelines

Conventions for any agent (human or AI) working in `@brew.new/cli`, the
official agent-first CLI for the Brew public API. The CLI is a thin shell
over [`@brew.new/sdk`](https://github.com/GetBrew/typescript-sdk); the API
contract (Zod → OpenAPI in the `brew-v2` app repo) is the source of truth,
the SDK carries transport + types, and this repo owns the command surface.

## Architecture in one paragraph

`src/registry.ts` lists every `CommandSpec` (one file per command under
`src/commands/`). `src/cli.ts` mounts them into commander with global
flags, the confirmation gate, and the output/error contracts applied by
construction. `src/lib/` holds the shared behavior: `client.ts` (SDK
client factory + auth resolution + the temporary X-Brand-Id fetch bridge),
`output.ts` (stdout=data, stderr=progress, `--json` + auto-JSON on
non-TTY), `errors.ts` (exit codes 0/1/2/3/4 + envelopes), `confirm.ts`
(exit-4 protocol), `input.ts` (`--input <json|->`, `--file <path|->`,
`k=v`, the single `asSdkInput` boundary cast), `paginate.ts` (`--all`),
`manifest.ts` (`docs --agent`).

## The parity system (how this repo stays in lockstep with API + MCP + SDK)

- `tests/parity-sdk.test.ts` walks the installed SDK client surface. Every
  method must map to exactly one command, an entry in `src/skip-list.ts`
  (`SDK_SKIP_LIST`, reviewed reasons), or the shrinking in-test
  `PENDING_BUILD` list.
- `tests/parity-spec.test.ts` walks `openapi/public-api-v1.yaml` (a
  vendored mirror generated from the app repo's Zod contracts — NEVER
  hand-edit). Every operation must map to a command's declared `route`,
  a `SPEC_SKIP_LIST` entry (SDK release gaps), or the shrinking pending
  list. Phantom routes and stale skips fail.
- **When `bun update @brew.new/sdk` lands a new SDK version, parity fails
  until each new method gets a command or a reviewed skip. That failure is
  the system working — never silence it, close it.**

## Adding a command

1. One file: `src/commands/<resource>/<verb>.ts` exporting a
   `defineCommand({...})`. Copy the closest exemplar
   (`src/commands/contacts/search.ts` for reads, `upsert.ts` for writes,
   `delete.ts` for destructive).
2. Required: `path`, `summary`, `sdkMethod` (dotted SDK path, or null +
   `derivedFrom`), `route` (exact OpenAPI path with `{braces}`),
   `commandClass`, ≥1 realistic example. `destructive` ⇔ `confirmSummary`.
3. Ergonomic flags for scalars; `INPUT_FLAG` for deep JSON;
   `IDEMPOTENCY_FLAG` on POST mutations; reuse
   `ALL_FLAG`/`LIMIT_FLAG`/`CURSOR_FLAG` for pagination.
4. Import SDK input types (`import type { X } from '@brew.new/sdk'`; the
   `Parameters<Resource['method']>[0]` fallback when unexported). The one
   allowed cast is `asSdkInput<T>` at the SDK call.
5. Wire it into `src/registry.ts`; remove the method/route from the
   pending lists in both parity tests.
6. MSW test in `tests/commands/` (TDD: red → green) asserting
   method+path+body and, for destructive commands, the exit-4 envelope.
7. `bun run docs:commands` to refresh the generated reference.

## Validation (all must pass before handing work back)

```bash
bun install          # only when deps changed
bun run tsc          # strict typecheck
bun run lint         # biome check (also formatting)
bun run test         # vitest + MSW, includes both parity suites
bun run docs:commands:check
```

`bun run fix` applies formatting + safe lint fixes. Never `bun test`
(Bun's own runner bypasses the vitest/MSW setup) — always `bun run test`.

## Hard rules

- stdout carries ONLY the command's data payload; everything else goes to
  stderr. JSON mode prints API envelopes verbatim.
- Exit codes are API surface: 0 ok, 1 API/runtime, 2 usage, 3 auth,
  4 confirmation-required. Never repurpose them.
- Flags and command names are additive-only after release — renames and
  removals are breaking changes.
- Never hit the real Brew API from tests; MSW only. Never commit API keys.
- No new runtime dependencies without strong justification — the CLI ships
  with exactly `@brew.new/sdk` + `commander`.
- `openapi/public-api-v1.yaml` and `docs/commands/README.md` are
  generated — regenerate, never hand-edit.

## Releasing

See [`RELEASING.md`](./RELEASING.md) — tag-driven npm publish with
provenance, compiled binaries on the GitHub Release, Homebrew tap bump.
