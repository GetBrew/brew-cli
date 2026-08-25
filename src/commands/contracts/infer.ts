import type { components } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import { INPUT_FLAG, mergeInput, readJsonFlag } from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'

type ContractInferResponse =
  components['schemas']['PayloadContractInferResponse']

export const contractsInferCommand = defineCommand({
  path: ['contracts', 'infer'],
  summary:
    'Draft a payload contract from a real example payload — nothing is saved; PUT the draft on a trigger',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/payload-contracts/infer' },
  commandClass: 'read',
  flags: [INPUT_FLAG],
  examples: [
    `brew-cli contracts infer --input '{"email":"jane@example.com","order":{"total":9.5}}'`,
  ],
  // Accepts either the bare example object or `{ example: {...} }`.
  // Un-inferable spots (nulls, empty arrays) come back under `issues`.
  run: async ({ ctx, flags }) => {
    const input = mergeInput(
      await readJsonFlag(ctx, flags.input, '--input'),
      {}
    )
    const example = input.example ?? input
    if (
      typeof example !== 'object' ||
      example === null ||
      Array.isArray(example) ||
      Object.keys(example).length === 0
    ) {
      throw new CliUsageError(
        '--input with a non-empty example object is required (the JSON your system sends).'
      )
    }
    const body = await rawRequest<ContractInferResponse>(ctx, {
      method: 'POST',
      path: '/v1/payload-contracts/infer',
      body: { example },
    })
    return { data: body }
  },
})
