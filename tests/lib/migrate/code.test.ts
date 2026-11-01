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

  it('a spread inside template after its id may replace it: the id is computed', () => {
    const [after] = analyze(
      "{ to, template: { id: 'welcome', ...options } }"
    ).messages
    expect(after?.templateId).toBeNull()
    const [before] = analyze(
      "{ to, template: { ...options, id: 'welcome' } }"
    ).messages
    expect(before?.templateId).toBe('welcome')
  })

  it('reads a literal computed name, and a name it cannot read may be any field', () => {
    const [literal] = analyze(
      "{ to, template: { id: 'receipt' }, ['cc']: manager }"
    ).messages
    expect(literal?.unsupported).toContain('cc')
    const [computed] = analyze(
      "{ to, template: { id: 'receipt' }, [field]: manager }"
    ).messages
    expect(computed?.unsupported).not.toEqual([])
  })

  it('an empty batch is one unknown message', () => {
    const analysis = analyze('[]')
    expect(analysis.kind).toBe('unknown')
    expect(analysis.messages).toHaveLength(1)
  })
})

describe('decideRewrites', () => {
  it('a client whose key is a local RESEND_API_KEY binding stays on Resend', () => {
    const scan = project({
      'src/mail.ts': `import { Resend } from 'resend'
const { RESEND_API_KEY } = process.env
const resend = new Resend(RESEND_API_KEY)
export const go = (to: string) => resend.emails.send({ to, template: { id: 'welcome' } })
`,
    })
    expect(decideRewrites(scan, new Set(['welcome']), true)).toEqual([
      expect.objectContaining({ file: 'src/mail.ts', rewritable: false }),
    ])
  })

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
  it('a JavaScript ESM map is .mjs, so Node loads it as ESM without "type": "module"', () => {
    const scan = project({ 'src/send.mjs': CLIENT })
    const map = mapFilePath('lib', false, 'esm')
    expect(map).toBe('lib/brew-resend-map.mjs')
    expect(rewritten(scan, 'src/send.mjs', map)).toContain(
      "import { brewResendTemplates } from '../lib/brew-resend-map.mjs'"
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
