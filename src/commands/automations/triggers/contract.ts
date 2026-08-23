import type { components } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../../lib/input'
import { rawRequest } from '../../../lib/raw-request'

type ContractGetResponse = components['schemas']['PayloadContractGetResponse']
type ContractValidateResponse =
  components['schemas']['PayloadContractValidateResponse']

const FORMAT_FLAG = {
  flag: '--format <format>',
  summary:
    'Rendering: json (default, the contract object) or ts | zod | jsonschema | skill ({format, content})',
} as const

const FORMATS = new Set(['json', 'ts', 'zod', 'jsonschema', 'skill'])

const ENFORCEMENT_MODES = new Set(['strict', 'prune', 'passthrough'])

function formatQuery(value: unknown): string {
  const format = flagString(value)
  if (format === undefined) {
    return ''
  }
  if (!FORMATS.has(format)) {
    throw new CliUsageError(
      `Unknown --format '${format}' (expected json | ts | zod | jsonschema | skill).`
    )
  }
  return `?format=${format}`
}

/** Text formats print `content` raw on a TTY; `--json | jq -r .content` for pipes. */
function contentHuman(body: { content?: string }): { human?: string } {
  return typeof body.content === 'string' ? { human: body.content } : {}
}

export const automationsTriggersContractGetCommand = defineCommand({
  path: ['automations', 'triggers', 'contract', 'get'],
  summary:
    'Read a trigger payload contract: stored when declared, derived otherwise; --format renders ts/zod/jsonschema/skill',
  sdkMethod: null,
  isRawTransport: true,
  route: {
    method: 'GET',
    path: '/v1/automations/triggers/{triggerEventId}/contract',
  },
  commandClass: 'read',
  args: [
    {
      name: 'triggerEventId',
      summary: 'Trigger id (tri_…, or an integration composite id)',
      isRequired: true,
    },
  ],
  flags: [FORMAT_FLAG],
  examples: [
    'brew-cli automations triggers contract get tri_signup',
    'brew-cli automations triggers contract get tri_signup --format ts',
    'brew-cli automations triggers contract get tri_signup --format skill --json | jq -r .content',
  ],
  run: async ({ ctx, args, flags }) => {
    const body = await rawRequest<ContractGetResponse>(ctx, {
      method: 'GET',
      path: `/v1/automations/triggers/${encodeURIComponent(args.triggerEventId ?? '')}/contract${formatQuery(flags.format)}`,
    })
    return { data: body, ...contentHuman(body) }
  },
})

export const automationsTriggersContractPutCommand = defineCommand({
  path: ['automations', 'triggers', 'contract', 'put'],
  summary:
    'Declare (or replace) the stored payload contract for a trigger — tree-validated before any write; enforcement stays off',
  sdkMethod: null,
  isRawTransport: true,
  route: {
    method: 'PUT',
    path: '/v1/automations/triggers/{triggerEventId}/contract',
  },
  commandClass: 'write',
  args: [
    {
      name: 'triggerEventId',
      summary: 'Trigger id (tri_…)',
      isRequired: true,
    },
  ],
  flags: [
    INPUT_FLAG,
    {
      flag: '--enforce',
      summary:
        'Turn fire-time enforcement ON for this contract (fires are validated against it)',
    },
    {
      flag: '--no-enforce',
      summary: 'Turn fire-time enforcement OFF (contract stays advisory)',
    },
    {
      flag: '--enforcement <mode>',
      summary:
        'How enforcement treats undeclared keys: strict | prune (default) | passthrough',
    },
  ],
  examples: [
    `brew-cli automations triggers contract put tri_signup --input '{"fields":[{"key":"email","type":"string","required":true}],"mode":"declared"}'`,
  ],
  // Trigger contracts must keep a top-level required `email` string;
  // nested object/array fields need a Liquid-enabled workspace. The
  // response is the same body a follow-up `contract get` returns.
  run: async ({ ctx, args, flags }) => {
    const input = mergeInput(
      await readJsonFlag(ctx, flags.input, '--input'),
      {}
    )
    if (input.fields === undefined) {
      throw new CliUsageError(
        '--input with a fields array is required (the contract tree to store).'
      )
    }
    // `--enforce` / `--no-enforce` are the explicit opt-in; omitting both
    // leaves the stored state alone (new contracts start advisory).
    const enforcement = flagString(flags.enforcement)
    if (enforcement !== undefined && !ENFORCEMENT_MODES.has(enforcement)) {
      throw new CliUsageError(
        `Unknown --enforcement '${enforcement}' (expected strict | prune | passthrough).`
      )
    }
    if (flags.enforce === true && flags['no-enforce'] === true) {
      throw new CliUsageError(
        'Pass either --enforce or --no-enforce, not both.'
      )
    }
    const enforced =
      flags.enforce === true
        ? true
        : flags['no-enforce'] === true
          ? false
          : undefined
    const body = await rawRequest<ContractGetResponse>(ctx, {
      method: 'PUT',
      path: `/v1/automations/triggers/${encodeURIComponent(args.triggerEventId ?? '')}/contract`,
      body: {
        ...input,
        ...(enforced !== undefined ? { enforced } : {}),
        ...(enforcement !== undefined ? { enforcement } : {}),
      },
    })
    return { data: body }
  },
})

export const automationsTriggersContractValidateCommand = defineCommand({
  path: ['automations', 'triggers', 'contract', 'validate'],
  summary:
    "Dry-run a payload against a trigger's contract (the fire path's validator) — never fires; invalid payloads still exit 0",
  sdkMethod: null,
  isRawTransport: true,
  route: {
    method: 'POST',
    path: '/v1/automations/triggers/{triggerEventId}/contract/validate',
  },
  commandClass: 'read',
  args: [
    {
      name: 'triggerEventId',
      summary: 'Trigger id (tri_…)',
      isRequired: true,
    },
  ],
  flags: [
    INPUT_FLAG,
    {
      flag: '--enforcement <mode>',
      summary:
        'Preview a mode other than the stored one: strict | prune | passthrough',
    },
  ],
  examples: [
    `brew-cli automations triggers contract validate tri_signup --input '{"payload":{"email":"jane@example.com"}}'`,
  ],
  run: async ({ ctx, args, flags }) => {
    const input = mergeInput(
      await readJsonFlag(ctx, flags.input, '--input'),
      {}
    )
    const payload = input.payload ?? input
    const enforcement = flagString(flags.enforcement)
    const body = await rawRequest<ContractValidateResponse>(ctx, {
      method: 'POST',
      path: `/v1/automations/triggers/${encodeURIComponent(args.triggerEventId ?? '')}/contract/validate`,
      body: {
        payload,
        ...(enforcement !== undefined ? { enforcement } : {}),
      },
    })
    return { data: body }
  },
})
