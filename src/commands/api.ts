import { resolveAuth } from '../lib/client'
import { defineCommand } from '../lib/define-command'
import { CliUsageError } from '../lib/errors'
import { longRunningTimeoutMs } from '../lib/long-running'
import {
  buildRawHeaders,
  DEFAULT_ATTEMPT_TIMEOUT_MS,
  rawFetch,
  responseToApiError,
  tryParseJson,
} from '../lib/raw-request'

const METHODS = ['GET', 'POST', 'PATCH', 'DELETE'] as const

type ApiMethod = (typeof METHODS)[number]

/** Paths the API serves without authentication. */
const ANONYMOUS_PATHS = ['/v1/health', '/v1/help', '/v1/llms.txt'] as const

export const apiCommand = defineCommand({
  path: ['api'],
  summary: 'Raw authenticated request against the Brew public API',
  sdkMethod: null,
  commandClass: 'destructive',
  args: [
    {
      name: 'method',
      summary: 'GET | POST | PATCH | DELETE',
      isRequired: true,
    },
    {
      name: 'path',
      summary: 'API path, e.g. /v1/contacts/search',
      isRequired: true,
    },
  ],
  flags: [
    { flag: '--data <json>', summary: 'JSON request body, or - to read stdin' },
    {
      flag: '--header <headers...>',
      summary: 'Extra header(s) as "Name: value"',
    },
    {
      flag: '--idempotency-key <key>',
      summary:
        'Idempotency-Key header for safe POST retries (a POST gets one generated otherwise)',
    },
  ],
  examples: [
    'brew-cli api GET /v1/fields',
    `brew-cli api POST /v1/contacts/search --data '{"limit":5}' --yes`,
    'brew-cli api GET /v1/llms.txt',
  ],
  confirmSummary: ({ args }) => {
    const method = (args.method ?? '').toUpperCase()
    if (method === 'GET') {
      return
    }
    return `Send a raw ${method} request to ${args.path ?? ''}. The CLI cannot assess what this mutates.`
  },
  run: async ({ ctx, args, flags }) => {
    const method = parseMethod(args.method)
    const path = parsePath(args.path)
    const barePath = path.split('?')[0] ?? path
    const auth = resolveAuth({
      globals: ctx.globals,
      env: ctx.io.env,
      allowAnonymous: (ANONYMOUS_PATHS as readonly string[]).includes(barePath),
    })
    const body = await readBody(ctx, flags.data)
    if (method === 'GET' && body !== undefined) {
      throw new CliUsageError('GET requests cannot carry --data.')
    }
    // A POST always carries a key — the user's, or one generated for this
    // invocation — so a timed-out or interrupted POST can be replayed with
    // it (the envelope prints it) instead of run twice. A key passed with
    // --header wins; the one reported is whatever was actually sent.
    const headers = buildRawHeaders({
      auth,
      path,
      hasJsonBody: body !== undefined,
      idempotencyKey:
        typeof flags.idempotencyKey === 'string' && flags.idempotencyKey !== ''
          ? flags.idempotencyKey
          : method === 'POST'
            ? crypto.randomUUID()
            : undefined,
    })
    for (const header of readHeaderFlags(flags.header)) {
      const separator = header.indexOf(':')
      if (separator === -1) {
        throw new CliUsageError(
          `Invalid --header (expected "Name: value"): ${header}`
        )
      }
      headers.set(
        header.slice(0, separator).trim(),
        header.slice(separator + 1).trim()
      )
    }
    const { response, text } = await rawFetch(ctx, {
      method,
      url: `${auth.apiUrl}${path}`,
      headers,
      ...(body === undefined ? {} : { body }),
      // --timeout, else the SDK's own default for this route when it is a
      // long-running one (`api POST /v1/emails` waits as long as `emails
      // generate`), else the SDK's 30 s.
      timeoutMs:
        ctx.budget.attemptMs ??
        longRunningTimeoutMs({ method, path: barePath }) ??
        DEFAULT_ATTEMPT_TIMEOUT_MS,
    })
    const parsed = tryParseJson(text)
    if (!response.ok) {
      throw responseToApiError(response, parsed)
    }
    if (parsed !== undefined) {
      return { data: parsed }
    }
    return { data: text, human: text }
  },
})

function parseMethod(value: string | undefined): ApiMethod {
  const method = (value ?? '').toUpperCase()
  if ((METHODS as readonly string[]).includes(method)) {
    return method as ApiMethod
  }
  throw new CliUsageError(
    `Unsupported method "${value ?? ''}". Expected one of: ${METHODS.join(', ')}`
  )
}

function parsePath(value: string | undefined): string {
  if (value === undefined || !value.startsWith('/')) {
    throw new CliUsageError('Path must start with "/", e.g. /v1/fields')
  }
  return value
}

async function readBody(
  ctx: { readonly io: { readonly readStdin: () => Promise<string> } },
  data: unknown
): Promise<string | undefined> {
  if (typeof data !== 'string') {
    return
  }
  const raw = data === '-' ? await ctx.io.readStdin() : data
  try {
    JSON.parse(raw)
  } catch {
    throw new CliUsageError('--data must be valid JSON (or - to read stdin)')
  }
  return raw
}

function readHeaderFlags(value: unknown): readonly string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string')
  }
  return typeof value === 'string' ? [value] : []
}
