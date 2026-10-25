import { CLI_NAME } from '../version'

/** The command prefix printed when nothing says otherwise. */
export const DEFAULT_INVOCATION_PREFIX = CLI_NAME

/**
 * Package runners a launcher may name, as shell words. Each is followed by
 * exactly one package spec; npm's own runners may end with `--`, which npm
 * needs to pass the CLI's flags through.
 */
const LAUNCHERS: ReadonlyArray<{
  readonly words: readonly string[]
  readonly allowsSeparator: boolean
}> = [
  { words: ['npx'], allowsSeparator: false },
  { words: ['npx', '-y'], allowsSeparator: false },
  { words: ['npx', '--yes'], allowsSeparator: false },
  { words: ['pnpm', 'dlx'], allowsSeparator: false },
  { words: ['bunx'], allowsSeparator: false },
  { words: ['yarn', 'dlx'], allowsSeparator: false },
  { words: ['npm', 'exec'], allowsSeparator: true },
  { words: ['npm', 'create'], allowsSeparator: true },
]

/**
 * An npm package spec: `name` or `@scope/name`, with an optional
 * `@version` / `@tag` (`brew.new@0.18.0`, `@brew.new/cli@latest`).
 */
const PACKAGE_SPEC =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:@[A-Za-z0-9][A-Za-z0-9._+-]*)?$/
const MAX_PREFIX_LENGTH = 200

/**
 * How the user (or agent) invoked this CLI, for every command line the CLI
 * prints for them to run next: `confirmCommand`, `retryCommand`, "run
 * `… login`" hints. A launcher package (`npx -y brew.new@0.18.0 …`) sets
 * `BREW_CLI_INVOKED_AS` so those lines re-run through the same launcher
 * instead of naming a `brew-cli` binary that is not on the PATH.
 *
 * Only a known package runner followed by one package spec (or `brew-cli`
 * itself) is accepted; anything else falls back to `brew-cli`. The prefix
 * is printed into commands agents execute, so it must never smuggle shell
 * syntax or a different program.
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
  if (prefix.length > MAX_PREFIX_LENGTH || !isKnownLauncher(words)) {
    return DEFAULT_INVOCATION_PREFIX
  }
  return prefix
}

function isKnownLauncher(words: readonly string[]): boolean {
  if (words.length === 1 && words[0] === CLI_NAME) {
    return true
  }
  return LAUNCHERS.some(({ words: runner, allowsSeparator }) => {
    if (!runner.every((word, index) => words[index] === word)) {
      return false
    }
    const rest = words.slice(runner.length)
    const [spec, separator, ...extra] = rest
    return (
      spec !== undefined &&
      PACKAGE_SPEC.test(spec) &&
      extra.length === 0 &&
      (separator === undefined || (allowsSeparator && separator === '--'))
    )
  })
}
