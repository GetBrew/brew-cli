/**
 * A small JavaScript / TypeScript / JSX tokenizer for the migration's code
 * scan, used when the project has no TypeScript compiler installed (and,
 * always, for reading one call's argument). It knows exactly what the scan
 * needs: comments and string contents are never mistaken for code, brackets
 * balance, and a template literal or a JSX element is ONE token whose
 * embedded expressions (`${…}`, `{…}`) are its `children`, so a caller that
 * walks one level never trips over them.
 *
 * Heuristics, documented where they live: `/` starts a regular expression
 * where an expression may start; `<` starts JSX there too (in a file that
 * may hold JSX), and an element that never closes is rolled back to a plain
 * `<`, so a TypeScript type parameter cannot swallow the rest of the file.
 */

export type TokenType =
  | 'ident'
  | 'punct'
  | 'string'
  | 'template'
  | 'number'
  | 'regex'
  | 'jsx'

export type JsxAttribute = {
  /** `null` for a spread attribute (`{...props}`). */
  readonly name: string | null
  /** The value's source: a string literal (quotes kept) or the expression inside `{}`. */
  readonly value: string | null
  readonly kind: 'string' | 'expression' | 'boolean' | 'spread'
}

export type Token = {
  readonly type: TokenType
  /** Identifier or punctuator text; a literal's raw source; a JSX tag name (`''` for a fragment). */
  readonly value: string
  readonly start: number
  readonly end: number
  /** Tokens of a template literal's `${}` or a JSX element's `{}` expressions (and nested elements). */
  readonly children?: readonly Token[]
  readonly attributes?: readonly JsxAttribute[]
}

const KEYWORDS_BEFORE_EXPRESSION = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'case',
  'do',
  'else',
  'yield',
  'await',
  'default',
  'export',
])

const MULTI_PUNCT = [
  '>>>=',
  '...',
  '===',
  '!==',
  '**=',
  '<<=',
  '>>=',
  '&&=',
  '||=',
  '??=',
  '=>',
  '==',
  '!=',
  '<=',
  '>=',
  '&&',
  '||',
  '??',
  '++',
  '--',
  '+=',
  '-=',
  '*=',
  '/=',
  '%=',
  '&=',
  '|=',
  '^=',
  '**',
  '<<',
]

class JsxBail extends Error {}

function isIdentStart(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z_$\u0080-￿]/.test(char)
}

function isIdentPart(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z0-9_$\u0080-￿]/.test(char)
}

class Lexer {
  pos = 0
  readonly text: string
  readonly jsx: boolean

  constructor(text: string, jsx: boolean) {
    this.text = text
    this.jsx = jsx
  }

  /**
   * Tokens until `closer` at this level (consumed, not emitted), or the end
   * of the text when `closer` is null. An unmatched closer at the top level
   * is emitted as punctuation.
   */
  lex(closer: '}' | null): Token[] {
    const tokens: Token[] = []
    const stack: string[] = []
    const { text } = this
    while (this.pos < text.length) {
      const char = text[this.pos] as string
      const next = text[this.pos + 1]
      if (/\s/.test(char)) {
        this.pos += 1
        continue
      }
      if (char === '/' && next === '/') {
        const end = text.indexOf('\n', this.pos)
        this.pos = end === -1 ? text.length : end
        continue
      }
      if (char === '/' && next === '*') {
        const end = text.indexOf('*/', this.pos + 2)
        this.pos = end === -1 ? text.length : end + 2
        continue
      }
      if (char === '#' && next === '!' && this.pos === 0) {
        const end = text.indexOf('\n')
        this.pos = end === -1 ? text.length : end
        continue
      }
      const start = this.pos
      if (char === '"' || char === "'") {
        this.pos = this.skipString(start, char)
        tokens.push({
          type: 'string',
          value: text.slice(start, this.pos),
          start,
          end: this.pos,
        })
        continue
      }
      if (char === '`') {
        const children: Token[] = []
        this.pos = this.skipTemplate(start, children)
        tokens.push({
          type: 'template',
          value: text.slice(start, this.pos),
          start,
          end: this.pos,
          children,
        })
        continue
      }
      if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(next ?? ''))) {
        let end = this.pos + 1
        while (end < text.length && /[0-9A-Za-z_.]/.test(text[end] as string)) {
          end += 1
        }
        this.pos = end
        tokens.push({
          type: 'number',
          value: text.slice(start, end),
          start,
          end,
        })
        continue
      }
      if (isIdentStart(char) || (char === '#' && isIdentStart(next))) {
        let end = this.pos + 1
        while (isIdentPart(text[end])) {
          end += 1
        }
        this.pos = end
        tokens.push({
          type: 'ident',
          value: text.slice(start, end),
          start,
          end,
        })
        continue
      }
      if (char === '/' && expressionMayStart(tokens)) {
        this.pos = this.skipRegex(start)
        tokens.push({
          type: 'regex',
          value: text.slice(start, this.pos),
          start,
          end: this.pos,
        })
        continue
      }
      if (
        char === '<' &&
        this.jsx &&
        expressionMayStart(tokens) &&
        (isIdentStart(next) || next === '>')
      ) {
        const element = this.tryJsx(start)
        if (element !== null) {
          tokens.push(element)
          continue
        }
      }
      if (char === '}' && stack.length === 0 && closer === '}') {
        this.pos += 1
        return tokens
      }
      if (char === '(' || char === '[' || char === '{') {
        stack.push(char)
      } else if (char === ')' || char === ']' || char === '}') {
        stack.pop()
      }
      const multi =
        char === '?' && next === '.' && !/[0-9]/.test(text[this.pos + 2] ?? '')
          ? '?.'
          : MULTI_PUNCT.find((punct) => text.startsWith(punct, this.pos))
      const value = multi ?? char
      this.pos += value.length
      tokens.push({ type: 'punct', value, start, end: this.pos })
    }
    if (closer !== null) {
      throw new JsxBail('unterminated expression')
    }
    return tokens
  }

  skipString(start: number, quote: string): number {
    const { text } = this
    let index = start + 1
    while (index < text.length) {
      const char = text[index]
      if (char === '\\') {
        index += 2
        continue
      }
      if (char === quote) {
        return index + 1
      }
      if (char === '\n') {
        return index
      }
      index += 1
    }
    return text.length
  }

  skipTemplate(start: number, children: Token[]): number {
    const { text } = this
    let index = start + 1
    while (index < text.length) {
      const char = text[index]
      if (char === '\\') {
        index += 2
        continue
      }
      if (char === '`') {
        return index + 1
      }
      if (char === '$' && text[index + 1] === '{') {
        this.pos = index + 2
        try {
          children.push(...this.lex('}'))
        } catch (error) {
          if (error instanceof JsxBail) {
            return text.length
          }
          throw error
        }
        index = this.pos
        continue
      }
      index += 1
    }
    return text.length
  }

  skipRegex(start: number): number {
    const { text } = this
    let index = start + 1
    let inClass = false
    while (index < text.length) {
      const char = text[index]
      if (char === '\\') {
        index += 2
        continue
      }
      if (char === '\n') {
        return index
      }
      if (inClass) {
        if (char === ']') {
          inClass = false
        }
      } else if (char === '[') {
        inClass = true
      } else if (char === '/') {
        index += 1
        while (isIdentPart(text[index])) {
          index += 1
        }
        return index
      }
      index += 1
    }
    return text.length
  }

  /** A JSX element at `start`, or null (position restored) when it is not one. */
  tryJsx(start: number): Token | null {
    // `<T,>() =>` and `<T extends U>` are type parameters, not elements.
    const head = /^<\s*([A-Za-z_$][\w$.:-]*)\s*(,|extends\b)?/.exec(
      this.text.slice(start, start + 200)
    )
    if (head?.[2] !== undefined) {
      return null
    }
    try {
      return this.jsxElement(start)
    } catch (error) {
      if (error instanceof JsxBail) {
        this.pos = start
        return null
      }
      throw error
    }
  }

  jsxElement(start: number): Token {
    const { text } = this
    this.pos = start + 1
    const children: Token[] = []
    const attributes: JsxAttribute[] = []
    const name = this.readJsxName()
    // Attributes.
    for (;;) {
      this.skipSpace()
      if (this.pos >= text.length) {
        throw new JsxBail('unterminated element')
      }
      if (text.startsWith('/>', this.pos)) {
        this.pos += 2
        return {
          type: 'jsx',
          value: name,
          start,
          end: this.pos,
          children,
          attributes,
        }
      }
      if (text[this.pos] === '>') {
        this.pos += 1
        break
      }
      if (text[this.pos] === '{') {
        const open = this.pos
        this.pos += 1
        children.push(...this.lex('}'))
        const inner = text.slice(open + 1, this.pos - 1).trim()
        attributes.push({
          name: null,
          value: inner.replace(/^\.\.\./, '').trim(),
          kind: 'spread',
        })
        continue
      }
      const attrName = this.readJsxName()
      if (attrName === '') {
        throw new JsxBail('not an attribute')
      }
      this.skipSpace()
      if (text[this.pos] !== '=') {
        attributes.push({ name: attrName, value: null, kind: 'boolean' })
        continue
      }
      this.pos += 1
      this.skipSpace()
      const quote = text[this.pos]
      if (quote === '"' || quote === "'") {
        const end = text.indexOf(quote, this.pos + 1)
        if (end === -1) {
          throw new JsxBail('unterminated attribute')
        }
        attributes.push({
          name: attrName,
          value: text.slice(this.pos, end + 1),
          kind: 'string',
        })
        this.pos = end + 1
        continue
      }
      if (quote === '{') {
        const open = this.pos
        this.pos += 1
        children.push(...this.lex('}'))
        attributes.push({
          name: attrName,
          value: text.slice(open + 1, this.pos - 1).trim(),
          kind: 'expression',
        })
        continue
      }
      if (quote === '<') {
        const nested = this.jsxElement(this.pos)
        children.push(nested)
        attributes.push({
          name: attrName,
          value: text.slice(nested.start, nested.end),
          kind: 'expression',
        })
        continue
      }
      throw new JsxBail('unexpected attribute value')
    }
    // Children.
    for (;;) {
      if (this.pos >= text.length) {
        throw new JsxBail('unterminated element')
      }
      if (text.startsWith('</', this.pos)) {
        const close = text.indexOf('>', this.pos)
        if (close === -1) {
          throw new JsxBail('unterminated closing tag')
        }
        const closing = text.slice(this.pos + 2, close).trim()
        if (closing !== name) {
          throw new JsxBail('mismatched closing tag')
        }
        this.pos = close + 1
        return {
          type: 'jsx',
          value: name,
          start,
          end: this.pos,
          children,
          attributes,
        }
      }
      const char = text[this.pos]
      if (char === '<') {
        children.push(this.jsxElement(this.pos))
        continue
      }
      if (char === '{') {
        this.pos += 1
        children.push(...this.lex('}'))
        continue
      }
      this.pos += 1
    }
  }

  readJsxName(): string {
    const { text } = this
    const start = this.pos
    while (
      this.pos < text.length &&
      /[\w$.:-]/.test(text[this.pos] as string)
    ) {
      this.pos += 1
    }
    return text.slice(start, this.pos)
  }

  skipSpace(): void {
    while (
      this.pos < this.text.length &&
      /\s/.test(this.text[this.pos] as string)
    ) {
      this.pos += 1
    }
  }
}

/** True where a regular expression (or JSX) may start, judged by the last token. */
function expressionMayStart(tokens: readonly Token[]): boolean {
  const last = tokens.at(-1)
  if (last === undefined) {
    return true
  }
  switch (last.type) {
    case 'ident':
      return KEYWORDS_BEFORE_EXPRESSION.has(last.value)
    case 'punct':
      return ![')', ']', '}', '++', '--'].includes(last.value)
    default:
      return false
  }
}

/**
 * Tokens of `text`. `jsx` enables JSX (every extension but `.ts`, `.mts`
 * and `.cts`, where `<` is a type argument or a comparison).
 */
export function tokenize(
  text: string,
  options: { readonly jsx: boolean }
): Token[] {
  const lexer = new Lexer(text, options.jsx)
  return lexer.lex(null)
}

/** Whether a file of this name may hold JSX. */
export function allowsJsx(path: string): boolean {
  return !/\.(?:ts|mts|cts)$/.test(path)
}

/** The index of the bracket that closes the one at `open`, or -1. */
export function matchingBracket(
  tokens: readonly Token[],
  open: number
): number {
  const pairs: Readonly<Record<string, string>> = {
    '(': ')',
    '[': ']',
    '{': '}',
  }
  const opener = tokens[open]?.value ?? ''
  const closer = pairs[opener]
  if (closer === undefined) {
    return -1
  }
  let depth = 0
  for (let index = open; index < tokens.length; index += 1) {
    const token = tokens[index] as Token
    if (token.type !== 'punct') {
      continue
    }
    if (token.value === '(' || token.value === '[' || token.value === '{') {
      depth += 1
    } else if (
      token.value === ')' ||
      token.value === ']' ||
      token.value === '}'
    ) {
      depth -= 1
      if (depth === 0) {
        return token.value === closer ? index : -1
      }
    }
  }
  return -1
}

/** A string literal token's value (simple escapes resolved). */
export function stringValue(token: Token): string | null {
  if (token.type === 'string') {
    return token.value
      .slice(1, token.value.endsWith(token.value[0] as string) ? -1 : undefined)
      .replace(/\\(.)/g, '$1')
  }
  if (token.type === 'template' && (token.children ?? []).length === 0) {
    return token.value.slice(1, -1)
  }
  return null
}

/** 1-based line and column of an offset. */
export function lineColumn(
  text: string,
  offset: number
): { readonly line: number; readonly column: number } {
  let line = 1
  let lineStart = 0
  for (let index = 0; index < offset && index < text.length; index += 1) {
    if (text[index] === '\n') {
      line += 1
      lineStart = index + 1
    }
  }
  return { line, column: offset - lineStart + 1 }
}
