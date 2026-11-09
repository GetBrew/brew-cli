import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { ALL_COMMANDS } from '../src/registry'

/**
 * Every flag on a command with a JSON request body lands on a key the spec
 * declares. Request bodies are strict (`additionalProperties: false`), so a
 * flag that writes an undeclared key makes every call that uses it fail with
 * `400 INVALID_REQUEST`: `content gif --duration` and `content generate-image
 * --model` both shipped that way, because `asSdkInput` is a type cast with no
 * runtime check. A flag named after a top-level body key, path parameter or
 * query parameter (in kebab-case) passes on its own; any other flag says in
 * MAPPED which body key it fills.
 */
type Schema = {
  $ref?: string
  properties?: Record<string, Schema>
  oneOf?: Array<Schema>
  anyOf?: Array<Schema>
  allOf?: Array<Schema>
}
type Operation = {
  parameters?: Array<{ name?: string; $ref?: string }>
  requestBody?: { content?: Record<string, { schema?: Schema }> }
}

const doc = parse(
  readFileSync(
    join(import.meta.dirname, '../openapi/public-api-v1.yaml'),
    'utf8'
  )
) as { paths?: Record<string, Record<string, Operation>> }

function resolve<T>(node: T & { $ref?: string }): T {
  if (!node.$ref) {
    return node
  }
  const target = node.$ref
    .split('/')
    .slice(1)
    .reduce<unknown>(
      (value, key) => (value as Record<string, unknown>)[key],
      doc
    )
  return resolve(target as T & { $ref?: string })
}

/** Dotted paths of every property a body schema declares, branches included. */
function bodyKeys(
  node: Schema | undefined,
  prefix = '',
  out = new Set<string>()
): Set<string> {
  if (!node) {
    return out
  }
  const schema = resolve(node)
  for (const [key, child] of Object.entries(schema.properties ?? {})) {
    out.add(`${prefix}${key}`)
    bodyKeys(child, `${prefix}${key}.`, out)
  }
  for (const branch of [
    ...(schema.oneOf ?? []),
    ...(schema.anyOf ?? []),
    ...(schema.allOf ?? []),
  ]) {
    bodyKeys(branch, prefix, out)
  }
  return out
}

/** CLI-side flags that never become body keys on any command. */
const CLI_FLAGS = new Set(['--input', '--idempotency-key', '--yes'])

/**
 * Flags named differently from the body key they fill (a dotted path), or
 * `null` for a flag the CLI handles itself and never sends.
 */
const MAPPED: Readonly<
  Record<string, Readonly<Record<string, string | null>>>
> = {
  'contacts search': {
    '--filter': 'filters',
    '--audience': 'audienceId',
    '--all': null, // follows the cursor client-side
  },
  'contacts count': { '--filter': 'filters', '--audience': 'audienceId' },
  'contacts count-by': { '--filter': 'filters', '--audience': 'audienceId' },
  'contacts upsert': { '--custom': 'customFields' },
  'contacts update': {
    '--first-name': 'fields',
    '--last-name': 'fields',
    '--subscribed': 'fields',
    '--set': 'fields',
  },
  'contacts import': {
    '--file': 'contacts',
    '--consent-source': 'consent.source',
  },
  'contacts import-csv': {
    '--file': 'csv',
    '--consent-source': 'consent.source',
  },
  'fields create': { '--name': 'fieldName', '--type': 'fieldType' },
  'emails import': { '--file': 'content' },
  'emails import-figma': { '--url': 'figmaUrl' },
  'emails edit': { '--clear-lang': 'lang', '--ungroup': 'groupId' },
  'emails restore': { '--to-version': 'emailVersionId' },
  'emails audit': { '--file': 'emailHtml', '--jsx-file': 'emailJsx' },
  'emails create-inbox-placement-test': { '--domain': 'domainId' },
  'emails send': {
    '--audience': 'audienceId',
    '--domain': 'domainId',
    '--schedule-at': 'scheduledAt',
  },
  'audiences update': {
    '--add-email': 'addEmails',
    '--remove-email': 'removeEmails',
  },
  'audiences from-events': {
    '--event-types': 'cohort.eventTypes',
    '--since': 'cohort.from',
    '--until': 'cohort.to',
    '--send-id': 'cohort.sendId',
    '--email-id': 'cohort.emailId',
  },
  'automations create': { '--trigger': 'triggerEventId' },
  'automations update': { '--trigger': 'triggerEventId' },
  'automations publish': { '--automation-version': 'automationVersionId' },
  'automations run': { '--schedule-at': 'scheduledAt' },
  'domains unsubscribes add': { '--email': 'emails' },
  'domains unsubscribes import': { '--file': 'csv' },
  'content transform': { '--url': 'imageUrl' },
  'content html-to-png': { '--file': 'html' },
  'content add-image': { '--url': 'imageUrl' },
  'canvas sessions create': {
    '--group-id': 'target.groupId',
    '--email-id': 'target.emailId',
    '--user-id': 'user.externalId',
    '--user-name': 'user.name',
    '--read-only': 'permissions',
  },
  send: { '--to': 'payload', '--data': 'payload' },
  'app-emails upsert': {
    '--source-file': 'source.content',
    '--format': 'source.format',
    '--domain': 'domainId',
    '--no-publish': 'publish',
  },
  'app-emails kit': { '--domain': 'domainId' },
  'integrations connect': {
    '--signing-secret-env': 'signingSecret',
    '--signing-secret-stdin': 'signingSecret',
    '--project-url': 'settings.projectUrl',
  },
}

type Command = (typeof ALL_COMMANDS)[number]

const nameOf = (command: Command): string => command.path.join(' ')

const camel = (flag: string): string =>
  flag
    .replace(/^--/, '')
    .replace(/-([a-z0-9])/g, (_, letter) => letter.toUpperCase())

const flagNames = (command: Command): Array<string> =>
  (command.flags ?? []).map((flag) => flag.flag.split(' ')[0] ?? '')

/** The operation's JSON body keys and parameter names, if it takes a body. */
function contract(
  command: Command
): { keys: Set<string>; parameters: Set<string> } | undefined {
  const operation = command.route
    ? doc.paths?.[command.route.path]?.[command.route.method.toLowerCase()]
    : undefined
  const schema = operation?.requestBody?.content?.['application/json']?.schema
  if (!(operation && schema)) {
    return
  }
  return {
    keys: bodyKeys(schema),
    parameters: new Set(
      (operation.parameters ?? []).flatMap((parameter) => {
        const name = resolve(parameter).name
        return name ? [name] : []
      })
    ),
  }
}

describe('body flags', () => {
  const withBody = ALL_COMMANDS.filter((command) => contract(command))

  it('write only keys the request body declares', () => {
    expect(withBody.length).toBeGreaterThan(20)
    const undeclared = withBody.flatMap((command) => {
      const { keys, parameters } = contract(command) ?? {
        keys: new Set<string>(),
        parameters: new Set<string>(),
      }
      const mapped = MAPPED[nameOf(command)] ?? {}
      return flagNames(command).flatMap((flag) => {
        const key = camel(flag)
        const declared =
          CLI_FLAGS.has(flag) ||
          flag in mapped ||
          keys.has(key) ||
          parameters.has(key)
        return declared ? [] : [`${nameOf(command)}: ${flag} (${key})`]
      })
    })
    expect(undeclared).toEqual([])
  })

  it('keep their MAPPED entries current', () => {
    const byName = new Map(
      ALL_COMMANDS.map((command) => [nameOf(command), command])
    )
    const stale: Array<string> = []
    for (const [name, flags] of Object.entries(MAPPED)) {
      const command = byName.get(name)
      const body = command ? contract(command) : undefined
      if (!(command && body)) {
        stale.push(`MAPPED ${name}: no command with a JSON body`)
        continue
      }
      for (const [flag, key] of Object.entries(flags)) {
        if (!flagNames(command).includes(flag)) {
          stale.push(`MAPPED ${name}: ${flag} is not a flag`)
        } else if (key !== null && !body.keys.has(key)) {
          stale.push(`MAPPED ${name}: ${flag} → ${key} is not in the body`)
        }
      }
    }
    expect(stale).toEqual([])
  })
})
