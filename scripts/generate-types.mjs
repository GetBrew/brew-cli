import fs from 'node:fs'
import openapiTS, { astToString } from 'openapi-typescript'
import ts from 'typescript'

/**
 * Wraps the openapi-typescript CLI invocation this repo used before, for one
 * reason: `TransactionalPayloadValue` is a self-referencing UNION. Emitted
 * inline as an interface member (`components["schemas"][...]` indexed
 * access inside its own union), TypeScript resolves the union eagerly and
 * fails with TS2502. The same recursion is legal as a standalone type
 * alias, so we inject the alias and point the schema member at it.
 * Everything else generates exactly as the CLI did
 * (`--default-non-nullable false`).
 */

const RECURSIVE_PAYLOAD_SCHEMA =
  '#/components/schemas/TransactionalPayloadValue'

const INJECTED_ALIAS = `/**
 * JSON template data for transactional sends (the \`payload\` field):
 * scalars, null, and arbitrarily nested arrays/objects. Scalar keys resolve
 * legacy {{ tag | fallback }} merge tags; the full tree renders via Liquid
 * as trigger.* / payload.* on Liquid-enabled workspaces. Caps enforced by
 * the API: 64 KiB serialized, 10 container levels, 250 items per array,
 * 100 top-level keys.
 */
export type TransactionalPayloadValue =
  | string
  | number
  | boolean
  | null
  | TransactionalPayloadValue[]
  | { [key: string]: TransactionalPayloadValue };
`

const specUrl = new URL('../openapi/public-api-v1.yaml', import.meta.url)
const outUrl = new URL('../src/generated/openapi-types.ts', import.meta.url)

const ast = await openapiTS(specUrl, {
  defaultNonNullable: false,
  inject: INJECTED_ALIAS,
  transform(_schemaObject, options) {
    if (options.path === RECURSIVE_PAYLOAD_SCHEMA) {
      return ts.factory.createTypeReferenceNode('TransactionalPayloadValue')
    }
  },
})

fs.writeFileSync(outUrl, astToString(ast))
console.log(`wrote ${outUrl.pathname}`)
