import { defineCommand } from '../../lib/define-command'

export const brandDeleteImageCommand = defineCommand({
  path: ['brand', 'delete-image'],
  summary:
    'Remove one image from the brand library by assetId (free, idempotent, not logos); its file stays hosted at its URL',
  sdkMethod: 'brand.deleteImage',
  route: { method: 'DELETE', path: '/v1/brand/images/{assetId}' },
  commandClass: 'destructive',
  args: [
    {
      name: 'assetId',
      summary:
        'The image to remove: its 8-character assetId from `brand get-images`',
      isRequired: true,
    },
  ],
  examples: ['brew-cli brand delete-image 5bc912f9 --yes'],
  confirmSummary: ({ args }) =>
    `Remove image ${args.assetId ?? ''} from the brand library and image search. Its file stays hosted at its URL, so emails already using it keep rendering. This cannot be undone.`,
  run: async ({ ctx, args }) => {
    const result = await ctx.client().brand.deleteImage(args.assetId ?? '')
    return {
      data: result,
      human: result.deleted
        ? `Deleted image ${result.assetId} from the brand library. Its file stays hosted at its URL.`
        : `Image ${result.assetId} is not in the brand library; nothing changed.`,
    }
  },
})
