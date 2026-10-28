import type { BrewClient } from './client'
import type { CommandMetadata } from './define-command'
import type { Budget, TransportState } from './transport'

/**
 * The process boundary, injected so tests can run the whole CLI in-process
 * with captured streams and a synthetic environment.
 */
export type CliIo = {
  readonly stdout: NodeJS.WritableStream
  readonly stderr: NodeJS.WritableStream
  readonly isTtyOut: boolean
  readonly isTtyIn: boolean
  readonly env: Readonly<Record<string, string | undefined>>
  /** When supplied, the command signal closes input on interrupt or timeout. */
  readonly readStdin: (signal?: AbortSignal) => Promise<string>
  readonly readLine: (prompt: string) => Promise<string>
  /**
   * Aborts on SIGINT/SIGTERM with a `CliInterruptError` (see
   * `src/lib/interrupt.ts`). Absent in tests that do not exercise cancellation.
   */
  readonly signal?: AbortSignal
}

export type OutputMode = 'human' | 'json'

/** Global flags accepted by every command. */
export type GlobalFlags = {
  readonly json: boolean
  readonly quiet: boolean
  readonly yes: boolean
  readonly apiKey: string | undefined
  readonly brand: string | undefined
  readonly apiUrl: string | undefined
  /** `--timeout`: a whole-command deadline, in ms. */
  readonly timeoutMs: number | undefined
  /** `--max-retries`: retries after a transient failure. */
  readonly maxRetries: number | undefined
}

/** What the running command is, as far as deadlines and errors care. */
export type CommandTraits = {
  /** The command only reads (`commandClass: 'read'`). */
  readonly isRead: boolean
  /** The route replays a request that carries the same idempotency key. */
  readonly replays: boolean
  /**
   * The command names its own API operation (a route, an SDK method, or the
   * methods it fans out to), so a failure is described by its own class and
   * replay policy. Only a command with none — the `api` escape hatch —
   * borrows those of the route its request hit.
   */
  readonly declaresOperation: boolean
  /** A long-running command's own whole-command deadline. */
  readonly defaultTimeoutMs: number | undefined
  /**
   * The top-level `--input` keys the command sends; any other key is
   * refused. Undefined when the input is not checked.
   */
  readonly inputKeys?: ReadonlySet<string>
}

export type ClientOptions = {
  /** Fall back to an anonymous key for the unauthenticated endpoints. */
  readonly allowAnonymous?: boolean
}

export type CliContext = {
  readonly commands: readonly CommandMetadata[]
  readonly io: CliIo
  readonly mode: OutputMode
  readonly globals: GlobalFlags
  readonly client: (options?: ClientOptions) => BrewClient
  readonly rawArgv: readonly string[]
  /**
   * Aborts when the process is interrupted or the command's deadline
   * passes; its `reason` says which. Every SDK call and raw request
   * observes it.
   */
  readonly signal: AbortSignal
  readonly budget: Budget
  readonly transport: TransportState
  readonly traits: CommandTraits | undefined
  /** Start or resume the whole-command deadline; human prompts pause it. */
  readonly startDeadline: () => void
  /** Pause an active clock; the returned callback resumes its remaining budget. */
  readonly pauseDeadline: () => () => void
  readonly stopDeadline: () => void
}
