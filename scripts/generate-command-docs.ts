import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { GLOBAL_FLAGS } from '../src/lib/define-command'
import { ALL_COMMANDS } from '../src/registry'
import { SDK_SKIP_LIST, SPEC_SKIP_LIST } from '../src/skip-list'

/**
 * Generates docs/commands/README.md from the command registry.
 *   bun run docs:commands          — write the file
 *   bun run docs:commands:check    — fail when the committed file is stale
 */

const OUTPUT_PATH = join(import.meta.dirname, '../docs/commands/README.md')

function generate(): string {
  const lines: string[] = [
    '# brew-cli command reference',
    '',
    '<!-- GENERATED FILE — do not edit. Regenerate with `bun run docs:commands`. -->',
    '',
    `${ALL_COMMANDS.length} commands. Classes: read (always safe), write`,
    '(mutating, retry-safe), destructive (irreversible — the confirmation',
    'protocol applies: interactive y/N on a TTY, exit 4 + JSON envelope with',
    'a `confirmCommand` otherwise, `--yes` to proceed).',
    '',
    '## Global flags',
    '',
  ]
  for (const flag of GLOBAL_FLAGS) {
    lines.push(`- \`${flag.flag}\` — ${flag.summary}`)
  }
  lines.push('', '## Commands', '')
  lines.push('| Command | Class | API route | Summary |')
  lines.push('| --- | --- | --- | --- |')
  for (const spec of ALL_COMMANDS) {
    const name = ['brew-cli', ...spec.path].join(' ')
    const route = spec.route
      ? `\`${spec.route.method} ${spec.route.path}\``
      : '—'
    const credit = spec.isCredited === true ? ' ($)' : ''
    lines.push(
      `| \`${name}\` | ${spec.commandClass}${credit} | ${route} | ${spec.summary} |`
    )
  }
  lines.push('', '## Details', '')
  for (const spec of ALL_COMMANDS) {
    const name = ['brew-cli', ...spec.path].join(' ')
    lines.push(`### ${name}`, '', spec.summary, '')
    if (spec.route) {
      lines.push(`- Route: \`${spec.route.method} ${spec.route.path}\``)
    }
    lines.push(`- Class: ${spec.commandClass}`)
    if (spec.isCredited === true) {
      lines.push('- Consumes Brew credits')
    }
    if (spec.sdkMethod !== null) {
      lines.push(`- SDK: \`brew.${spec.sdkMethod}(...)\``)
    }
    if (spec.derivedFrom !== undefined) {
      lines.push(`- Derived from \`brew.${spec.derivedFrom}(...)\``)
    }
    for (const arg of spec.args ?? []) {
      lines.push(
        `- Argument \`${arg.name}\`${arg.isRequired ? '' : ' (optional)'} — ${arg.summary}`
      )
    }
    for (const flag of spec.flags ?? []) {
      lines.push(`- \`${flag.flag}\` — ${flag.summary}`)
    }
    lines.push('', '```bash')
    for (const example of spec.examples) {
      lines.push(example)
    }
    lines.push('```', '')
  }
  lines.push('## Known gaps', '')
  lines.push('SDK methods intentionally without a dedicated command:', '')
  for (const skip of SDK_SKIP_LIST) {
    lines.push(`- \`${skip.sdkPath}\` — ${skip.reason}`)
  }
  lines.push(
    '',
    'Public API operations not yet available (tracked by the spec parity test):',
    ''
  )
  for (const skip of SPEC_SKIP_LIST) {
    lines.push(`- \`${skip.method} ${skip.path}\` — ${skip.reason}`)
  }
  lines.push('')
  return lines.join('\n')
}

const isCheck = process.argv.includes('--check')
const next = generate()
if (isCheck) {
  let current = ''
  try {
    current = readFileSync(OUTPUT_PATH, 'utf8')
  } catch {
    current = ''
  }
  if (current !== next) {
    console.error(
      'docs/commands/README.md is stale. Run `bun run docs:commands` and commit.'
    )
    process.exit(1)
  }
  console.log('docs/commands/README.md is fresh.')
} else {
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, next)
  console.log(`Wrote ${OUTPUT_PATH}`)
}
