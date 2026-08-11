import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'

/**
 * Compares the vendored OpenAPI spec against the LIVE published spec
 * (https://brew.new/openapi/public-api-v1.yaml, passed as argv[2] after
 * download). Exit 1 on any drift so the scheduled workflow can alert.
 *   bun run scripts/check-spec-drift.ts /tmp/live-spec.yaml
 */

const livePath = process.argv[2]
if (livePath === undefined) {
  console.error('usage: check-spec-drift.ts <downloaded-live-spec.yaml>')
  process.exit(2)
}

const vendoredRaw = readFileSync(
  join(import.meta.dirname, '../openapi/public-api-v1.yaml'),
  'utf8'
)
const liveRaw = readFileSync(livePath, 'utf8')

if (vendoredRaw === liveRaw) {
  console.log('Vendored spec is byte-identical to the live published spec.')
  process.exit(0)
}

function operations(raw: string): Set<string> {
  const doc = parse(raw) as {
    paths?: Record<string, Record<string, unknown>>
  }
  const ops = new Set<string>()
  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const method of ['get', 'post', 'patch', 'delete', 'put']) {
      if (method in item) {
        ops.add(`${method.toUpperCase()} ${path}`)
      }
    }
  }
  return ops
}

const vendored = operations(vendoredRaw)
const live = operations(liveRaw)
const onlyLive = [...live].filter((op) => !vendored.has(op)).sort()
const onlyVendored = [...vendored].filter((op) => !live.has(op)).sort()

if (onlyLive.length > 0) {
  console.error(
    `LIVE API has ${onlyLive.length} operation(s) missing from this CLI's vendored spec:`
  )
  for (const op of onlyLive) {
    console.error(`  + ${op}`)
  }
}
if (onlyVendored.length > 0) {
  console.error(
    `Vendored spec has ${onlyVendored.length} operation(s) the live API no longer publishes:`
  )
  for (const op of onlyVendored) {
    console.error(`  - ${op}`)
  }
}
if (onlyLive.length === 0 && onlyVendored.length === 0) {
  console.error(
    'Operation sets match but the spec bytes differ — schemas changed upstream. Refresh openapi/public-api-v1.yaml (pnpm openapi:generate in the app repo) and run `bun run generate:types`.'
  )
}
console.error(
  'Drift means new API/MCP surface exists that this CLI does not cover. Refresh the vendored spec, regenerate types, and let the parity tests hand you the command list.'
)
process.exit(1)
