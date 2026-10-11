import { CLI_NAME } from '../version'

/** The command prefix printed when nothing says otherwise. */
export const DEFAULT_INVOCATION_PREFIX = CLI_NAME

/**
 * Shell words a launcher may name: a package spec with its version
 * (`brew.new@0.18.0`, `@brew.new/cli@0.18.0`), runner flags (`-y`), runner
 * names (`npx`, `pnpm dlx`, `bunx`). Each word must stay one shell word, so
 * the prefix can lead a copy-pasted command without quoting.
 */
const SAFE_WORD = /^[A-Za-z0-9@%+=:,./_-]+$/
const MAX_PREFIX_LENGTH = 200

/**
 * How the user (or agent) invoked this CLI, for every command line the CLI
 * prints for them to run next: `confirmCommand`, `retryCommand`, "run
 * `… login`" hints. A launcher package (`npx -y brew.new@0.18.0 …`) sets
 * `BREW_CLI_INVOKED_AS` so those lines re-run through the same launcher
 * instead of naming a `brew-cli` binary that is not on the PATH.
 *
 * Anything that is not a short run of plain shell words (whitespace inside a
 * word, quotes, `;`, `$`, a newline) falls back to `brew-cli`: the prefix is
 * printed into commands agents execute, so it must never smuggle shell
 * syntax.
 */
export function getInvocationPrefix(
  env: Readonly<Record<string, string | undefined>>
): string {
  const raw = env.BREW_CLI_INVOKED_AS
  if (raw === undefined) {
    return DEFAULT_INVOCATION_PREFIX
  }
  const words = raw.trim().split(/ +/)
  const prefix = words.join(' ')
  if (
    prefix === '' ||
    prefix.length > MAX_PREFIX_LENGTH ||
    !words.every((word) => SAFE_WORD.test(word))
  ) {
    return DEFAULT_INVOCATION_PREFIX
  }
  return prefix
}
