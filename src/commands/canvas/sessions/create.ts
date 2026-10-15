import type { operations } from '../../../generated/openapi-types'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  asSdkInput,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../../lib/input'
import { rawRequest } from '../../../lib/raw-request'

type CreateInput =
  operations['createCanvasSession']['requestBody']['content']['application/json']
type Session =
  operations['createCanvasSession']['responses'][201]['content']['application/json']

export const canvasSessionsCreateCommand = defineCommand({
  path: ['canvas', 'sessions', 'create'],
  summary: 'Create an authenticated group or single-email canvas grant',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/canvas/sessions' },
  commandClass: 'write',
  flags: [
    { flag: '--group-id <id>', summary: 'Embed exactly this group' },
    { flag: '--email-id <id>', summary: 'Embed exactly this email' },
    {
      flag: '--parent-origin <origin>',
      summary: 'Exact HTTPS origin allowed to frame the canvas',
    },
    {
      flag: '--user-id <id>',
      summary: 'Authenticated user ID in your application',
    },
    { flag: '--user-name <name>', summary: 'Collaborator display name' },
    {
      flag: '--read-only',
      summary: 'Allow reading only (default: read, edit, presence)',
    },
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli canvas sessions create --group-id grp_example --parent-origin https://your-app.example --user-id user_example --user-name Alice',
    'brew-cli canvas sessions create --input -',
  ],
  run: async ({ ctx, flags }) => {
    const groupId = flagString(flags.groupId)
    const emailId = flagString(flags.emailId)
    if (groupId !== undefined && emailId !== undefined) {
      throw new CliUsageError('Pass either --group-id or --email-id.')
    }
    const externalId = flagString(flags.userId)
    const name = flagString(flags.userName)
    const base = mergeInput(await readJsonFlag(ctx, flags.input, '--input'), {})
    const input = mergeInput(base, {
      target:
        groupId !== undefined
          ? { type: 'group', groupId }
          : emailId !== undefined
            ? { type: 'email', emailId }
            : undefined,
      parentOrigin: flagString(flags.parentOrigin),
      user:
        externalId !== undefined || name !== undefined
          ? mergeInput(base.user, { externalId, name })
          : undefined,
      permissions: flags.readOnly === true ? ['read'] : undefined,
    })
    if (input.permissions === undefined)
      input.permissions = ['read', 'edit', 'presence']
    const result = await rawRequest<Session>(ctx, {
      method: 'POST',
      path: '/v1/canvas/sessions',
      body: asSdkInput<CreateInput>(input),
      idempotency: 'none',
    })
    return { data: result }
  },
})
