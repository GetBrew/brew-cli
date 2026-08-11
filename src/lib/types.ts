import type { BrewClient } from './client'

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
  readonly readStdin: () => Promise<string>
  readonly readLine: (prompt: string) => Promise<string>
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
}

export type ClientOptions = {
  /** Fall back to an anonymous key for the unauthenticated endpoints. */
  readonly allowAnonymous?: boolean
}

export type CliContext = {
  readonly io: CliIo
  readonly mode: OutputMode
  readonly globals: GlobalFlags
  readonly client: (options?: ClientOptions) => BrewClient
  readonly rawArgv: readonly string[]
}
