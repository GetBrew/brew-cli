import type { CliContext } from './types'

export type HttpMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST'

/**
 * read        — no writes; always safe.
 * write       — mutates state but is safe to retry / reversible in-app.
 * destructive — irreversible or outward-facing (sends, deletes); runs the
 *               confirmation protocol and must declare `confirmSummary`.
 */
export type CommandClass = 'destructive' | 'read' | 'write'

export type ArgSpec = {
  /** camelCase name, also the key in `invocation.args`. */
  readonly name: string
  readonly summary: string
  readonly isRequired: boolean
}

export type FlagSpec = {
  /** commander syntax, e.g. `--limit <n>` or `--test`. */
  readonly flag: string
  readonly summary: string
  readonly defaultValue?: string | boolean
}

export type CommandInvocation = {
  readonly ctx: CliContext
  readonly args: Readonly<Record<string, string>>
  readonly flags: Readonly<Record<string, unknown>>
}

export type CommandOutcome = {
  /** The payload printed to stdout (verbatim in JSON mode). */
  readonly data: unknown
  /** Optional human rendering (tables, summaries) for TTY output. */
  readonly human?: string
}

export type CommandSpec = {
  /** Command path, e.g. ['automations', 'triggers', 'fire']. */
  readonly path: readonly string[]
  readonly summary: string
  /**
   * Dotted path of the SDK method this command binds (`contacts.upsert`),
   * or null for CLI-native commands. Derived sugar commands set null here
   * and name their backing method in `derivedFrom`.
   */
  readonly sdkMethod: string | null
  readonly derivedFrom?: string
  /** The public API operation behind this command — the spec join key. */
  readonly route?: {
    readonly method: HttpMethod
    readonly path: string
  }
  readonly commandClass: CommandClass
  /** True when the operation consumes Brew credits. */
  readonly isCredited?: boolean
  readonly args?: readonly ArgSpec[]
  readonly flags?: readonly FlagSpec[]
  /** At least one realistic invocation; shown in help and the manifest. */
  readonly examples: readonly string[]
  /**
   * Destructive commands describe what is about to happen. Returning
   * undefined skips the gate for the given invocation (e.g. a dry run).
   */
  readonly confirmSummary?: (
    invocation: Omit<CommandInvocation, 'ctx'>
  ) => string | undefined
  readonly run: (
    invocation: CommandInvocation
  ) => Promise<CommandOutcome | undefined>
}

/** Identity helper that pins the spec type at the definition site. */
export function defineCommand(spec: CommandSpec): CommandSpec {
  return spec
}

export const GLOBAL_FLAGS: readonly FlagSpec[] = [
  {
    flag: '--json',
    summary: 'JSON output (automatic when stdout is not a TTY)',
  },
  { flag: '--quiet', summary: 'Suppress progress messages on stderr' },
  {
    flag: '--yes',
    summary: 'Skip the confirmation gate on destructive commands',
  },
  {
    flag: '--api-key <key>',
    summary: 'Brew API key (else BREW_API_KEY, else stored login)',
  },
  {
    flag: '--brand <brandId>',
    summary: 'Brand id for organization-scoped keys (else BREW_BRAND_ID)',
  },
  {
    flag: '--api-url <url>',
    summary: 'API base URL (else BREW_API_URL, else https://brew.new/api)',
  },
]
