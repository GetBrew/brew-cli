// The `brew.new` and `create-brew` launchers: `npx brew.new init` and
// `npm create brew` run `@brew.new/cli` in this same process. Edit this file
// (packages/launchers/launcher.mjs), then run `bun run sync:launchers`,
// which copies it into each package.

/** Flags whose next token is their value, never a subcommand. */
const VALUE_FLAGS = new Set([
  '--api-key',
  '--brand',
  '--api-url',
  '--timeout',
  '--max-retries',
  '--app',
  '--domain',
  '--sets',
  '--stack',
  '--test-to',
  '--apply-patches',
  '--app-url',
])

const VERSION_FLAGS = new Set(['--version', '-V'])
const HELP_FLAGS = new Set(['--help', '-h'])

/** Whether the arguments name a subcommand (`send`, `init`, `login`, …). */
export function hasSubcommand(args) {
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (token === '--') {
      return index + 1 < args.length
    }
    if (!token.startsWith('-')) {
      return true
    }
    if (VALUE_FLAGS.has(token)) {
      index += 1
    }
  }
  return false
}

/**
 * The CLI arguments a launcher runs: `init` when none names a subcommand.
 * A bare `--version` reaches the CLI as is; so does a bare `--help` from
 * `brew.new` (the CLI's help), while `create-brew` shows init's.
 */
export function launcherArgv(args, options = {}) {
  if (hasSubcommand(args)) {
    return [...args]
  }
  if (args.some((token) => VERSION_FLAGS.has(token))) {
    return [...args]
  }
  const isBareHelp =
    args.length > 0 && args.every((token) => HELP_FLAGS.has(token))
  if (isBareHelp && options.alwaysInit !== true) {
    return [...args]
  }
  return ['init', ...args]
}

/**
 * How the person ran the launcher, as the CLI prints it in every command it
 * suggests next (`BREW_CLI_INVOKED_AS`): pinned to this launcher's version
 * for both (`npx -y brew.new@<version>`, `npm create brew@<version> --`), so
 * a resume or confirm command runs the same CLI that printed it.
 */
export function invokedAs(packageName, version) {
  return packageName === 'create-brew'
    ? `npm create brew@${version} --`
    : `npx -y ${packageName}@${version}`
}

/**
 * Rewrites `argv` in place (the CLI reads `process.argv` when it loads),
 * names the launcher in `BREW_CLI_INVOKED_AS` unless a caller already did,
 * then loads the CLI, which runs and sets the exit code.
 */
export async function launch(input) {
  const argv = input.argv ?? process.argv
  const env = input.env ?? process.env
  if (env.BREW_CLI_INVOKED_AS === undefined || env.BREW_CLI_INVOKED_AS === '') {
    env.BREW_CLI_INVOKED_AS = invokedAs(input.packageName, input.version)
  }
  const args = launcherArgv(argv.slice(2), {
    alwaysInit: input.packageName === 'create-brew',
  })
  argv.splice(2, argv.length - 2, ...args)
  const importCli =
    input.importCli ?? (() => import('@brew.new/cli/dist/bin.js'))
  await importCli()
}
