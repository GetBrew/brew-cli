import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'

const workflow = readFileSync(
  new URL('../.github/workflows/update-public-contract.yml', import.meta.url),
  'utf8'
)
const step = workflow.slice(
  workflow.indexOf('      - name: Open a draft update for review')
)
const script = step
  .slice(step.indexOf('        run: |\n') + '        run: |\n'.length)
  .split('\n')
  .map((line) => (line.startsWith('          ') ? line.slice(10) : line))
  .join('\n')

// Execute the actual workflow shell, with every Git/GitHub/dependency effect mocked.
const driver = `#!${process.execPath}\n${String.raw`
const fs = require('node:fs')
const path = require('node:path')
const tool = path.basename(process.argv[1])
const args = process.argv.slice(2)
const head = fs.readFileSync(process.env.HEAD_FILE, 'utf8')
fs.appendFileSync(process.env.COMMAND_LOG, JSON.stringify({tool,args,head,hasWriteToken:!!process.env.GH_TOKEN})+'\n')
const remote = 'b'.repeat(40), parent = 'a'.repeat(40)
const finish = (status=0, text='') => { process.stdout.write(text); process.exit(status) }
if(tool==='git') {
 if(args[0]==='diff' && args.includes('--quiet'))finish(1)
 if(args[0]==='ls-remote')finish(0, remote+'\trefs/heads/automation/test\n')
 if(args[0]==='rev-parse')finish(0,remote+'\n')
 if(args[0]==='show')finish(0,parent+'\n')
 if(args[0]==='diff' && args.includes('--name-only'))finish(0,'contract.lock.json\0')
 if(args[0]==='diff' && args.includes('--exit-code'))finish()
 if(args[0]==='switch') {fs.writeFileSync(process.env.HEAD_FILE,remote);finish()}
 if(['add','fetch'].includes(args[0]))finish()
}
if(tool==='gh') {
 if(args[0]==='auth')finish()
 if(args[0]==='api')finish(0,JSON.stringify({merge_base_commit:{sha:parent}}))
 if(args[0]==='pr' && args[1]==='list')finish(0,process.env.SCENARIO==='existing-open'?'https://example.test/pr/1\n':'')
 if(args[0]==='pr' && args[1]==='create')finish(0,'https://example.test/pr/2\n')
}
if(tool==='bun') {
 if(args[0]==='install') {fs.writeFileSync(process.env.GRAPH_FILE,head);finish()}
 if(args[0]==='run') {
  if(!fs.existsSync(process.env.GRAPH_FILE)||fs.readFileSync(process.env.GRAPH_FILE,'utf8')!==head)finish(98)
  finish(process.env.SCENARIO==='failed-validation'?1:0)
 }
}
console.error('Unexpected mocked effect',tool,args)
process.exit(99)
`}`

type Call = {
  tool: string
  args: Array<string>
  head: string
  hasWriteToken: boolean
}

function replay(scenario: string) {
  const root = mkdtempSync(join(tmpdir(), 'brew-contract-recovery-'))
  try {
    for (const tool of ['git', 'gh', 'bun']) {
      writeFileSync(join(root, tool), driver)
      chmodSync(join(root, tool), 0o755)
    }
    const log = join(root, 'commands.jsonl')
    const head = join(root, 'head')
    writeFileSync(log, '')
    writeFileSync(head, 'f'.repeat(40))
    const result = spawnSync(
      'bash',
      ['--noprofile', '--norc', '-euo', 'pipefail', '-c', script],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 15_000,
        env: {
          ...process.env,
          PATH: `${root}:${process.env.PATH ?? ''}`,
          COMMAND_LOG: log,
          HEAD_FILE: head,
          GRAPH_FILE: join(root, 'installed-graph'),
          SCENARIO: scenario,
          RUNNER_TEMP: root,
          ARTIFACT_DIGEST: 'e'.repeat(64),
          SOURCE_COMMIT: 'c'.repeat(40),
          SOURCE_RUN_ID: '123',
          DEFAULT_BRANCH: 'main',
          CONSUMER_REPOSITORY: 'GetBrew/example',
          VALIDATION_OUTCOME: 'success',
          USES_AUTOMATION_TOKEN: 'false',
          GH_TOKEN: 'mock-write-capability',
        },
      }
    )
    const calls = readFileSync(log, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Call)
    const bodyFile = join(root, 'contract-pr.md')
    return {
      result,
      calls,
      body: existsSync(bodyFile) ? readFileSync(bodyFile, 'utf8') : null,
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

it.each(['success', 'failed-validation'])(
  'validates recovered source and its own frozen graph before reporting %s',
  (scenario) => {
    const { result, calls, body } = replay(scenario)
    expect(result.status, result.stderr).toBe(0)
    const installs = calls.filter(
      (call) => call.tool === 'bun' && call.args[0] === 'install'
    )
    expect(installs).toHaveLength(1)
    expect(installs[0]?.args).toEqual(['install', '--frozen-lockfile'])
    const validations = calls.filter((call) => call.tool === 'bun')
    expect(validations.length).toBeGreaterThan(1)
    for (const call of validations) {
      expect(call.head).toBe('b'.repeat(40))
      expect(call.hasWriteToken).toBe(false)
    }
    expect(body).toContain(
      `Owning validation: ${scenario === 'success' ? 'success' : 'failure'}`
    )
    expect(
      calls.some(
        (call) =>
          call.tool === 'git' && ['push', 'commit'].includes(call.args[0] ?? '')
      )
    ).toBe(false)
    expect(
      calls.filter((call) => call.tool === 'gh' && call.args[1] === 'create')
    ).toHaveLength(1)
  }
)

it('keeps the verified-open-PR early exit without new checks or writes', () => {
  const { result, calls, body } = replay('existing-open')
  expect(result.status, result.stderr).toBe(0)
  expect(body).toBe(null)
  expect(calls.some((call) => call.tool === 'bun')).toBe(false)
  expect(
    calls.some(
      (call) =>
        call.tool === 'git' &&
        ['switch', 'push', 'commit'].includes(call.args[0] ?? '')
    )
  ).toBe(false)
  expect(
    calls.some((call) => call.tool === 'gh' && call.args[1] === 'create')
  ).toBe(false)
})
