import {
  allowsJsx,
  matchingBracket,
  stringValue,
  type Token,
  tokenize,
} from './tokenize'
import type { Span } from './types'

/**
 * What one Resend send call asks for, read from its first argument: the
 * kind of body (`template`, `react`, `html`, `text`), the template id, the
 * React Email element and its props, the recipient expression, and every
 * field that has no Brew equivalent.
 */

export type SendKind = 'template' | 'react' | 'html' | 'text' | 'unknown'

export type ComponentUse = {
  /** `Welcome` in `<Welcome …/>` or `Welcome({ … })`; null for a variable. */
  readonly name: string | null
  readonly props: ReadonlyArray<{
    readonly name: string
    readonly value: string
  }>
  /** Spread expressions (`{...props}`). */
  readonly spreads: readonly string[]
}

export type MessageAnalysis = {
  readonly kind: SendKind
  /** A literal `template.id`; null when it is computed or absent. */
  readonly templateId: string | null
  /** `template.variables`' source. */
  readonly variables: string | null
  readonly component: ComponentUse | null
  /** The `to` expression's source. */
  readonly to: string | null
  /** Fields that do not carry over to Brew (`attachments`, `cc`, …). */
  readonly unsupported: readonly string[]
}

export type ArgumentAnalysis = {
  /** `mixed` when a batch holds several kinds. */
  readonly kind: SendKind | 'mixed'
  readonly shape: 'object' | 'array' | 'other'
  readonly messages: readonly MessageAnalysis[]
}

/** Resend fields Brew app email has no place for. */
export const UNSUPPORTED_FIELDS = [
  'attachments',
  'cc',
  'bcc',
  'headers',
  'scheduledAt',
  'scheduled_at',
] as const

type Property = {
  readonly name: string | null
  readonly from: number
  readonly to: number
  readonly spread: boolean
}

/** Top-level properties of the object literal whose `{` is at `open`. */
function objectProperties(tokens: readonly Token[], open: number): Property[] {
  const close = matchingBracket(tokens, open)
  if (close === -1) {
    return []
  }
  const properties: Property[] = []
  let index = open + 1
  while (index < close) {
    // One property: [key | ...spread] [: value] up to a top-level comma.
    let end = index
    let depth = 0
    while (end < close) {
      const token = tokens[end] as Token
      if (token.type === 'punct') {
        if (['(', '[', '{'].includes(token.value)) {
          depth += 1
        } else if ([')', ']', '}'].includes(token.value)) {
          depth -= 1
        } else if (token.value === ',' && depth === 0) {
          break
        }
      }
      end += 1
    }
    const first = tokens[index] as Token
    const count = properties.length
    if (first.type === 'punct' && first.value === '...') {
      properties.push({
        name: null,
        from: index + 1,
        to: end - 1,
        spread: true,
      })
    } else if (first.type === 'ident' || first.type === 'string') {
      const name =
        first.type === 'ident' ? first.value : (stringValue(first) ?? '')
      const second = tokens[index + 1]
      if (second?.type === 'punct' && second.value === ':') {
        properties.push({ name, from: index + 2, to: end - 1, spread: false })
      } else if (index + 1 === end) {
        properties.push({ name, from: index, to: index, spread: false })
      }
    } else if (first.type === 'punct' && first.value === '[') {
      // `['cc']: manager` names its field like `cc: manager`.
      const literal = tokens[index + 1]
      const name = literal === undefined ? null : stringValue(literal)
      const close = tokens[index + 2]
      const colon = tokens[index + 3]
      if (
        name !== null &&
        close?.type === 'punct' &&
        close.value === ']' &&
        colon?.type === 'punct' &&
        colon.value === ':'
      ) {
        properties.push({ name, from: index + 4, to: end - 1, spread: false })
      }
    }
    if (properties.length === count && index < end) {
      // A name it cannot read (`[field]: x`, a method) may be any field.
      properties.push({ name: null, from: index, to: end - 1, spread: true })
    }
    index = end + 1
  }
  return properties
}

/** Top-level elements of the array literal whose `[` is at `open`. */
function arrayElements(
  tokens: readonly Token[],
  open: number
): Array<{ readonly from: number; readonly to: number }> {
  const close = matchingBracket(tokens, open)
  if (close === -1) {
    return []
  }
  const elements: Array<{ from: number; to: number }> = []
  let from = open + 1
  let depth = 0
  for (let index = open + 1; index <= close; index += 1) {
    const token = tokens[index] as Token
    if (
      index === close ||
      (token.type === 'punct' && token.value === ',' && depth === 0)
    ) {
      if (index > from) {
        elements.push({ from, to: index - 1 })
      }
      from = index + 1
      continue
    }
    if (token.type === 'punct') {
      if (['(', '[', '{'].includes(token.value)) {
        depth += 1
      } else if ([')', ']', '}'].includes(token.value)) {
        depth -= 1
      }
    }
  }
  return elements
}

function sourceOf(
  text: string,
  tokens: readonly Token[],
  from: number,
  to: number
): string {
  const first = tokens[from]
  const last = tokens[to]
  if (first === undefined || last === undefined || to < from) {
    return ''
  }
  return text.slice(first.start, last.end).trim()
}

function componentFrom(
  text: string,
  tokens: readonly Token[],
  from: number,
  to: number
): ComponentUse {
  const first = tokens[from] as Token
  if (first.type === 'jsx') {
    const props: Array<{ name: string; value: string }> = []
    const spreads: string[] = []
    for (const attribute of first.attributes ?? []) {
      if (attribute.kind === 'spread') {
        spreads.push(attribute.value ?? '')
      } else if (attribute.name !== null) {
        props.push({
          name: attribute.name,
          value:
            attribute.kind === 'boolean' ? 'true' : (attribute.value ?? ''),
        })
      }
    }
    return { name: first.value === '' ? null : first.value, props, spreads }
  }
  // `Welcome({ name })` or `Welcome(props)`
  const open = tokens[from + 1]
  if (first.type === 'ident' && open?.type === 'punct' && open.value === '(') {
    const argOpen = tokens[from + 2]
    if (argOpen?.type === 'punct' && argOpen.value === '{') {
      const props: Array<{ name: string; value: string }> = []
      const spreads: string[] = []
      for (const property of objectProperties(tokens, from + 2)) {
        const value = sourceOf(text, tokens, property.from, property.to)
        if (property.spread) {
          spreads.push(value)
        } else if (property.name !== null) {
          props.push({ name: property.name, value })
        }
      }
      return { name: first.value, props, spreads }
    }
    return {
      name: first.value,
      props: [],
      spreads: [sourceOf(text, tokens, from + 2, to - 1)],
    }
  }
  return { name: null, props: [], spreads: [] }
}

function analyzeMessage(
  text: string,
  tokens: readonly Token[],
  open: number
): MessageAnalysis {
  const properties = objectProperties(tokens, open)
  const byName = new Map<string, Property>()
  let spread = false
  for (const property of properties) {
    if (property.spread) {
      spread = true
    } else if (property.name !== null) {
      byName.set(property.name, property)
    }
  }
  const sourceOfProperty = (name: string): string | null => {
    const property = byName.get(name)
    return property === undefined
      ? null
      : sourceOf(text, tokens, property.from, property.to)
  }
  const unsupported: string[] = UNSUPPORTED_FIELDS.filter((field) =>
    byName.has(field)
  )
  let kind: SendKind = 'unknown'
  let templateId: string | null = null
  let variables: string | null = null
  let component: ComponentUse | null = null
  const template = byName.get('template')
  if (template !== undefined) {
    kind = 'template'
    const first = tokens[template.from]
    if (first?.type === 'punct' && first.value === '{') {
      for (const property of objectProperties(tokens, template.from)) {
        if (property.name === 'id' && property.from === property.to) {
          templateId = stringValue(tokens[property.from] as Token)
        } else if (property.name === 'variables') {
          variables = sourceOf(text, tokens, property.from, property.to)
        }
      }
    }
  } else if (byName.has('react')) {
    kind = 'react'
    const react = byName.get('react') as Property
    component = componentFrom(text, tokens, react.from, react.to)
  } else if (byName.has('html')) {
    kind = 'html'
  } else if (byName.has('text')) {
    kind = 'text'
  }
  if (byName.has('html')) {
    unsupported.push('html')
  }
  if (byName.has('text') && kind !== 'template') {
    unsupported.push('text')
  }
  // A spread can carry any field (`cc`, `attachments`, another body).
  if (spread) {
    unsupported.push('...spread')
  }
  return {
    kind,
    templateId,
    variables,
    component,
    to: sourceOfProperty('to'),
    unsupported,
  }
}

const UNKNOWN_MESSAGE: MessageAnalysis = {
  kind: 'unknown',
  templateId: null,
  variables: null,
  component: null,
  to: null,
  unsupported: [],
}

/** The first argument of a send call, at `span` in the file `path`. */
export function analyzeArgument(
  fileText: string,
  span: Span,
  path: string
): ArgumentAnalysis {
  const text = fileText.slice(span.start, span.end)
  let tokens: Token[]
  try {
    tokens = tokenize(text, { jsx: allowsJsx(path) })
  } catch {
    return { kind: 'unknown', shape: 'other', messages: [UNKNOWN_MESSAGE] }
  }
  const first = tokens[0]
  if (first?.type === 'punct' && first.value === '{') {
    const message = analyzeMessage(text, tokens, 0)
    return { kind: message.kind, shape: 'object', messages: [message] }
  }
  if (first?.type === 'punct' && first.value === '[') {
    const elements = arrayElements(tokens, 0)
    // An empty batch reads as one unknown message, like any other.
    const messages =
      elements.length === 0
        ? [UNKNOWN_MESSAGE]
        : elements.map((element) => {
            const head = tokens[element.from]
            return head?.type === 'punct' && head.value === '{'
              ? analyzeMessage(text, tokens, element.from)
              : UNKNOWN_MESSAGE
          })
    const kinds = new Set(messages.map((message) => message.kind))
    const kind = kinds.size === 1 ? ([...kinds][0] as SendKind) : 'mixed'
    return { kind, shape: 'array', messages }
  }
  return { kind: 'unknown', shape: 'other', messages: [UNKNOWN_MESSAGE] }
}

/**
 * Value imports a React Email file makes from its own project (`./x`,
 * `../x`, `@/x`), and the runtime constructs a static import cannot fold
 * (hooks, `fetch`, `await`): reasons the file is migrated by hand.
 */
export function reactEmailRuntimeMarkers(text: string, path: string): string[] {
  let tokens: Token[]
  try {
    tokens = tokenize(text, { jsx: allowsJsx(path) })
  } catch {
    return ['the file could not be read']
  }
  const found = new Set<string>()
  const visit = (list: readonly Token[]): void => {
    for (let index = 0; index < list.length; index += 1) {
      const token = list[index] as Token
      if (token.children !== undefined) {
        visit(token.children)
      }
      if (token.type !== 'ident') {
        continue
      }
      const next = list[index + 1]
      const calls = next?.type === 'punct' && next.value === '('
      if (token.value === 'await' || token.value === 'async') {
        found.add(token.value)
      } else if (calls && token.value === 'fetch') {
        found.add('fetch()')
      } else if (calls && /^use[A-Z]/.test(token.value)) {
        found.add(`${token.value}()`)
      } else if (
        calls &&
        (token.value === 'setTimeout' || token.value === 'setInterval')
      ) {
        found.add(`${token.value}()`)
      }
    }
  }
  visit(tokens)
  return [...found]
}
