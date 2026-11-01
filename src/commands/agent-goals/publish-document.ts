import type { operations } from '../../generated/openapi-types'
import { defineCommand } from '../../lib/define-command'
import { CliUsageError } from '../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
  readTextFlag,
} from '../../lib/input'
import { rawRequest } from '../../lib/raw-request'
import { GOAL_ID_ARG, goalPath } from './shared'

type Input =
  operations['publishAgentGoalDocument']['requestBody']['content']['application/json']
type Result =
  operations['publishAgentGoalDocument']['responses'][200]['content']['application/json']

function expectedRevisionFlag(value: unknown): number | undefined {
  if (value === undefined) return undefined
  const raw = flagString(value)
  const revision = Number(raw)
  if (!raw?.trim() || !Number.isSafeInteger(revision) || revision < 0) {
    throw new CliUsageError(
      '--expected-revision must be a nonnegative safe integer.'
    )
  }
  return revision
}

export const agentGoalsPublishDocumentCommand = defineCommand({
  path: ['agent-goals', 'publish-document'],
  summary: 'Publish a workspace document with an expected revision',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'POST', path: '/v1/agent-goals/{goalId}/documents' },
  commandClass: 'write',
  args: [GOAL_ID_ARG],
  flags: [
    { flag: '--path <path>', summary: 'Relative workspace document path' },
    {
      flag: '--expected-revision <revision>',
      summary: 'Current revision; 0 creates a document',
    },
    {
      flag: '--file <path|->',
      summary: 'UTF-8 document content from a file or stdin',
    },
    {
      flag: '--source <source>',
      summary: 'Source reference for this revision',
    },
    INPUT_FLAG,
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli agent-goals publish-document goal_123 --path plan.md --expected-revision 2 --file ./plan.md',
  ],
  run: async ({ ctx, args, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const content = await readTextFlag(ctx, flags.file, '--file')
    const input = asSdkInput<Input>(
      mergeInput(base, {
        path: flagString(flags.path),
        expectedRevision: expectedRevisionFlag(flags.expectedRevision),
        content,
        source: flagString(flags.source),
      })
    )
    return {
      data: await rawRequest<Result>(ctx, {
        method: 'POST',
        path: `${goalPath(args.goalId ?? '')}/documents`,
        body: input,
        idempotencyKey: flagString(flags.idempotencyKey),
      }),
    }
  },
})
