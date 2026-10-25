/** Types for `launcher.mjs`, for the repo's tests (not published). */
export declare function hasSubcommand(args: readonly string[]): boolean
export declare function launcherArgv(
  args: readonly string[],
  options?: { readonly alwaysInit?: boolean }
): string[]
export declare function invokedAs(packageName: string, version: string): string
export declare function launch(input: {
  readonly packageName: 'brew.new' | 'create-brew'
  readonly version: string
  readonly argv?: string[]
  readonly env?: Record<string, string | undefined>
  readonly importCli?: () => Promise<unknown>
}): Promise<void>
