import { ALL_COMMANDS } from '../registry'
import { SDK_SKIP_LIST, SPEC_SKIP_LIST } from '../skip-list'
import { CLI_NAME, CLI_VERSION } from '../version'
import { GLOBAL_FLAGS } from './define-command'

/**
 * The machine-readable surface contract printed by `brew-cli docs --agent`.
 * Additive-only: tests snapshot this shape, so removals or renames are
 * breaking changes by construction.
 */
export function buildManifest(): Record<string, unknown> {
  return {
    name: CLI_NAME,
    version: CLI_VERSION,
    baseUrlDefault: 'https://brew.new/api',
    env: {
      BREW_API_KEY: 'API key (overrides stored login; flags override both)',
      BREW_BRAND_ID: 'Brand id for organization-scoped keys',
      BREW_API_URL: 'API base URL',
      BREW_CLI_CONFIG_DIR: 'Config directory (default ~/.config/brew-cli)',
    },
    exitCodes: {
      '0': 'success',
      '1': 'API or runtime error',
      '2': 'usage error',
      '3': 'authentication error',
      '4': 'confirmation required (re-run with --yes)',
    },
    confirmationProtocol: {
      exitCode: 4,
      envelope: [
        'confirmationRequired',
        'command',
        'summary',
        'confirmCommand',
      ],
      override: '--yes',
    },
    globalFlags: GLOBAL_FLAGS.map((flag) => ({
      flag: flag.flag,
      summary: flag.summary,
    })),
    commands: ALL_COMMANDS.map((spec) => ({
      command: [CLI_NAME, ...spec.path].join(' '),
      summary: spec.summary,
      class: spec.commandClass,
      ...(spec.isCredited === true ? { credited: true } : {}),
      sdkMethod: spec.sdkMethod,
      ...(spec.isRawTransport === true ? { transport: 'raw' } : {}),
      ...(spec.derivedFrom === undefined
        ? {}
        : { derivedFrom: spec.derivedFrom }),
      ...(spec.route === undefined
        ? {}
        : { route: `${spec.route.method} ${spec.route.path}` }),
      args: (spec.args ?? []).map((arg) => ({
        name: arg.name,
        summary: arg.summary,
        required: arg.isRequired,
      })),
      flags: (spec.flags ?? []).map((flag) => ({
        flag: flag.flag,
        summary: flag.summary,
      })),
      confirmation: spec.confirmSummary !== undefined,
      examples: spec.examples,
    })),
    skips: {
      sdk: SDK_SKIP_LIST,
      spec: SPEC_SKIP_LIST,
    },
  }
}
