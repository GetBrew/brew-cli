import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

import type { components } from '../generated/openapi-types'
import { defineCommand } from '../lib/define-command'
import { rawRequest } from '../lib/raw-request'

type TriggerRow = components['schemas']['TriggerRow']
type TransactionalEmail = components['schemas']['TransactionalEmail']
type VariableTreeNode = NonNullable<
  TransactionalEmail['variableTree']
>[number] & {
  inferredType?: 'string' | 'number' | 'boolean'
}

/**
 * `brew-cli types` — generate TypeScript payload contracts for this
 * workspace's triggers (declared `payloadSchema`) and any transactional
 * objects (`--transaction txn_…`, contract derived from the pinned
 * template's `variableTree`). Deterministic output: same inputs → the
 * same bytes, with a content hash in the header so `--check` works as a
 * CI drift gate (exit 1 when the API's contracts no longer match the
 * committed file).
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

function triggerFieldType(type: string): string {
  if (type === 'int') {
    return 'number'
  }
  if (type === 'boolean') {
    return 'boolean'
  }
  return 'string'
}

function emitTriggerType(trigger: TriggerRow, name: string): string {
  const fields = trigger.payloadSchema?.fields ?? []
  const lines = fields.map((field) => {
    const optional = field.required ? '' : '?'
    return `  ${propertyKey(field.key)}${optional}: ${triggerFieldType(field.type)}`
  })
  const body =
    fields.length === 0
      ? `export type ${name} = Record<string, never>`
      : [`export type ${name} = {`, ...lines, '}'].join('\n')
  return [
    `/** Fire: POST /v1/automations/triggers/${trigger.triggerEventId}/fire — body { payload: ${name} } */`,
    body,
  ].join('\n')
}

function scalarType(node: VariableTreeNode): string {
  if (node.inferredType === 'number' || node.inferredType === 'boolean') {
    return node.inferredType
  }
  if (node.inferredType === 'string') {
    return 'string'
  }
  // A `| default:` fallback is string evidence; a bare reference says
  // nothing — the app emits `unknown` for those, so this file must too.
  return node.fallback === null ? 'unknown' : 'string'
}

function emitTreeNode(node: VariableTreeNode, indent: string): string {
  // A template reference without a `| default:` fallback fails strict
  // fires when omitted — that is this plane's definition of required.
  const optional = node.fallback === null ? '' : '?'
  const key = `${indent}${propertyKey(node.key)}${optional}: `
  if (node.kind === 'object') {
    const children = (node.children as ReadonlyArray<VariableTreeNode>) ?? []
    return `${key}{\n${children
      .map((child) => emitTreeNode(child, `${indent}  `))
      .join('\n')}\n${indent}}`
  }
  if (node.kind === 'array') {
    const children = (node.children as ReadonlyArray<VariableTreeNode>) ?? []
    if (children.length === 0) {
      return `${key}Array<unknown>`
    }
    return `${key}Array<{\n${children
      .map((child) => emitTreeNode(child, `${indent}  `))
      .join('\n')}\n${indent}}>`
  }
  return `${key}${scalarType(node)}`
}

function emitTransactionalType(row: TransactionalEmail, name: string): string {
  const roots = (row.variableTree ?? []) as ReadonlyArray<VariableTreeNode>
  // Namespace split mirrors the app's contract view: `customer.*` resolves
  // from the recipient contact (never sent); `trigger`/`payload` roots
  // unwrap — their children ARE the payload's top-level keys.
  const payloadNodes: Array<VariableTreeNode> = []
  for (const root of roots) {
    if (root.namespace === 'customer') {
      continue
    }
    if (root.key === 'trigger' || root.key === 'payload') {
      payloadNodes.push(
        ...((root.children as ReadonlyArray<VariableTreeNode>) ?? [])
      )
      continue
    }
    payloadNodes.push(root)
  }
  const body =
    payloadNodes.length === 0
      ? `export type ${name} = Record<string, never>`
      : `export type ${name} = {\n${payloadNodes
          .map((node) => emitTreeNode(node, '  '))
          .join('\n')}\n}`
  return [
    `/** Fire: POST /v1/sends — body { transactionId: ${JSON.stringify(row.transactionId)}, to, payload: ${name} } */`,
    body,
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
 * Titles/subjects share one flat namespace and carry no uniqueness
 * constraint — colliding names get the subject id appended (then a
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

function buildFileText(args: {
  triggers: ReadonlyArray<TriggerRow>
  transactionals: ReadonlyArray<TransactionalEmail>
}): string {
  const triggers = [...args.triggers].sort((a, b) =>
    byCodepoint(a.triggerEventId, b.triggerEventId)
  )
  const transactionals = [...args.transactionals].sort((a, b) =>
    byCodepoint(a.transactionId, b.transactionId)
  )
  // ONE name pass across both planes: same rule as the app
  // (name || id), collisions resolved deterministically.
  const names = uniqueNames([
    ...triggers.map((t) => ({ id: t.triggerEventId, label: t.title })),
    ...transactionals.map((t) => ({
      id: t.transactionId,
      label: t.subject?.trim() || t.transactionId,
    })),
  ])
  const triggerBlocks = triggers.map((t, i) =>
    emitTriggerType(t, names[i] ?? typeName(t.title))
  )
  const transactionalBlocks = transactionals.map((t, i) =>
    emitTransactionalType(
      t,
      names[triggers.length + i] ?? typeName(t.transactionId)
    )
  )
  const body = [
    '// Generated by `brew-cli types` — do not edit by hand.',
    '// Re-run `brew-cli types` after changing a trigger schema or a',
    '// transactional design; gate drift in CI with `brew-cli types --check`.',
    '',
    [...triggerBlocks, ...transactionalBlocks].join('\n\n'),
    '',
  ].join('\n')
  const hash = createHash('sha256').update(body).digest('hex')
  return `${HEADER_PREFIX}${hash}\n${body}`
}

export const typesCommand = defineCommand({
  path: ['types'],
  summary:
    'Generate TypeScript payload contracts (triggers + transactional objects) into your codebase; --check is the CI drift gate (exit 1 on drift). Needs the automations scope; --transaction also needs sends',
  sdkMethod: null,
  isRawTransport: true,
  route: { method: 'GET', path: '/v1/automations/triggers' },
  commandClass: 'read',
  flags: [
    {
      flag: '--out <file>',
      summary: 'Output file (default brew-contracts.ts)',
      defaultValue: 'brew-contracts.ts',
    },
    {
      flag: '--transaction <transactionIds...>',
      summary:
        'Transactional object ids (txn_…) to include, contract derived from each pinned template',
    },
    {
      flag: '--check',
      summary:
        'Verify the output file is up to date instead of writing; exits 1 on drift',
    },
  ],
  examples: [
    'brew-cli types',
    'brew-cli types --out src/brew-contracts.ts --transaction txn_8fK2mQ4pLx',
    'brew-cli types --check',
  ],
  run: async ({ ctx, flags }) => {
    // Follow the cursor to the end — a silent 100-trigger cap would make
    // `--check` certify an incomplete file (integration catalogs alone
    // can cross 100). The page ceiling is a runaway-loop backstop only.
    const triggers: Array<TriggerRow> = []
    let cursor: string | null = null
    for (let page = 0; page < 50; page++) {
      const url: string = cursor
        ? `/v1/automations/triggers?limit=100&cursor=${encodeURIComponent(cursor)}`
        : '/v1/automations/triggers?limit=100'
      const listResponse: {
        data: Array<TriggerRow>
        pagination?: { cursor: string | null; hasMore: boolean }
      } = await rawRequest(ctx, { method: 'GET', path: url })
      triggers.push(...(listResponse.data ?? []))
      if (
        !listResponse.pagination?.hasMore ||
        !listResponse.pagination.cursor
      ) {
        break
      }
      cursor = listResponse.pagination.cursor
    }
    const transactionIds = Array.isArray(flags.transaction)
      ? (flags.transaction as Array<string>)
      : []
    const transactionals: Array<TransactionalEmail> = []
    for (const transactionId of transactionIds) {
      transactionals.push(
        await rawRequest<TransactionalEmail>(ctx, {
          method: 'GET',
          path: `/v1/transactional/${encodeURIComponent(transactionId)}`,
        })
      )
    }
    const text = buildFileText({ transactionals, triggers })
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
        transactionals: transactionals.length,
        triggers: triggers.length,
      },
      human: `Wrote ${outPath} (${triggers.length} trigger${triggers.length === 1 ? '' : 's'}, ${transactionals.length} transactional).`,
    }
  },
})
