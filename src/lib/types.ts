import type { BrewClient } from './client'
import type { CommandMetadata } from './define-command'
import type { Budget, TransportState } from './transport'
import type { TextKind } from './utf8'

export type CliIo = {
  readonly stdout: NodeJS.WritableStream
  readonly stderr: NodeJS.WritableStream
  readonly isTtyOut: boolean
  readonly isTtyIn: boolean
  readonly env: Readonly<Record<string, string | undefined>>
  readonly readStdin: (signal?: AbortSignal, kind?: TextKind) => Promise<string>
  readonly readLine: (prompt: string) => Promise<string>
  readonly signal?: AbortSignal
}

export type OutputMode = 'human' | 'json'

export type GlobalFlags = {
  readonly json: boolean
  readonly quiet: boolean
  readonly yes: boolean
  readonly apiKey: string | undefined
  readonly brand: string | undefined
  readonly apiUrl: string | undefined
  readonly timeoutMs: number | undefined
  readonly maxRetries: number | undefined
}

export type CommandTraits = {
  readonly isRead: boolean
  readonly replays: boolean
  readonly declaresOperation: boolean
  readonly defaultTimeoutMs: number | undefined
  readonly inputKeys?: ReadonlySet<string> | undefined
}

export type ClientOptions = {
  readonly allowAnonymous?: boolean
}

export type CliContext = {
  readonly commands: readonly CommandMetadata[]
  readonly io: CliIo
  readonly mode: OutputMode
  readonly globals: GlobalFlags
  readonly client: (options?: ClientOptions) => BrewClient
  readonly rawArgv: readonly string[]
  readonly signal: AbortSignal
  readonly budget: Budget
  readonly transport: TransportState
  readonly traits: CommandTraits | undefined
  readonly startDeadline: () => void
  readonly pauseDeadline: () => () => void
  readonly stopDeadline: () => void
}
