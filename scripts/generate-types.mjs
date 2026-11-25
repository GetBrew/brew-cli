import fs from 'node:fs'
import openapiTS, { astToString } from 'openapi-typescript'
import ts from 'typescript'
import { parse } from 'yaml'

const RECURSIVE_PAYLOAD_SCHEMA = '#/components/schemas/SendPayloadValue'

const INJECTED_ALIAS = `export type SendPayloadValue =
  | string
  | number
  | boolean
  | null
  | SendPayloadValue[]
  | { [key: string]: SendPayloadValue };
`

const specUrl = new URL('../openapi/public-api-v1.yaml', import.meta.url)
const outUrl = new URL('../src/generated/openapi-types.ts', import.meta.url)

const ast = await openapiTS(specUrl, {
  defaultNonNullable: false,
  inject: INJECTED_ALIAS,
  transform(_schemaObject, options) {
    if (options.path === RECURSIVE_PAYLOAD_SCHEMA) {
      return ts.factory.createTypeReferenceNode('SendPayloadValue')
    }
  },
})

fs.writeFileSync(
  outUrl,
  astToString(ast, { formatOptions: { removeComments: true } })
)
console.log(`wrote ${outUrl.pathname}`)

const keysUrl = new URL('../src/generated/input-keys.ts', import.meta.url)
const doc = parse(fs.readFileSync(specUrl, 'utf8'))

function resolve(node) {
  let current = node
  while (current?.$ref) {
    current = current.$ref
      .slice(2)
      .split('/')
      .reduce((parent, key) => parent[key], doc)
  }
  return current
}

function bodyKeys(schemaNode, seen = new Set()) {
  const schema = resolve(schemaNode)
  if (schema === undefined || seen.has(schema)) return []
  seen.add(schema)
  const variants = [
    ...(schema.allOf ?? []),
    ...(schema.oneOf ?? []),
    ...(schema.anyOf ?? []),
  ]
  const isOpen =
    (schema.additionalProperties !== undefined &&
      schema.additionalProperties !== false) ||
    (schema.properties === undefined &&
      variants.length === 0 &&
      schema.type !== 'object')
  if (isOpen) return null
  const keys = Object.keys(schema.properties ?? {})
  for (const variant of variants) {
    const nested = bodyKeys(variant, seen)
    if (nested === null) return null
    keys.push(...nested)
  }
  return keys
}

const inputKeys = {}
for (const [path, item] of Object.entries(doc.paths ?? {})) {
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const operation = item[method]
    if (operation === undefined) continue
    const keys = [...(item.parameters ?? []), ...(operation.parameters ?? [])]
      .map(resolve)
      .filter((param) => param.in === 'path' || param.in === 'query')
      .map((param) => param.name)
    if (operation.requestBody !== undefined) {
      const schema = resolve(operation.requestBody).content?.[
        'application/json'
      ]?.schema
      const body = schema === undefined ? null : bodyKeys(schema)
      if (body === null) continue
      keys.push(...body)
    }
    inputKeys[`${method.toUpperCase()} ${path}`] = [...new Set(keys)].sort()
  }
}

const sorted = Object.fromEntries(
  Object.entries(inputKeys).sort(([a], [b]) => a.localeCompare(b))
)
fs.writeFileSync(
  keysUrl,
  `export const INPUT_KEYS: Readonly<Record<string, readonly string[]>> = ${JSON.stringify(sorted, null, 2)}\n`
)
console.log(`wrote ${keysUrl.pathname}`)
