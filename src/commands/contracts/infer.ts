import type { InferPayloadContractInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  INPUT_FLAG,
  isInputEnvelope,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'

export const contractsInferCommand = defineCommand({
  path: ['contracts', 'infer'],
  summary:
    'Draft a payload contract from a real example payload — nothing is saved; PUT the draft on a trigger',
  sdkMethod: 'payloadContracts.infer',
  route: { method: 'POST', path: '/v1/payload-contracts/infer' },
  commandClass: 'read',
  flags: [
    {
      ...INPUT_FLAG,
      summary:
        'JSON example or {example, subjectKind?} request (or - for stdin); nest reserved-key data in example',
    },
  ],
  examples: [
    `brew-cli contracts infer --input '{"example":{"email":"jane@example.com"},"subjectKind":"trigger"}'`,
    `brew-cli contracts infer --input '{"email":"jane@example.com","order":{"total":9.5}}'`,
    `brew-cli contracts infer --input '{"example":{"example":{"label":"Demo"}}}'`,
  ],
  // Only canonical request keys identify an envelope; siblings stay in raw
  // data. Data containing only reserved keys needs an explicit outer example.
  run: async ({ ctx, flags }) => {
    const input = mergeInput(
      await readJsonFlag(ctx, flags.input, '--input'),
      {}
    )
    const isEnvelope = isInputEnvelope<InferPayloadContractInput>(
      input,
      'example',
      { example: true, subjectKind: true }
    )
    const example = isEnvelope ? input.example : input
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
    // `subjectKind` passes through unchecked: the API validates it.
    const body = await ctx.client().payloadContracts.infer(
      asSdkInput<InferPayloadContractInput>({
        example,
        ...(isEnvelope && input.subjectKind !== undefined
          ? { subjectKind: input.subjectKind }
          : {}),
      })
    )
    return { data: body }
  },
})
