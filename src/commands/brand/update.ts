import type { UpdateBrandInput } from '@brew.new/sdk'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../lib/input'

export const brandUpdateCommand = defineCommand({
  path: ['brand', 'update'],
  summary: 'Update brand identity and/or design-system markdown (PATCH)',
  sdkMethod: 'brand.patch',
  route: { method: 'PATCH', path: '/v1/brand' },
  commandClass: 'write',
  flags: [INPUT_FLAG],
  examples: [
    `brew-cli brand update --input '{"identity":{"tagline":"Brew better email"}}'`,
    'cat brand-patch.json | brew-cli brand update --input -',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const input = mergeInput(base, {})
    if (Object.keys(input).length === 0) {
      throw new CliUsageError(
        '--input is required — at least one of identity, emailDesign, imageStyle.'
      )
    }
    const result = await ctx
      .client()
      .brand.patch(asSdkInput<UpdateBrandInput>(input))
    return { data: result }
  },
})
