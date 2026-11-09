import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The subset of JSON Schema (draft-07) the shipped schemas use: `type`
 * (with `null` and arrays of types), `enum`, `const`, `required`,
 * `properties`, `additionalProperties: false`, `items`, `pattern`. Enough
 * to hold a command's JSON output to its published contract without a
 * validator dependency.
 */
type Schema = {
  readonly type?: string | readonly string[]
  readonly enum?: readonly unknown[]
  readonly const?: unknown
  readonly required?: readonly string[]
  readonly properties?: Readonly<Record<string, Schema>>
  readonly additionalProperties?: boolean
  readonly items?: Schema
  readonly pattern?: string
}

function typeOf(value: unknown): string {
  if (value === null) {
    return 'null'
  }
  if (Array.isArray(value)) {
    return 'array'
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'integer' : 'number'
  }
  return typeof value
}

function matchesType(value: unknown, type: string): boolean {
  const actual = typeOf(value)
  return actual === type || (type === 'number' && actual === 'integer')
}

export function validateSchema(
  schema: Schema,
  value: unknown,
  path = '$'
): string[] {
  const errors: string[] = []
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path}: expected ${JSON.stringify(schema.const)}`)
  }
  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    errors.push(`${path}: ${JSON.stringify(value)} is not one of the enum`)
  }
  if (schema.type !== undefined) {
    const types = typeof schema.type === 'string' ? [schema.type] : schema.type
    if (!types.some((type) => matchesType(value, type))) {
      errors.push(`${path}: expected ${types.join('|')}, got ${typeOf(value)}`)
      return errors
    }
  }
  if (
    schema.pattern !== undefined &&
    typeof value === 'string' &&
    !new RegExp(schema.pattern).test(value)
  ) {
    errors.push(`${path}: does not match ${schema.pattern}`)
  }
  if (Array.isArray(value) && schema.items !== undefined) {
    value.forEach((item, index) => {
      errors.push(
        ...validateSchema(schema.items as Schema, item, `${path}[${index}]`)
      )
    })
  }
  if (typeOf(value) === 'object') {
    const record = value as Record<string, unknown>
    for (const key of schema.required ?? []) {
      if (!(key in record)) {
        errors.push(`${path}: missing ${key}`)
      }
    }
    for (const [key, child] of Object.entries(record)) {
      const childSchema = schema.properties?.[key]
      if (childSchema !== undefined) {
        errors.push(...validateSchema(childSchema, child, `${path}.${key}`))
      } else if (schema.additionalProperties === false) {
        errors.push(`${path}: unexpected property ${key}`)
      }
    }
  }
  return errors
}

export function loadSchema(name: string): Schema {
  return JSON.parse(
    readFileSync(join(import.meta.dirname, '../../schemas', name), 'utf8')
  ) as Schema
}
