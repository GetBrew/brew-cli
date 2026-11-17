import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { buildProgram } from '../../src/cli'
import { apiCommand } from '../../src/commands/api'
import { emailsCloneCommand } from '../../src/commands/emails/clone'
import { emailsDeleteCommand } from '../../src/commands/emails/delete'
import { buildConfirmCommand, buildRetryCommand } from '../../src/lib/confirm'
import { CliInterruptError } from '../../src/lib/errors'
import type { RerunInvocation } from '../../src/lib/rerun'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

const API = 'https://brew.new/api/v1'
const KEY = 'brew_abcdefghijklmnopqrstuvwxyz012345'

function env(): Record<string, string> {
  return {
    BREW_CLI_CONFIG_DIR: mkdtempSync(join(tmpdir(), 'brew-cli-test-')),
    BREW_API_KEY: KEY,
  }
}

/** Exercise the shell quoting users rely on when running an envelope verbatim. */
function argvOf(command: string): string[] {
  const argv = execFileSync(
    'sh',
    ['-c', `set -- ${command}; printf '%s\\0' "$@"`],
    { encoding: 'utf8' }
  )
    .split('\0')
    .slice(0, -1)
  expect(argv.shift()).toBe('brew-cli')
  return argv
}

/** Capture Commander's real merged invocation before any command handler runs. */
async function invocationOf(argv: readonly string[]): Promise<RerunInvocation> {
  const captured = new Error('invocation captured')
  let invocation: RerunInvocation | undefined
  const program = buildProgram(
    {
      stdout: new PassThrough(),
      stderr: new PassThrough(),
      isTtyOut: false,
      isTtyIn: false,
      env: env(),
      readStdin: async () => '',
      readLine: async () => '',
    },
    argv,
    (_ctx, _spec, parsed) => {
      invocation = parsed
      throw captured
    }
  )
  try {
    await program.parseAsync([...argv], { from: 'user' })
  } catch (error) {
    if (error !== captured) {
      throw error
    }
  }
  if (invocation === undefined) {
    throw new Error('No command invocation was captured.')
  }
  return invocation
}

describe('replayable command envelopes', () => {
  it('asks for JSX stdin again when an audit is interrupted', async () => {
    const controller = new AbortController()
    server.use(
      http.post(`${API}/emails/audit`, () => {
        controller.abort(new CliInterruptError('SIGINT'))
        return new Promise<Response>(() => undefined)
      })
    )
    const result = await runCli(['emails', 'audit', '--jsx-file', '-'], {
      env: env(),
      stdin: 'export default () => <div>Hello</div>',
      signal: controller.signal,
    })
    expect(result.code).toBe(130)
    const envelope = JSON.parse(
      result.stderr.trim().split('\n').at(-1) ?? ''
    ) as {
      error: { retryCommand: string; suggestion: string }
    }
    expect(envelope.error.suggestion).toContain(
      'pipe the same input to it again'
    )
    expect(argvOf(envelope.error.retryCommand)).toContain('--jsx-file=-')
  })

  it('does not request stdin for an operand that resembles an input flag', async () => {
    const controller = new AbortController()
    server.use(
      http.post(`${API}/emails/:emailId/clone`, ({ params }) => {
        expect(params.emailId).toBe('--input=-')
        controller.abort(new CliInterruptError('SIGINT'))
        return new Promise<Response>(() => undefined)
      })
    )
    const result = await runCli(['emails', 'clone', '--', '--input=-'], {
      env: env(),
      signal: controller.signal,
    })
    expect(result.code).toBe(130)
    const envelope = JSON.parse(
      result.stderr.trim().split('\n').at(-1) ?? ''
    ) as {
      error: { suggestion: string }
    }
    expect(envelope.error.suggestion).not.toContain('pipe the same input')
  })

  it('preserves a variadic header boundary when a later credential header is removed', async () => {
    let requests = 0
    server.use(
      http.delete(`${API}/emails/eml_1`, ({ request }) => {
        requests += 1
        expect(request.headers.get('x-trace')).toBe('trace')
        return HttpResponse.json({ deleted: true })
      })
    )
    const environment = env()
    const initial = await runCli(
      [
        'api',
        'DELETE',
        '--header',
        'Authorization:secret',
        'X-Trace:trace',
        '--header=Authorization:secret',
        '/v1/emails/eml_1',
      ],
      { env: environment }
    )
    expect(initial.code).toBe(4)
    expect(requests).toBe(0)
    const command = (initial.json as { confirmCommand: string }).confirmCommand
    expect(command).not.toContain('secret')
    const confirmed = await runCli(argvOf(command), { env: environment })
    expect(confirmed.code).toBe(0)
    expect(requests).toBe(1)
  })

  it('preserves a recipient boundary when the retry key moves past a positional id', async () => {
    const controller = new AbortController()
    const requests: Array<{ body: unknown; key: string | null }> = []
    server.use(
      http.post(`${API}/sends`, async ({ request }) => {
        requests.push({
          body: await request.json(),
          key: request.headers.get('idempotency-key'),
        })
        if (requests.length === 1) {
          controller.abort(new CliInterruptError('SIGINT'))
          return new Promise<Response>(() => undefined)
        }
        return HttpResponse.json({ status: 'sent' })
      })
    )
    const environment = env()
    const initial = await runCli(
      [
        'emails',
        'send',
        '--test',
        '--to',
        'a@example.com',
        'b@example.com',
        '--idempotency-key',
        'old-key',
        'eml_1',
        '--subject',
        'hi',
      ],
      { env: environment, signal: controller.signal }
    )
    expect(initial.code).toBe(130)
    const envelope = JSON.parse(
      initial.stderr.trim().split('\n').at(-1) ?? ''
    ) as {
      error: { retryCommand: string }
    }
    const retried = await runCli(argvOf(envelope.error.retryCommand), {
      env: environment,
    })
    expect(retried.code).toBe(0)
    expect(requests).toHaveLength(2)
    expect(requests[0]).toEqual({
      body: {
        emailId: 'eml_1',
        test: true,
        to: ['a@example.com', 'b@example.com'],
        subject: 'hi',
      },
      key: 'old-key',
    })
    expect(requests[1]).toEqual(requests[0])
  })

  it('redacts an equals-form credential header without consuming the API arguments', async () => {
    let requests = 0
    server.use(
      http.delete(`${API}/emails/eml_1`, () => {
        requests += 1
        return HttpResponse.json({ deleted: true })
      })
    )
    const environment = env()
    const initial = await runCli(
      ['api', '--header=Authorization:secret', 'DELETE', '/v1/emails/eml_1'],
      { env: environment }
    )
    expect(initial.code).toBe(4)
    expect(requests).toBe(0)
    const command = (initial.json as { confirmCommand: string }).confirmCommand
    expect(command).not.toContain('secret')
    const confirmed = await runCli(argvOf(command), { env: environment })
    expect(confirmed.code).toBe(0)
    expect(requests).toBe(1)
  })

  it.each([
    ['emails', 'delete', '--', '-id'],
    ['--', 'emails', 'delete', '-id'],
    ['emails', '--', 'delete', '-id'],
    ['emails', 'delete', '-1', '--'],
  ])('confirms a dash-prefixed id with argv %j', async (...argv) => {
    let requests = 0
    server.use(
      http.delete(`${API}/emails/${argv.includes('-1') ? '-1' : '-id'}`, () => {
        requests += 1
        return HttpResponse.json({ deleted: true })
      })
    )
    const environment = env()
    const initial = await runCli(argv, { env: environment })
    expect(initial.code).toBe(4)
    expect(requests).toBe(0)
    const command = (initial.json as { confirmCommand: string }).confirmCommand
    const confirmed = await runCli(argvOf(command), { env: environment })
    expect(confirmed.code).toBe(0)
    expect(requests).toBe(1)
  })

  it.each([
    [
      '--json',
      'emails',
      '--brand',
      'brand_1',
      'clone',
      '--title',
      "Operator's clone",
      '--',
      '-id',
    ],
    ['emails', 'clone', '--title', '--', '--', '-id'],
    ['--', 'emails', 'clone', '-id'],
    ['emails', 'clone', '--idempotency-key=--api-key', '--', '-id'],
    ['emails', 'clone', '-1', '--'],
  ])('retries the same request and key with argv %j', async (...argv) => {
    const controller = new AbortController()
    const requests: Array<{ body: unknown; key: string | null }> = []
    server.use(
      http.post(
        `${API}/emails/${argv.includes('-1') ? '-1' : '-id'}/clone`,
        async ({ request }) => {
          requests.push({
            body: await request.json(),
            key: request.headers.get('idempotency-key'),
          })
          if (requests.length === 1) {
            controller.abort(new CliInterruptError('SIGINT'))
            return new Promise<Response>(() => undefined)
          }
          return HttpResponse.json({ emailId: 'clone_1' })
        }
      )
    )
    const environment = env()
    const initial = await runCli(argv, {
      env: environment,
      signal: controller.signal,
    })
    expect(initial.code).toBe(130)
    const error = JSON.parse(
      initial.stderr.trim().split('\n').at(-1) ?? ''
    ) as {
      error: { retryCommand: string; idempotencyKey: string }
    }
    const retried = await runCli(argvOf(error.error.retryCommand), {
      env: environment,
    })
    expect(retried.code).toBe(0)
    expect(requests).toHaveLength(2)
    expect(requests[0]?.key).toBe(error.error.idempotencyKey)
    expect(requests[1]).toEqual(requests[0])
  })

  it.each([['--input', '-'], ['--input=-']])(
    'inlines consumed stdin without changing a flag-like operand (%j)',
    async (...inputArgv) => {
      const input = {
        subject: "Operator's campaign",
        audienceId: 'aud_1',
        domainId: 'dom_1',
      }
      let body: unknown
      server.use(
        http.post(`${API}/sends`, async ({ request }) => {
          body = await request.json()
          return HttpResponse.json({ status: 'scheduled', sendId: 'snd_1' })
        })
      )
      const environment = env()
      const initial = await runCli(
        ['emails', 'send', ...inputArgv, '--', '--input=-'],
        { env: environment, stdin: JSON.stringify(input) }
      )
      expect(initial.code).toBe(4)
      const command = (initial.json as { confirmCommand: string })
        .confirmCommand
      const confirmed = await runCli(argvOf(command), { env: environment })
      expect(confirmed.code).toBe(0)
      expect(body).toEqual({ ...input, emailId: '--input=-' })
    }
  )
})

describe('rerun option boundaries', () => {
  it.each([['--idempotency-key', 'old-key'], ['--idempotency-key=old-key']])(
    'replaces only the actual idempotency option (%j)',
    async (...keyArgv) => {
      const command = buildRetryCommand(
        await invocationOf([
          'emails',
          'clone',
          ...keyArgv,
          '--',
          '--idempotency-key=literal',
        ]),
        'same-key',
        emailsCloneCommand
      )
      expect(argvOf(command)).toEqual([
        'emails',
        'clone',
        '--idempotency-key=same-key',
        '--',
        '--idempotency-key=literal',
      ])
    }
  )

  it('redacts ancestor options before interpreting leaf option values', async () => {
    const command = buildRetryCommand(
      await invocationOf([
        'emails',
        'clone',
        'eml_1',
        '--title',
        '--api-key',
        KEY,
        'Actual title',
      ]),
      'same-key',
      emailsCloneCommand
    )
    expect(command).not.toContain(KEY)
    expect(argvOf(command)).toEqual([
      'emails',
      'clone',
      '--title=Actual title',
      '--idempotency-key=same-key',
      '--',
      'eml_1',
    ])
  })

  it('preserves values and operands that resemble credential options', async () => {
    const command = buildRetryCommand(
      await invocationOf([
        'emails',
        'clone',
        '--title=--api-key=title',
        '--',
        '--api-key=operand',
      ]),
      'same-key',
      emailsCloneCommand
    )
    expect(argvOf(command)).toEqual([
      'emails',
      'clone',
      '--title=--api-key=title',
      '--idempotency-key=same-key',
      '--',
      '--api-key=operand',
    ])
    expect(
      argvOf(
        buildConfirmCommand(
          await invocationOf([
            'emails',
            'delete',
            '--',
            '--header=Authorization: literal',
          ]),
          emailsDeleteCommand
        )
      )
    ).toEqual([
      'emails',
      'delete',
      '--yes',
      '--',
      '--header=Authorization: literal',
    ])
  })

  it('filters credential header values and preserves safe variadic headers', async () => {
    const command = buildConfirmCommand(
      await invocationOf([
        'api',
        'DELETE',
        '/v1/emails/eml_1',
        '--header',
        'Authorization: Bearer secret',
        'X-Trace: trace',
        'Cookie: secret',
        'Idempotency-Key: k1',
      ]),
      apiCommand
    )
    expect(argvOf(command)).toEqual([
      'api',
      '--header=X-Trace: trace',
      '--header=Idempotency-Key: k1',
      '--yes',
      '--',
      'DELETE',
      '/v1/emails/eml_1',
    ])
  })

  it('preserves scalar values when a consumed separator had shielded them from globals', async () => {
    const invocation = await invocationOf([
      'api',
      '--header',
      '--',
      '--header',
      'Authorization:secret',
      'X-Trace:x',
      '--data',
      '--api-key=hidden',
      'DELETE',
      '/v1/emails/eml_1',
    ])
    const command = buildConfirmCommand(invocation, apiCommand)
    const canonical = await invocationOf(argvOf(command))
    expect(canonical.args).toEqual(invocation.args)
    expect(canonical.flags.data).toBe('--api-key=hidden')
    expect(canonical.flags.header).toEqual(['--', 'X-Trace:x'])
    expect(canonical.flags.apiKey).toBeUndefined()
  })
})
