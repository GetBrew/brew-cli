import { defineCommand } from '../../lib/define-command'

export const emailsGetClientPreviewCommand = defineCommand({
  path: ['emails', 'get-client-preview'],
  summary:
    'Poll a client-preview rendering job: per-client screenshot links once it settles (free; never re-renders)',
  sdkMethod: 'emails.getClientPreview',
  route: { method: 'GET', path: '/v1/emails/client-previews/{previewId}' },
  commandClass: 'read',
  args: [
    {
      name: 'previewId',
      summary: 'The previewId `emails preview-clients` returned',
      isRequired: true,
    },
  ],
  examples: [
    'brew-cli emails get-client-preview prv_0b7f3c1e-9a2d-4e8b-b6c5-3d1f2a9e8c47',
    "brew-cli emails get-client-preview prv_0b7f3c1e-9a2d-4e8b-b6c5-3d1f2a9e8c47 --json | jq '.previews[] | {label, status, imageUrl}'",
  ],
  run: async ({ ctx, args }) => {
    const body = await ctx
      .client()
      .emails.getClientPreview(args.previewId ?? '')
    return { data: body }
  },
})
