import type {
  GetTriggerContractInput,
  PayloadContractGetResponse,
  PutTriggerContractInput,
  ValidateTriggerPayloadInput,
} from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  asSdkInput,
  flagString,
  INPUT_FLAG,
  isInputEnvelope,
  mergeInput,
  readJsonFlag,
} from '../../../lib/input'

const FORMAT_FLAG = {
  flag: '--format <format>',
  summary:
    'Rendering: json (default, the contract object) or ts | zod | jsonschema | skill ({format, content})',
} as const

const FORMATS = new Set(['json', 'ts', 'zod', 'jsonschema', 'skill'])

const ENFORCEMENT_MODES = new Set(['off', 'prune', 'strict'])

/**
 * The validate preview knob is the VALIDATOR's enum — it is only ever
 * consulted once a contract is enforcing, so `off` is not representable
 * (platform `ContractEnforcementMode`).
 */
const VALIDATE_ENFORCEMENT_MODES = new Set(['prune', 'strict'])

function formatOption(value: unknown): string | undefined {
  const format = flagString(value)
  if (format !== undefined && !FORMATS.has(format)) {
    throw new CliUsageError(
      `Unknown --format '${format}' (expected json | ts | zod | jsonschema | skill).`
    )
  }
  return format
}

/** Text formats print `content` raw on a TTY; `--json | jq -r .content` for pipes. */
function contentHuman(body: PayloadContractGetResponse): { human?: string } {
  return body.format !== 'json' && typeof body.content === 'string'
    ? { human: body.content }
    : {}
}

export const automationsTriggersContractGetCommand = defineCommand({
  path: ['automations', 'triggers', 'contract', 'get'],
  summary:
    'Read a trigger payload contract: stored when declared, derived otherwise; --format renders ts/zod/jsonschema/skill',
  sdkMethod: 'automations.triggers.getContract',
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
    const format = formatOption(flags.format)
    const body = await ctx.client().automations.triggers.getContract(
      asSdkInput<GetTriggerContractInput>({
        triggerEventId: args.triggerEventId ?? '',
        ...(format === undefined ? {} : { format }),
      })
    )
    return { data: body, ...contentHuman(body) }
  },
})

export const automationsTriggersContractPutCommand = defineCommand({
  path: ['automations', 'triggers', 'contract', 'put'],
  summary:
    'Declare (or replace) the stored payload contract for a trigger — tree-validated before any write; omitting --enforcement leaves the stored setting unchanged',
  sdkMethod: 'automations.triggers.putContract',
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
      flag: '--enforcement <mode>',
      summary:
        'off (advisory, the default) | prune (drop fields not on the list) | strict (reject a payload carrying them)',
    },
  ],
  examples: [
    `brew-cli automations triggers contract put tri_signup --input '{"fields":[{"key":"email","type":"string","required":true}]}'`,
    'brew-cli automations triggers contract put tri_signup --enforcement strict',
  ],
  // Trigger contracts must keep a top-level required `email` string;
  // nested object/array fields are supported. The
  // response is the same body a follow-up `contract get` returns.
  run: async ({ ctx, args, flags }) => {
    const input = mergeInput(
      await readJsonFlag(ctx, flags.input, '--input'),
      {}
    )
    // The platform PUT takes fields?, name?, enforcement? — each optional,
    // so an enforcement-only (or rename-only) patch is designed usage.
    if (input.fields !== undefined && !Array.isArray(input.fields)) {
      throw new CliUsageError(
        '--input .fields must be an array of contract field nodes.'
      )
    }
    // One knob. Omitting it leaves the stored setting alone.
    const enforcement = flagString(flags.enforcement)
    if (enforcement !== undefined && !ENFORCEMENT_MODES.has(enforcement)) {
      throw new CliUsageError(
        `Unknown --enforcement '${enforcement}' (expected off | prune | strict).`
      )
    }
    const requestBody = {
      ...input,
      ...(enforcement !== undefined ? { enforcement } : {}),
    }
    if (Object.keys(requestBody).length === 0) {
      throw new CliUsageError(
        'Empty contract body — pass --input (fields and/or name) or --enforcement <mode>.'
      )
    }
    // The trigger id is spread LAST: a `triggerEventId` inside --input must
    // not retarget the call at another trigger.
    const body = await ctx.client().automations.triggers.putContract(
      asSdkInput<PutTriggerContractInput>({
        ...requestBody,
        triggerEventId: args.triggerEventId ?? '',
      })
    )
    return { data: body }
  },
})

export const automationsTriggersContractValidateCommand = defineCommand({
  path: ['automations', 'triggers', 'contract', 'validate'],
  summary:
    "Dry-run a payload against a trigger's contract (the fire path's validator) — never fires; invalid payloads still exit 0",
  sdkMethod: 'automations.triggers.validatePayload',
  route: {
    method: 'POST',
    path: '/v1/automations/triggers/{triggerEventId}/contract/validate',
  },
  commandClass: 'read',
  // The input keys are the user's own data: a bare payload is shorthand for the { payload } envelope.
  inputKeys: 'unchecked',
  args: [
    {
      name: 'triggerEventId',
      summary: 'Trigger id (tri_…)',
      isRequired: true,
    },
  ],
  flags: [
    {
      ...INPUT_FLAG,
      summary:
        'JSON payload or {payload, enforcement?} request (or - for stdin); nest reserved-key data in payload',
    },
    {
      flag: '--enforcement <mode>',
      summary: 'Preview a mode other than the stored one: prune | strict',
    },
  ],
  examples: [
    `brew-cli automations triggers contract validate tri_signup --input '{"payload":{"email":"jane@example.com"}}'`,
    `brew-cli automations triggers contract validate tri_signup --input '{"payload":{"email":"jane@example.com"},"enforcement":"strict"}'`,
    `brew-cli automations triggers contract validate tri_signup --input '{"payload":{"payload":{"email":"jane@example.com"}}}'`,
  ],
  run: async ({ ctx, args, flags }) => {
    const input = mergeInput(
      await readJsonFlag(ctx, flags.input, '--input'),
      {}
    )
    const isEnvelope = isInputEnvelope<
      Omit<ValidateTriggerPayloadInput, 'triggerEventId'>
    >(input, 'payload', { payload: true, enforcement: true })
    const payload = isEnvelope ? input.payload : input
    const enforcementFlag = flagString(flags.enforcement)
    if (
      enforcementFlag !== undefined &&
      !VALIDATE_ENFORCEMENT_MODES.has(enforcementFlag)
    ) {
      throw new CliUsageError(
        `Unknown --enforcement '${enforcementFlag}' (expected prune | strict).`
      )
    }
    // Only canonical request keys identify an envelope. Explicit nesting
    // disambiguates raw data containing only payload/enforcement keys.
    const enforcement =
      enforcementFlag ?? (isEnvelope ? input.enforcement : undefined)
    const body = await ctx.client().automations.triggers.validatePayload(
      asSdkInput<ValidateTriggerPayloadInput>({
        triggerEventId: args.triggerEventId ?? '',
        payload,
        ...(enforcement !== undefined ? { enforcement } : {}),
      })
    )
    return { data: body }
  },
})
