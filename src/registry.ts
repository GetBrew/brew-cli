import { apiCommand } from './commands/api'
import {
  configGetCommand,
  configListCommand,
  configSetCommand,
  configUnsetCommand,
} from './commands/config'
import { docsApiCommand, docsCommand } from './commands/docs'
import { healthCommand } from './commands/health'
import { loginCommand } from './commands/login'
import { logoutCommand } from './commands/logout'
import { usageCommand } from './commands/usage'
import { whoamiCommand } from './commands/whoami'
import type { CommandSpec } from './lib/define-command'

/**
 * Every command the CLI exposes, in help-display order. One entry per
 * command file; the parity tests hold this list to the SDK surface and
 * the vendored OpenAPI spec.
 */
export const ALL_COMMANDS: readonly CommandSpec[] = [
  loginCommand,
  logoutCommand,
  whoamiCommand,
  configListCommand,
  configGetCommand,
  configSetCommand,
  configUnsetCommand,
  healthCommand,
  usageCommand,
  docsCommand,
  docsApiCommand,
  apiCommand,
]
