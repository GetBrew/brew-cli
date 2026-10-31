/**
 * End-to-end regressions for the BUILT Node CLI (`bun run build` first):
 *
 *   bun run scripts/regression-smoke.ts
 *
 * Real child processes talk only to a disposable loopback API with a dummy
 * key. Unix shell reruns and the documented CSV pipeline are executed as
 * printed. Linux's `script` utility also exercises genuine terminal output.
 */
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { components } from '../src/generated/openapi-types'

type Exchange = {
  readonly method: string
  readonly path: string
  readonly query: URLSearchParams
  readonly body: unknown
  readonly idempotencyKey: string | undefined
}

type Reply = { readonly status?: number; readonly body: unknown }
type Outcome = {
  readonly code: number | null
  readonly stdout: string
  readonly stderr: string
}

const binary = fileURLToPath(new URL('../dist/bin.js', import.meta.url))
assert.ok(existsSync(binary), 'Run bun run build before the regression smoke.')

const directory = mkdtempSync(join(tmpdir(), 'brew-cli-regressions-'))
const exchanges: Exchange[] = []
let respond: (exchange: Exchange) => Reply = () => ({
  status: 404,
  body: { error: { code: 'UNEXPECTED_REQUEST', message: 'Unexpected route.' } },
})
const server = createServer(async (request, response) => {
  let text = ''
  for await (const chunk of request) text += String(chunk)
  const url = new URL(request.url ?? '/', 'http://127.0.0.1')
  const exchange: Exchange = {
    method: request.method ?? '',
    path: url.pathname,
    query: url.searchParams,
    body: text === '' ? undefined : JSON.parse(text),
    idempotencyKey:
      typeof request.headers['idempotency-key'] === 'string'
        ? request.headers['idempotency-key']
        : undefined,
  }
  exchanges.push(exchange)
  const reply = respond(exchange)
  response.writeHead(reply.status ?? 200, {
    'Content-Type': 'application/json',
  })
  response.end(JSON.stringify(reply.body))
})
await new Promise<void>((resolve, reject) => {
  server.once('error', reject)
  server.listen(0, '127.0.0.1', resolve)
}).catch((failure: unknown) => {
  rmSync(directory, { recursive: true, force: true })
  throw failure
})
const { port } = server.address() as AddressInfo

// The shim lets returned `brew-cli ...` strings run verbatim without an
// installed CLI, while keeping both configuration and credentials isolated.
writeFileSync(
  join(directory, 'brew-cli'),
  '#!/bin/sh\nexec node "$BREW_SMOKE_BIN" "$@"\n',
  { mode: 0o700 }
)
const environment = {
  PATH: `${directory}${delimiter}${process.env.PATH ?? ''}`,
  BREW_API_KEY: 'brew_smoke_test_not_a_real_key_0000',
  BREW_API_URL: `http://127.0.0.1:${port}/api`,
  BREW_CLI_CONFIG_DIR: join(directory, 'config'),
  BREW_SMOKE_BIN: binary,
}

function processResult(
  executable: string,
  args: readonly string[],
  stdin = ''
): Promise<Outcome> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd: directory,
      env: environment,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new Error(`${executable} timed out: ${args.join(' ')}\n${stderr}`))
    }, 10_000)
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.once('error', (error) => {
      clearTimeout(timeout)
      reject(error)
    })
    child.once('close', (code) => {
      clearTimeout(timeout)
      resolve({ code, stdout, stderr })
    })
    child.stdin.end(stdin)
  })
}

function cli(args: readonly string[], stdin?: string): Promise<Outcome> {
  return processResult('node', [binary, '--max-retries', '0', ...args], stdin)
}

function shell(command: string): Promise<Outcome> {
  assert.ok(
    command.startsWith('brew-cli '),
    'Expected a CLI-generated command.'
  )
  return processResult('sh', ['-c', command])
}

function success(result: Outcome): Record<string, unknown> {
  assert.equal(result.code, 0, result.stderr)
  return object(JSON.parse(result.stdout))
}

function object(value: unknown): Record<string, unknown> {
  assert.ok(
    value !== null && typeof value === 'object' && !Array.isArray(value)
  )
  return value as Record<string, unknown>
}

function error(result: Outcome): Record<string, unknown> {
  const line = result.stderr.trim().split('\n').at(-1) ?? ''
  return object(object(JSON.parse(line)).error)
}

function reset(handler: (exchange: Exchange) => Reply): void {
  exchanges.length = 0
  respond = handler
}

function quote(value: string): string {
  return `'${value.replaceAll("'", String.raw`'\''`)}'`
}

function terminal(args: readonly string[]): Promise<Outcome> {
  const command = ['node', binary, '--max-retries', '0', ...args]
    .map(quote)
    .join(' ')
  return processResult('script', ['-qefc', command, '/dev/null'])
}

let failures = 0
async function check(name: string, run: () => Promise<void>): Promise<void> {
  try {
    await run()
    console.log(`ok   ${name}`)
  } catch (failure) {
    failures += 1
    console.error(`FAIL ${name}:`, failure)
  }
}

try {
  await check('explicit empty updates and JSON precedence', async () => {
    reset(({ body }) => ({ body }))
    for (const flags of [
      ['--description', ''],
      ['--description='],
      ['--title', 'Renamed', '--description', ''],
      ['--input', '{"description":"Old"}', '--description', ''],
    ]) {
      success(
        await cli(['automations', 'triggers', 'update', 'tri_1', ...flags])
      )
      assert.deepEqual(exchanges.at(-1)?.body, {
        ...(flags.includes('--title') ? { title: 'Renamed' } : {}),
        description: '',
      })
      assert.equal(exchanges.at(-1)?.method, 'PATCH')
      assert.equal(exchanges.at(-1)?.path, '/api/v1/automations/triggers/tri_1')
    }
    success(await cli(['automations', 'update', 'am_1', '--description', '']))
    assert.deepEqual(exchanges.at(-1)?.body, { description: '' })
    success(
      await cli(['domains', 'update', 'dom_1', '--default-sender-name', ''])
    )
    assert.deepEqual(exchanges.at(-1)?.body, { defaultSenderName: '' })
    success(
      await cli([
        'automations',
        'triggers',
        'update',
        'tri_1',
        '--input',
        '{"description":"Preserved"}',
        '--title',
        'New title',
      ])
    )
    assert.deepEqual(exchanges.at(-1)?.body, {
      description: 'Preserved',
      title: 'New title',
    })

    reset(() => ({
      status: 400,
      body: {
        error: { code: 'INVALID_REQUEST', message: 'From email is empty.' },
      },
    }))
    const invalid = await cli([
      'domains',
      'update',
      'dom_1',
      '--default-from-email',
      '',
    ])
    assert.equal(invalid.code, 1)
    assert.equal(error(invalid).code, 'INVALID_REQUEST')
    assert.deepEqual(exchanges[0]?.body, { defaultFromEmail: '' })
  })

  await check(
    'dash-ID confirmation and retry commands execute verbatim',
    async () => {
      reset(() => ({ body: { deleted: true } }))
      const confirmation = await cli(['emails', 'delete', '--', '-dash-id'])
      assert.equal(confirmation.code, 4)
      assert.equal(exchanges.length, 0)
      const confirmCommand = object(
        JSON.parse(confirmation.stdout)
      ).confirmCommand
      assert.equal(typeof confirmCommand, 'string')
      success(await shell(String(confirmCommand)))
      assert.equal(exchanges.length, 1)
      assert.equal(exchanges[0]?.method, 'DELETE')
      assert.equal(exchanges[0]?.path, '/api/v1/emails/-dash-id')

      reset(() =>
        exchanges.length === 1
          ? {
              status: 503,
              body: {
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'Unknown write outcome.',
                },
              },
            }
          : { body: { emailId: 'eml_copy' } }
      )
      const title = "Retry 'copy'"
      const first = await cli([
        'emails',
        'clone',
        '--title',
        title,
        '--',
        '-dash-id',
      ])
      assert.equal(first.code, 1)
      const retryCommand = error(first).retryCommand
      assert.equal(typeof retryCommand, 'string')
      assert.ok(exchanges[0]?.idempotencyKey)
      success(await shell(String(retryCommand)))
      assert.equal(exchanges.length, 2)
      assert.equal(exchanges[1]?.path, '/api/v1/emails/-dash-id/clone')
      assert.deepEqual(exchanges[1]?.body, { title })
      assert.equal(exchanges[1]?.idempotencyKey, exchanges[0]?.idempotencyKey)
    }
  )

  await check(
    'infer and validate preserve reserved application fields',
    async () => {
      reset(({ path, body }) => {
        if (path.endsWith('/contract/validate')) {
          // This fixture's stored contract requires email/code; prune drops extras.
          const request = object(body)
          const payload = object(request.payload)
          const isPruning = request.enforcement === 'prune'
          const unexpected = Object.keys(payload).filter(
            (key) => !['email', 'code'].includes(key)
          )
          const issues: components['schemas']['PayloadContractValidateResponse']['errors'] =
            unexpected.map((field) => ({
              code: 'unexpected_key',
              field,
              message: `Unexpected field: ${field}`,
            }))
          const missing: typeof issues = ['email', 'code']
            .filter((field) => typeof payload[field] !== 'string')
            .map((field) => ({
              code: 'missing_required',
              field,
              message: `Missing required field: ${field}`,
            }))
          const response: components['schemas']['PayloadContractValidateResponse'] =
            {
              valid:
                missing.length === 0 && (isPruning || unexpected.length === 0),
              errors: [...missing, ...(isPruning ? [] : issues)],
              warnings: isPruning ? issues : [],
              resolvedPayload: isPruning
                ? Object.fromEntries(
                    Object.entries(payload).filter(
                      ([key]) => !unexpected.includes(key)
                    )
                  )
                : payload,
              prunedKeys: isPruning ? unexpected : [],
              source: 'stored',
            }
          return { body: response }
        }
        const response: components['schemas']['PayloadContractInferResponse'] =
          {
            fields: [],
            issues: [],
          }
        return { body: response }
      })
      const example = {
        email: 'jane@example.com',
        example: 'Demo',
        orderTotal: 9.5,
      }
      success(
        await cli(['contracts', 'infer', '--input', JSON.stringify(example)])
      )
      assert.deepEqual(exchanges.at(-1)?.body, { example })
      success(
        await cli([
          'contracts',
          'infer',
          '--input',
          JSON.stringify({ example, subjectKind: 'trigger' }),
        ])
      )
      assert.deepEqual(exchanges.at(-1)?.body, {
        example,
        subjectKind: 'trigger',
      })

      const payload = {
        email: 'jane@example.com',
        code: '123456',
        payload: { email: 'jane@example.com', code: '123456' },
      }
      const bare = success(
        await cli(
          [
            'automations',
            'triggers',
            'contract',
            'validate',
            'tri_1',
            '--input',
            '-',
            '--enforcement',
            'strict',
          ],
          JSON.stringify(payload)
        )
      )
      assert.equal(bare.valid, false)
      assert.deepEqual(bare.errors, [
        {
          code: 'unexpected_key',
          field: 'payload',
          message: 'Unexpected field: payload',
        },
      ])
      assert.deepEqual(exchanges.at(-1)?.body, {
        payload,
        enforcement: 'strict',
      })
      const pruned = success(
        await cli([
          'automations',
          'triggers',
          'contract',
          'validate',
          'tri_1',
          '--input',
          JSON.stringify({ payload, enforcement: 'strict' }),
          '--enforcement',
          'prune',
        ])
      )
      assert.deepEqual(exchanges.at(-1)?.body, {
        payload,
        enforcement: 'prune',
      })
      assert.equal(pruned.valid, true)
      assert.deepEqual(pruned.resolvedPayload, {
        email: 'jane@example.com',
        code: '123456',
      })
      assert.deepEqual(pruned.prunedKeys, ['payload'])
      assert.deepEqual(pruned.errors, [])
      assert.deepEqual(pruned.warnings, bare.errors)

      const wrapperShapedData = {
        payload: { email: 'jane@example.com', code: '123456' },
      }
      const nested = success(
        await cli([
          'automations',
          'triggers',
          'contract',
          'validate',
          'tri_1',
          '--input',
          JSON.stringify({ payload: wrapperShapedData }),
        ])
      )
      assert.equal(nested.valid, false)
      assert.deepEqual(exchanges.at(-1)?.body, { payload: wrapperShapedData })
    }
  )

  await check(
    'doctor fails a configured but unverified auth check',
    async () => {
      for (const status of [429, 500]) {
        reset(({ path }) => {
          if (path.endsWith('/health'))
            return { body: { status: 'ok', version: 'v1' } }
          if (path.endsWith('/help')) return { body: { endpoints: [] } }
          return {
            status,
            body: {
              error: {
                code: status === 429 ? 'RATE_LIMITED' : 'INTERNAL_ERROR',
                message: 'Usage unavailable.',
              },
            },
          }
        })
        const result = await cli(['doctor'])
        assert.equal(result.code, 1)
        const report = object(JSON.parse(result.stdout))
        assert.equal(report.ok, false)
        assert.equal(report.authValid, null)
        assert.equal(report.authCheckError, 'Usage unavailable.')
        assert.equal(
          exchanges.filter(({ path }) => path.endsWith('/usage')).length,
          1
        )
      }
    }
  )

  await check(
    'send-only audience requests retain server-derived windows',
    async () => {
      reset(() => ({
        status: 201,
        body: { audienceId: 'aud_1', materializationStatus: 'pending' },
      }))
      success(
        await cli([
          'audiences',
          'from-events',
          '--event-types',
          'opened',
          '--send-id',
          'snd_1',
        ])
      )
      assert.deepEqual(exchanges[0]?.body, {
        cohort: { eventTypes: ['opened'], sendId: 'snd_1' },
      })
      const input = {
        cohort: { eventTypes: ['sent'], sendId: 'snd_1', exclude: {} },
      }
      success(
        await cli([
          'audiences',
          'from-events',
          '--input',
          JSON.stringify(input),
        ])
      )
      assert.deepEqual(exchanges[1]?.body, input)
      assert.equal(exchanges.length, 2)
      const missing = await cli([
        'audiences',
        'from-events',
        '--event-types',
        'opened',
      ])
      assert.equal(missing.code, 2)
      assert.equal(exchanges.length, 2)
    }
  )

  await check(
    'help, limit forwarding, CSV pipeline and credit manifest',
    async () => {
      for (const args of [
        ['contacts', 'search'],
        ['templates', 'list'],
      ]) {
        const help = await cli([...args, '--help'])
        assert.equal(help.code, 0)
        assert.match(help.stdout, /Page size, 1-100 \(default 50\)/)
      }
      const analyticsHelp = await cli(['analytics', 'events', '--help'])
      assert.match(analyticsHelp.stdout, /Page size, 1-100 \(default 100\)/)
      reset(({ query }) => {
        const from = query.get('from') ?? ''
        const to = query.get('to')
        if (!from.includes('T') || (to !== null && !to.includes('T'))) {
          return {
            status: 400,
            body: {
              error: {
                code: 'INVALID_REQUEST',
                message: 'Use a full datetime.',
              },
            },
          }
        }
        return { body: { data: [], truncated: false } }
      })
      for (const name of ['automations', 'events']) {
        const help = await cli(['analytics', name, '--help'])
        const datetimes = [
          ...help.stdout.matchAll(/--(?:since|until) (\d\S*)/g),
        ]
        assert.ok(datetimes.length > 0)
        for (const match of datetimes)
          assert.match(match[1] ?? '', /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
        const example = help.stdout
          .split('\n')
          .map((line) => line.trim())
          .find((line) =>
            line.startsWith(`brew-cli analytics ${name} --since `)
          )
        assert.ok(example)
        success(await shell(example))
        assert.equal(exchanges.at(-1)?.query.get('from'), datetimes[0]?.[1])
      }

      reset(() => ({
        body: {
          data: [],
          pagination: { limit: 50, cursor: null, hasMore: false },
        },
      }))
      success(await cli(['contacts', 'search']))
      assert.equal(object(exchanges.at(-1)?.body).limit, undefined)
      success(await cli(['templates', 'list']))
      assert.equal(exchanges.at(-1)?.query.has('limit'), false)
      success(await cli(['contacts', 'search', '--limit', '100']))
      assert.equal(object(exchanges.at(-1)?.body).limit, 100)

      const csv = 'email,scope\njane@example.com,all\n'
      reset(() => ({ body: { csv, truncated: false } }))
      const output = success(
        await cli(['domains', 'unsubscribes', 'export', 'dom_123'])
      )
      assert.equal(output.csv, csv)
      const help = await cli(['domains', 'unsubscribes', 'export', '--help'])
      const example =
        "brew-cli domains unsubscribes export dom_123 --json | jq -j '.csv' > optouts.csv"
      assert.ok(help.stdout.includes(example))
      const exported = await shell(example)
      assert.equal(exported.code, 0, exported.stderr)
      assert.equal(readFileSync(join(directory, 'optouts.csv'), 'utf8'), csv)

      const manifest = success(await cli(['docs', '--agent']))
      assert.ok(Array.isArray(manifest.commands))
      const commands: ReadonlyArray<unknown> = manifest.commands
      for (const command of [
        'contacts upsert',
        'contacts upsert-many',
        'contacts import',
        'contacts import-csv',
      ]) {
        const metadata = commands.find(
          (item: unknown) => object(item).command === `brew-cli ${command}`
        )
        assert.equal(object(metadata).credited, true, command)
      }
    }
  )

  if (process.platform === 'linux') {
    await check(
      'real terminal shows partial analytics, including empty/quiet results',
      async () => {
        for (const rows of [
          [],
          [{ automationId: 'am_1', name: 'Welcome', runs: 2 }],
        ]) {
          reset(() => ({ body: { data: rows, truncated: true } }))
          assert.equal(
            success(await cli(['analytics', 'automations'])).truncated,
            true
          )
          const output = await terminal(['analytics', 'automations', '--quiet'])
          assert.equal(output.code, 0, output.stderr)
          assert.match(
            output.stdout,
            /Partial results: scan budgets clipped the requested window\./
          )
        }
        reset(() => ({ body: { data: [], truncated: false } }))
        const complete = await terminal(['analytics', 'automations'])
        assert.equal(complete.code, 0, complete.stderr)
        assert.ok(!complete.stdout.includes('Partial results:'))
      }
    )
  } else {
    console.log(
      'skip real terminal smoke (uses Linux script; TTY unit tests remain portable)'
    )
  }
} finally {
  server.closeAllConnections()
  await new Promise<void>((resolve) => server.close(() => resolve()))
  rmSync(directory, { recursive: true, force: true })
}

if (failures > 0) process.exitCode = 1
