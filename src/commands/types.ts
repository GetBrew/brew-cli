import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

import type { components } from '../generated/openapi-types'
import { defineCommand } from '../lib/define-command'
import { CliUsageError } from '../lib/errors'
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
  return /^[0-9]/.test(base) ? `Payload${base}` : `${base}Payload`
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

function emitTriggerType(trigger: TriggerRow): string {
  const fields = trigger.payloadSchema?.fields ?? []
  const lines = fields.map((field) => {
    const optional = field.required ? '' : '?'
    return `  ${propertyKey(field.key)}${optional}: ${triggerFieldType(field.type)}`
  })
  return [
    `/** Fire: POST /v1/automations/triggers/${trigger.triggerEventId}/fire — body { payload: ${typeName(trigger.title)} } */`,
    `export type ${typeName(trigger.title)} = {`,
    ...lines,
    '}',
  ].join('\n')
}

function scalarType(node: VariableTreeNode): string {
  if (node.inferredType === 'number' || node.inferredType === 'boolean') {
    return node.inferredType
  }
  return 'string'
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

function emitTransactionalType(row: TransactionalEmail): string {
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
  const name = typeName(row.transactionId)
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

function buildFileText(args: {
  triggers: ReadonlyArray<TriggerRow>
  transactionals: ReadonlyArray<TransactionalEmail>
}): string {
  const triggerBlocks = [...args.triggers]
    .sort((a, b) => a.triggerEventId.localeCompare(b.triggerEventId))
    .map(emitTriggerType)
  const transactionalBlocks = [...args.transactionals]
    .sort((a, b) => a.transactionId.localeCompare(b.transactionId))
    .map(emitTransactionalType)
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
    'Generate TypeScript payload contracts (triggers + transactional objects) into your codebase; --check is the CI drift gate',
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
    const listResponse = await rawRequest<{ data: Array<TriggerRow> }>(ctx, {
      method: 'GET',
      path: '/v1/automations/triggers?limit=100',
    })
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
    const text = buildFileText({
      transactionals,
      triggers: listResponse.data ?? [],
    })
    const outPath =
      typeof flags.out === 'string' ? flags.out : 'brew-contracts.ts'

    if (flags.check === true) {
      let existing: string
      try {
        existing = readFileSync(outPath, 'utf8')
      } catch {
        throw new CliUsageError(
          `${outPath} does not exist — run \`brew-cli types\` first.`
        )
      }
      if (existing !== text) {
        throw new CliUsageError(
          `${outPath} is stale — the workspace's payload contracts changed. Run \`brew-cli types\` to regenerate.`
        )
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
        triggers: listResponse.data?.length ?? 0,
      },
      human: `Wrote ${outPath} (${listResponse.data?.length ?? 0} trigger${(listResponse.data?.length ?? 0) === 1 ? '' : 's'}, ${transactionals.length} transactional).`,
    }
  },
})
