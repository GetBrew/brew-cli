import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

import type {
  BrewClient,
  ListTriggersInput,
  ListTriggersResponse,
  Trigger,
} from '@brew.new/sdk'
import { defineCommand } from '../lib/define-command'
import { asSdkInput } from '../lib/input'
import { getInvocationPrefix } from '../lib/invocation'

type TriggerRow = Trigger

/**
 * `brew-cli types` — generate TypeScript payload contracts for this
 * workspace's authoritative trigger contracts. Deterministic output:
 * same inputs → the same bytes, with a content hash in the header so
 * `--check` works as a CI drift gate (exit 1 when the API's contracts no
 * longer match the committed file).
 */

const HEADER_PREFIX = '// brew:contracts sha256:'

export type ContractArtifact = {
  readonly triggerEventId: string
  readonly typeName: string
  readonly content: string
  /** The trigger's developer key (`order.paid`), when it has one. */
  readonly key?: string
}

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

function propertyKey(key: string): string {
  return IDENTIFIER_RE.test(key) ? key : JSON.stringify(key)
}

/** Trigger ids supply deterministic suffixes when stored type names collide. */
function identifierSuffix(value: string): string {
  return value
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

/** Only declaration identifiers are renamed; field names and literals are untouched. */
function emitArtifact(artifact: ContractArtifact, name: string): string {
  const escapedName = artifact.typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const declaration = new RegExp(`^export type ${escapedName} =`, 'm')
  if (!declaration.test(artifact.content)) {
    throw new Error(
      `Contract ${artifact.triggerEventId} did not contain its declared TypeScript type.`
    )
  }
  return artifact.content
    .replace(declaration, () => `export type ${name} =`)
    .replace(
      new RegExp(`^export const ${escapedName}ContractHash =`, 'm'),
      () => `export const ${name}ContractHash =`
    )
    .trimEnd()
}

/** Byte-stable ordering — `localeCompare` varies by host locale. */
function byCodepoint(a: string, b: string): number {
  if (a < b) {
    return -1
  }
  return a > b ? 1 : 0
}

/**
 * Stored type names share one flat namespace and carry no uniqueness
 * constraint — colliding names get the trigger id appended (then a
 * numeric suffix as a last resort) so the generated file always compiles.
 */
function uniqueNames(
  entries: ReadonlyArray<{ label: string; id: string }>
): Array<string> {
  const taken = new Map<string, number>()
  return entries.map(({ label, id }) => {
    let name = label
    if (taken.has(name)) {
      const suffixed = `${name}${identifierSuffix(id)}`
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

/**
 * The `BrewTriggerKeyRegistry` augmentation for every keyed trigger, so
 * `brew.send('order.paid', …)` type-checks its key and payload. Empty (no
 * block at all) when no trigger has a key: the file stays byte-identical to
 * what a key-less workspace always produced.
 */
function registryBlock(
  entries: ReadonlyArray<{ key: string | undefined; name: string }>
): string | undefined {
  const keyed = entries
    .flatMap((entry) =>
      entry.key === undefined || entry.key === ''
        ? []
        : [{ key: entry.key, name: entry.name }]
    )
    .sort((a, b) => byCodepoint(a.key, b.key))
  if (keyed.length === 0) {
    return
  }
  return [
    '/** `brew.send(key, payload)` checks the key and its payload against these. */',
    "declare module '@brew.new/sdk' {",
    '  interface BrewTriggerKeyRegistry {',
    ...keyed.map(({ key, name }) => `    ${propertyKey(key)}: ${name}`),
    '  }',
    '}',
  ].join('\n')
}

/**
 * The generated contracts file: one payload type per trigger contract, plus
 * the `BrewTriggerKeyRegistry` augmentation for keyed triggers unless
 * `registry` is false. Deterministic: same contracts, same bytes.
 */
export function buildContractsFile(args: {
  readonly artifacts: ReadonlyArray<ContractArtifact>
  readonly registry?: boolean
}): string {
  const artifacts = [...args.artifacts].sort((a, b) =>
    byCodepoint(a.triggerEventId, b.triggerEventId)
  )
  // Type names come from the authoritative contract; only collisions need aliases.
  const names = uniqueNames(
    artifacts.map((artifact) => ({
      id: artifact.triggerEventId,
      label: artifact.typeName,
    }))
  )
  const triggerBlocks = artifacts.map((artifact, i) =>
    emitArtifact(artifact, names[i] ?? artifact.typeName)
  )
  const registry =
    args.registry === false
      ? undefined
      : registryBlock(
          artifacts.map((artifact, i) => ({
            key: artifact.key,
            name: names[i] ?? artifact.typeName,
          }))
        )
  const body = [
    '// Generated by `brew-cli types` — do not edit by hand.',
    '// Re-run `brew-cli types` after changing a trigger schema; gate',
    '// drift in CI with `brew-cli types --check`.',
    '',
    triggerBlocks.join('\n\n'),
    ...(registry === undefined ? [] : ['', registry]),
    '',
  ].join('\n')
  const hash = createHash('sha256').update(body).digest('hex')
  return `${HEADER_PREFIX}${hash}\n${body}`
}

/**
 * Every trigger in the brand, following the cursor to the end: a silent
 * 100-trigger cap would make `--check` certify an incomplete file
 * (integration catalogs alone can cross 100). The page ceiling is a
 * runaway-loop backstop only.
 */
export async function listAllTriggers(
  client: BrewClient
): Promise<Array<TriggerRow>> {
  const triggers: Array<TriggerRow> = []
  let cursor: string | null = null
  for (let page = 0; page < 50; page++) {
    const listResponse: ListTriggersResponse =
      await client.automations.triggers.list(
        asSdkInput<ListTriggersInput>({
          limit: 100,
          ...(cursor === null ? {} : { cursor }),
        })
      )
    triggers.push(...(listResponse.data ?? []))
    if (!listResponse.pagination?.hasMore || !listResponse.pagination.cursor) {
      cursor = null
      break
    }
    cursor = listResponse.pagination.cursor
  }
  if (cursor !== null) {
    throw new Error(
      'Trigger pagination exceeded the safety limit; no output was written.'
    )
  }
  return triggers
}

/**
 * The authoritative TypeScript contract of every trigger, eight requests at
 * a time, each tagged with the trigger's key for the send registry.
 */
export async function fetchContractArtifacts(
  client: BrewClient,
  triggers: ReadonlyArray<TriggerRow>,
  signal?: AbortSignal
): Promise<Array<ContractArtifact>> {
  const artifacts: Array<ContractArtifact> = []
  for (let index = 0; index < triggers.length; index += 8) {
    signal?.throwIfAborted()
    const batch = await Promise.all(
      triggers.slice(index, index + 8).map(async (trigger) => {
        const contract = await client.automations.triggers.getContract({
          triggerEventId: trigger.triggerEventId,
          format: 'ts',
        })
        if (
          contract.format !== 'ts' ||
          typeof contract.content !== 'string' ||
          !IDENTIFIER_RE.test(contract.typeName)
        ) {
          throw new Error(
            `Unexpected TypeScript contract response for ${trigger.triggerEventId}.`
          )
        }
        return {
          triggerEventId: trigger.triggerEventId,
          typeName: contract.typeName,
          content: contract.content,
          ...(typeof trigger.key === 'string' && trigger.key !== ''
            ? { key: trigger.key }
            : {}),
        }
      })
    )
    artifacts.push(...batch)
  }
  return artifacts
}

export const typesCommand = defineCommand({
  path: ['types'],
  summary:
    "Generate TypeScript payload contracts for this workspace's triggers (plus the brew.send key registry for keyed triggers) into your codebase; --check is the CI drift gate (exit 1 on drift). Needs the automations scope",
  sdkMethod: null,
  derivedFrom: [
    'automations.triggers.list',
    'automations.triggers.getContract',
  ],
  commandClass: 'read',
  flags: [
    {
      flag: '--out <file>',
      summary: 'Output file (default brew-contracts.ts)',
      defaultValue: 'brew-contracts.ts',
    },
    {
      flag: '--no-registry',
      summary:
        "Leave out the BrewTriggerKeyRegistry augmentation for keyed triggers (for code that does not use @brew.new/sdk's send)",
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
    const client = ctx.client()
    const triggers = await listAllTriggers(client)
    const artifacts = await fetchContractArtifacts(client, triggers, ctx.signal)
    const text = buildContractsFile({
      artifacts,
      registry: flags.registry !== false,
    })
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
              ? `${outPath} does not exist — run \`${getInvocationPrefix(ctx.io.env)} types\` first.`
              : `${outPath} is stale — the workspace's payload contracts changed. Run \`${getInvocationPrefix(ctx.io.env)} types\` to regenerate.`,
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
