import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { analyzeArgument } from '../../../src/lib/migrate/code/analyze'
import {
  decideRewrites,
  mapFilePath,
  rewriteFile,
} from '../../../src/lib/migrate/code/rewrite'
import { type CodeScan, scanProject } from '../../../src/lib/migrate/code/scan'
import { tempProject } from '../../helpers/fixtures'

function project(files: Readonly<Record<string, string>>): CodeScan {
  const root = tempProject('brew-cli-migrate-code-')
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, file)), { recursive: true })
    writeFileSync(join(root, file), text)
  }
  return scanProject(root, { typescript: null })
}

function analyze(argument: string) {
  return analyzeArgument(
    argument,
    { start: 0, end: argument.length },
    'send.ts'
  )
}

function rewritten(scan: CodeScan, file: string, mapFile: string): string {
  const scanned = scan.files.get(file)
  if (scanned === undefined) {
    throw new Error(`${file} was not scanned`)
  }
  return rewriteFile({ file, scanned, mapFile })
}

const CLIENT = `import { Resend } from 'resend'
export const resend = new Resend(process.env.RESEND_API_KEY)
`
const DEFAULT_CLIENT = `import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)
export default resend
`

describe('analyzeArgument', () => {
  it('a spread beside a template may carry anything: it does not carry over', () => {
    const [message] = analyze(
      "{ to, template: { id: 'receipt' }, ...options }"
    ).messages
    expect(message?.kind).toBe('template')
    expect(message?.unsupported).toContain('...spread')
  })

  it('an empty batch is one unknown message', () => {
    const analysis = analyze('[]')
    expect(analysis.kind).toBe('unknown')
    expect(analysis.messages).toHaveLength(1)
  })
})

describe('decideRewrites', () => {
  it('a send whose client the scan cannot follow keeps every client on Resend', () => {
    const scan = project({
      'src/resend.ts': CLIENT,
      'src/index.ts': "export { resend } from './resend'\n",
      'src/send.ts': `import { resend } from './index'
export const go = () => resend.emails.send({ to: 'x', html: '<p>Hi</p>' })
`,
    })
    expect(decideRewrites(scan, new Set(), true)).toEqual([
      expect.objectContaining({ file: 'src/resend.ts', rewritable: false }),
    ])
  })

  it('a file too big to parse that mentions Resend leaves the scan incomplete, and nothing moves', () => {
    const scan = project({
      'src/resend.ts': CLIENT,
      'src/notify.ts': `import { resend } from './resend'
export const go = () => resend.emails.send({ to: 'x', template: { id: 'welcome' } })
`,
      'src/generated.ts': `${'// filler\n'.repeat(110_000)}resend.emails.send({ html })\n`,
    })
    expect(scan.truncated).toBe(true)
    expect(decideRewrites(scan, new Set(['welcome']), true)).toEqual([
      expect.objectContaining({ file: 'src/resend.ts', rewritable: false }),
    ])
  })

  it.each([
    [
      'in its own file',
      `${CLIENT}export const add = () => resend.contacts.create({ email: 'x' })\n`,
      '',
    ],
    [
      'through an import',
      CLIENT,
      "import { resend } from './resend'\nexport const add = () => resend.contacts.create({ email: 'x' })\n",
    ],
  ])(
    'a client used for more than sends stays on Resend (%s)',
    (_case, client, other) => {
      const scan = project({
        'src/resend.ts': client,
        'src/notify.ts': `import { resend } from './resend'
export const go = () => resend.emails.send({ to: 'x', template: { id: 'welcome' } })
${other}`,
      })
      expect(decideRewrites(scan, new Set(['welcome']), true)).toEqual([
        expect.objectContaining({ file: 'src/resend.ts', rewritable: false }),
      ])
    }
  )

  it('a comment or a string naming another client member moves the client anyway', () => {
    const scan = project({
      'src/resend.ts': CLIENT,
      'src/notify.ts': `import { resend } from './resend'
// resend.contacts.create({ email }) once the list exists
const hint = 'resend.emails.get(id)' + \`resend.contacts.list()\`
export const go = () => resend.emails.send({ to: 'x', template: { id: 'welcome' } })
`,
    })
    expect(decideRewrites(scan, new Set(['welcome']), true)).toEqual([
      { file: 'src/resend.ts', rewritable: true },
    ])
  })

  it('a contact-only caller that never names Resend keeps the client on Resend', () => {
    const scan = project({
      'src/mail.ts': DEFAULT_CLIENT,
      'src/notify.ts': `import mailer from './mail'
export const go = () => mailer.emails.send({ to: 'x', template: { id: 'welcome' } })
`,
      'src/contacts.ts': `import mailer from './mail'
export const add = () => mailer.contacts.create({ email: 'x' })
`,
    })
    expect(decideRewrites(scan, new Set(['welcome']), true)).toEqual([
      {
        file: 'src/mail.ts',
        rewritable: false,
        reason: expect.stringContaining('src/contacts.ts uses the client'),
      },
    ])
  })

  it('an import of another module is not the client', () => {
    const scan = project({
      'src/mail.ts': DEFAULT_CLIENT,
      'src/logger.ts': 'export default { info: (_: string) => {} }\n',
      'src/notify.ts': `import mailer from './mail'
import logger from './logger'
export const go = () => {
  logger.info('sending')
  return mailer.emails.send({ to: 'x', template: { id: 'welcome' } })
}
`,
    })
    expect(decideRewrites(scan, new Set(['welcome']), true)).toEqual([
      { file: 'src/mail.ts', rewritable: true },
    ])
  })
})

describe('rewriteFile', () => {
  it('names a JavaScript map with its extension, so Node ESM resolves it', () => {
    const scan = project({ 'src/send.js': CLIENT })
    const map = mapFilePath('lib', false, 'esm')
    expect(map).toBe('lib/brew-resend-map.js')
    expect(rewritten(scan, 'src/send.js', map)).toContain(
      "import { brewResendTemplates } from '../lib/brew-resend-map.js'"
    )
  })

  it('a CommonJS map is .cjs, and its client reads it where the client is built', () => {
    const scan = project({
      'job.cjs':
        "const { Resend } = require('resend'); const resend = new Resend(process.env.RESEND_API_KEY)\nmodule.exports = { resend }\n",
    })
    const map = mapFilePath('lib', false, 'cjs')
    expect(map).toBe('lib/brew-resend-map.cjs')
    expect(rewritten(scan, 'job.cjs', map)).toBe(
      "const { Resend } = require('@brew.new/sdk/resend'); const resend = new Resend(process.env.BREW_API_KEY, { templates: require('./lib/brew-resend-map.cjs').brewResendTemplates })\nmodule.exports = { resend }\n"
    )
  })

  it('puts the map import on its own line after a one-line import and client', () => {
    const scan = project({
      'send.ts':
        "import { Resend } from 'resend'; const resend = new Resend(process.env.RESEND_API_KEY);\nexport { resend }\n",
    })
    expect(
      rewritten(scan, 'send.ts', mapFilePath(null, true, 'esm')).split('\n')
    ).toEqual([
      "import { Resend } from '@brew.new/sdk/resend';",
      "import { brewResendTemplates } from './lib/brew-resend-map'",
      ' const resend = new Resend(process.env.BREW_API_KEY, { templates: brewResendTemplates });',
      'export { resend }',
      '',
    ])
  })
})
