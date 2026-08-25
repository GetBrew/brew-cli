import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

import type {
  ListTriggersInput,
  ListTriggersResponse,
  Trigger,
} from '@brew.new/sdk'
import { defineCommand } from '../lib/define-command'
import { asSdkInput } from '../lib/input'

type TriggerRow = Trigger

/**
 * `brew-cli types` — generate TypeScript payload contracts for this
 * workspace's triggers (declared `payloadSchema`). Deterministic output:
 * same inputs → the same bytes, with a content hash in the header so
 * `--check` works as a CI drift gate (exit 1 when the API's contracts no
 * longer match the committed file).
 */

const HEADER_PREFIX = '// brew:contracts sha256:'

/**
 * THE canonical type-name rule, mirrored byte-for-byte from the app's
 * `lib/payload-contract/codegen.ts` (`contractTypeName`) so Copy-as, the
 * SKILL.md brief, and this file all mint the SAME identifier for one
 * contract: PascalCase(name || id) + `Payload`, digit-led names prefixed,
 * an existing `…Payload` suffix never doubled, symbol-only names →
 * `ContractPayload`.
 */
function pascalCase(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9]+/g, ' ').trim()
  if (cleaned === '') {
    return 'Contract'
  }
  return cleaned
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

function typeName(label: string): string {
  const base = pascalCase(label)
  if (/^[0-9]/.test(base)) {
    return `Payload${base}`
  }
  return base.endsWith('Payload') ? base : `${base}Payload`
}

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function propertyKey(key: string): string {
  return IDENTIFIER_RE.test(key) ? key : JSON.stringify(key)
}

/**
 * The full contract-node lattice the platform can emit — the app's
 * `ContractFieldNode` (lib/payload-contract/types.ts). Deliberately wider
 * than the vendored `TriggerPayloadField` so nested / enum nodes survive
 * a vendored-spec lag: the emitter reads the wire JSON, not the spec.
 */
type TriggerFieldNode = {
  key: string
  type: string
  required: boolean
  /** `type: 'enum'` (or an array of enums via `itemType`): allowed values. */
  enumValues?: ReadonlyArray<string>
  /** `object`: properties. `array` with object elements: element properties. */
  children?: ReadonlyArray<TriggerFieldNode>
  /** `array` with scalar elements: the element type. */
  itemType?: string
}

/**
 * Scalar mapping mirrored from the app's `lib/payload-contract/codegen.ts`
 * (`scalarTsType`): int/float → number, date → ISO string, enum → a
 * literal union when `enumValues` exist. A type this build does not know
 * (including the platform's derived-view `'unknown'`) is honestly
 * `unknown` — never a silently-wrong `string`.
 */
function scalarTsType(type: string, node: TriggerFieldNode): string {
  switch (type) {
    case 'string':
      return 'string'
    case 'int':
    case 'float':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'date':
      // ISO-8601 date-time string on the wire.
      return 'string'
    case 'enum':
      return node.enumValues && node.enumValues.length > 0
        ? node.enumValues.map((value) => JSON.stringify(value)).join(' | ')
        : 'string'
    default:
      return 'unknown'
  }
}

function triggerFieldType(node: TriggerFieldNode, indent: string): string {
  if (node.type === 'object') {
    return triggerObjectLiteral(node.children ?? [], indent)
  }
  if (node.type === 'array') {
    if (node.children && node.children.length > 0) {
      return `Array<${triggerObjectLiteral(node.children, indent)}>`
    }
    const element = node.itemType
      ? scalarTsType(node.itemType, node)
      : 'unknown'
    return `Array<${element}>`
  }
  return scalarTsType(node.type, node)
}

/**
 * Nested emission mirrored from the app codegen's `tsObjectLiteral`:
 * field order as given, `?:` from `required`, two-space indent per level.
 * Flat contracts emit byte-identically to the pre-nested emitter (the
 * sha256 header + `--check` gates depend on that stability), which is
 * also why the app's per-field doc comments are NOT ported here.
 */
function triggerObjectLiteral(
  nodes: ReadonlyArray<TriggerFieldNode>,
  indent: string
): string {
  if (nodes.length === 0) {
    // Top level: zero declared fields means "send nothing". A NESTED
    // childless object is different: its inner shape is unknown, not
    // empty.
    return indent === '' ? 'Record<string, never>' : 'Record<string, unknown>'
  }
  const inner = `${indent}  `
  const lines: Array<string> = ['{']
  for (const node of nodes) {
    const optional = node.required ? '' : '?'
    lines.push(
      `${inner}${propertyKey(node.key)}${optional}: ${triggerFieldType(node, inner)}`
    )
  }
  lines.push(`${indent}}`)
  return lines.join('\n')
}

function emitTriggerType(trigger: TriggerRow, name: string): string {
  const fields: ReadonlyArray<TriggerFieldNode> =
    trigger.payloadSchema?.fields ?? []
  return [
    `/** Fire: POST /v1/automations/triggers/${trigger.triggerEventId}/fire — body { payload: ${name} } */`,
    `export type ${name} = ${triggerObjectLiteral(fields, '')}`,
  ].join('\n')
}

/** Byte-stable ordering — `localeCompare` varies by host locale. */
function byCodepoint(a: string, b: string): number {
  if (a < b) {
    return -1
  }
  return a > b ? 1 : 0
}

/**
 * Trigger titles share one flat namespace and carry no uniqueness
 * constraint — colliding names get the trigger id appended (then a
 * numeric suffix as a last resort) so the generated file always compiles.
 */
function uniqueNames(
  entries: ReadonlyArray<{ label: string; id: string }>
): Array<string> {
  const taken = new Map<string, number>()
  return entries.map(({ label, id }) => {
    let name = typeName(label)
    if (taken.has(name)) {
      const suffixed = `${name}${pascalCase(id)}`
      name = suffixed
    }
    while (taken.has(name)) {
      const bump = (taken.get(name) ?? 1) + 1
      taken.set(name, bump)
      name = `${name}${bump}`
    }
    taken.set(name, 1)
    return name
  })
}

function buildFileText(args: { triggers: ReadonlyArray<TriggerRow> }): string {
  const triggers = [...args.triggers].sort((a, b) =>
    byCodepoint(a.triggerEventId, b.triggerEventId)
  )
  // ONE name pass: same rule as the app (name || id), collisions
  // resolved deterministically.
  const names = uniqueNames(
    triggers.map((t) => ({ id: t.triggerEventId, label: t.title }))
  )
  const triggerBlocks = triggers.map((t, i) =>
    emitTriggerType(t, names[i] ?? typeName(t.title))
  )
  const body = [
    '// Generated by `brew-cli types` — do not edit by hand.',
    '// Re-run `brew-cli types` after changing a trigger schema; gate',
    '// drift in CI with `brew-cli types --check`.',
    '',
    triggerBlocks.join('\n\n'),
    '',
  ].join('\n')
  const hash = createHash('sha256').update(body).digest('hex')
  return `${HEADER_PREFIX}${hash}\n${body}`
}

export const typesCommand = defineCommand({
  path: ['types'],
  summary:
    "Generate TypeScript payload contracts for this workspace's triggers into your codebase; --check is the CI drift gate (exit 1 on drift). Needs the automations scope",
  sdkMethod: null,
  derivedFrom: 'automations.triggers.list',
  route: { method: 'GET', path: '/v1/automations/triggers' },
  commandClass: 'read',
  flags: [
    {
      flag: '--out <file>',
      summary: 'Output file (default brew-contracts.ts)',
      defaultValue: 'brew-contracts.ts',
    },
    {
      flag: '--check',
      summary:
        'Verify the output file is up to date instead of writing; exits 1 on drift',
    },
  ],
  examples: [
    'brew-cli types',
    'brew-cli types --out src/brew-contracts.ts',
    'brew-cli types --check',
  ],
  run: async ({ ctx, flags }) => {
    // Follow the cursor to the end — a silent 100-trigger cap would make
    // `--check` certify an incomplete file (integration catalogs alone
    // can cross 100). The page ceiling is a runaway-loop backstop only.
    const triggers: Array<TriggerRow> = []
    let cursor: string | null = null
    for (let page = 0; page < 50; page++) {
      const listResponse: ListTriggersResponse = await ctx
        .client()
        .automations.triggers.list(
          asSdkInput<ListTriggersInput>({
            limit: 100,
            ...(cursor === null ? {} : { cursor }),
          })
        )
      triggers.push(...(listResponse.data ?? []))
      if (
        !listResponse.pagination?.hasMore ||
        !listResponse.pagination.cursor
      ) {
        break
      }
      cursor = listResponse.pagination.cursor
    }
    const text = buildFileText({ triggers })
    const outPath =
      typeof flags.out === 'string' ? flags.out : 'brew-contracts.ts'

    if (flags.check === true) {
      let existing: string | null = null
      try {
        existing = readFileSync(outPath, 'utf8')
      } catch {
        existing = null
      }
      // CRLF-tolerant: an autocrlf checkout must not read as drift.
      const normalize = (value: string) => value.replaceAll('\r\n', '\n')
      if (existing === null || normalize(existing) !== normalize(text)) {
        return {
          data: { checked: outPath, upToDate: false },
          human:
            existing === null
              ? `${outPath} does not exist — run \`brew-cli types\` first.`
              : `${outPath} is stale — the workspace's payload contracts changed. Run \`brew-cli types\` to regenerate.`,
          // Documented drift contract: exit 1 (not the usage-error 2).
          exitCode: 1,
        }
      }
      return {
        data: { checked: outPath, upToDate: true },
        human: `${outPath} is up to date.`,
      }
    }

    writeFileSync(outPath, text)
    return {
      data: {
        out: outPath,
        triggers: triggers.length,
      },
      human: `Wrote ${outPath} (${triggers.length} trigger${triggers.length === 1 ? '' : 's'}).`,
    }
  },
})
