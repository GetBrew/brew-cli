import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type ContractGetResponse = components['schemas']['PayloadContractGetResponse']
type ContractValidateResponse =
  components['schemas']['PayloadContractValidateResponse']

const FORMAT_FLAG = {
  flag: '--format <format>',
  summary:
    'Rendering: json (default, the contract object) or ts | zod | jsonschema | skill ({format, content})',
} as const

const FORMATS = new Set(['json', 'ts', 'zod', 'jsonschema', 'skill'])

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

export const transactionalContractGetCommand = defineCommand({
  path: ['transactional', 'contract', 'get'],
  summary:
    'Read a transactional payload contract: stored when declared, else derived from the pinned template; --format renders ts/zod/jsonschema/skill',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/transactional/{transactionId}/contract' },
  commandClass: 'read',
  args: [
    {
      name: 'transactionId',
      summary: 'Transactional email id (txn_…)',
      isRequired: true,
    },
  ],
  flags: [FORMAT_FLAG],
  examples: [
    'brew-cli transactional contract get txn_8fK2mQ4pLx',
    'brew-cli transactional contract get txn_8fK2mQ4pLx --format zod --json | jq -r .content',
  ],
  run: async ({ ctx, args, flags }) => {
    const body = await rawRequest<ContractGetResponse>(ctx, {
      method: 'GET',
      path: `/v1/transactional/${encodeURIComponent(args.transactionId ?? '')}/contract${formatQuery(flags.format)}`,
    })
    return {
      data: body,
      ...(typeof body.content === 'string' ? { human: body.content } : {}),
    }
  },
})

export const transactionalContractPutCommand = defineCommand({
  path: ['transactional', 'contract', 'put'],
  summary:
    'Declare (or replace) the stored payload contract for a transactional email — tree-validated before any write',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'PUT', path: '/v1/transactional/{transactionId}/contract' },
  commandClass: 'write',
  args: [
    {
      name: 'transactionId',
      summary: 'Transactional email id (txn_…)',
      isRequired: true,
    },
  ],
  flags: [INPUT_FLAG],
  examples: [
    `brew-cli transactional contract put txn_8fK2mQ4pLx --input '{"fields":[{"key":"total","type":"float","required":true}]}'`,
  ],
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
    const body = await rawRequest<ContractGetResponse>(ctx, {
      method: 'PUT',
      path: `/v1/transactional/${encodeURIComponent(args.transactionId ?? '')}/contract`,
      body: input,
    })
    return { data: body }
  },
})

export const transactionalContractValidateCommand = defineCommand({
  path: ['transactional', 'contract', 'validate'],
  summary:
    "Dry-run a send payload against a transactional email's contract — never sends; invalid payloads still exit 0",
  sdkMethod: null,
  isRawTransport: true,
  route: {
    method: 'POST',
    path: '/v1/transactional/{transactionId}/contract/validate',
  },
  commandClass: 'read',
  args: [
    {
      name: 'transactionId',
      summary: 'Transactional email id (txn_…)',
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
    `brew-cli transactional contract validate txn_8fK2mQ4pLx --input '{"payload":{"total":12.5}}'`,
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
      path: `/v1/transactional/${encodeURIComponent(args.transactionId ?? '')}/contract/validate`,
      body: {
        payload,
        ...(enforcement !== undefined ? { enforcement } : {}),
      },
    })
    return { data: body }
  },
})
