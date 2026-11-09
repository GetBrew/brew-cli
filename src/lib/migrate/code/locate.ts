import {
  allowsJsx,
  lineColumn,
  matchingBracket,
  memberAt,
  stringValue,
  type Token,
  tokenize,
} from './tokenize'
import type {
  CallLocation,
  ClientSite,
  FileLocations,
  LocalImport,
  ResendImport,
} from './types'

/**
 * The tokenizer engine of the code scan: Resend imports, `new Resend(…)`
 * clients (and the names they are bound and exported under), and
 * `.emails.send(…)` / `.batch.send(…)` calls. The TypeScript engine
 * (`locate-typescript.ts`) answers the same questions from a real syntax
 * tree when the project has a compiler installed.
 */

const RESEND_MODULE = 'resend'
const DECLARATIONS = new Set(['const', 'let', 'var'])
const CLASS_MODIFIERS = new Set([
  'private',
  'public',
  'protected',
  'readonly',
  'static',
  'declare',
  'override',
])

/** A relative or project-alias specifier (`./x`, `../x`, `@/x`, `~/x`). */
export function isProjectSpecifier(specifier: string): boolean {
  return /^(?:\.{1,2}\/|@\/|~\/)/.test(specifier)
}

function isPunct(token: Token | undefined, value: string): boolean {
  return token?.type === 'punct' && token.value === value
}

function isIdent(token: Token | undefined, value?: string): boolean {
  return (
    token?.type === 'ident' && (value === undefined || token.value === value)
  )
}

function isDot(token: Token | undefined): boolean {
  return isPunct(token, '.') || isPunct(token, '?.')
}

/** The index of the bracket that opens the one at `close`, or -1. */
function matchingOpen(tokens: readonly Token[], close: number): number {
  let depth = 0
  for (let index = close; index >= 0; index -= 1) {
    const token = tokens[index] as Token
    if (token.type !== 'punct') {
      continue
    }
    if ([')', ']', '}'].includes(token.value)) {
      depth += 1
    } else if (['(', '[', '{'].includes(token.value)) {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }
  return -1
}

/** The first argument inside the parentheses at `open`: its token range. */
function firstArgument(
  tokens: readonly Token[],
  open: number
): { readonly from: number; readonly to: number } | null {
  const close = matchingBracket(tokens, open)
  if (close === -1 || close === open + 1) {
    return null
  }
  let depth = 0
  for (let index = open + 1; index < close; index += 1) {
    const token = tokens[index] as Token
    if (token.type === 'punct') {
      if (['(', '[', '{'].includes(token.value)) {
        depth += 1
      } else if ([')', ']', '}'].includes(token.value)) {
        depth -= 1
      } else if (token.value === ',' && depth === 0) {
        return { from: open + 1, to: index - 1 }
      }
    }
  }
  return { from: open + 1, to: close - 1 }
}

type ImportClause = {
  readonly defaultLocal: string | null
  readonly namespace: string | null
  readonly named: ReadonlyArray<{
    readonly imported: string
    readonly local: string
    readonly typeOnly: boolean
  }>
}

function parseImportClause(tokens: readonly Token[]): ImportClause {
  let defaultLocal: string | null = null
  let namespace: string | null = null
  const named: Array<{ imported: string; local: string; typeOnly: boolean }> =
    []
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] as Token
    if (isPunct(token, '*') && isIdent(tokens[index + 1], 'as')) {
      namespace = tokens[index + 2]?.value ?? null
      index += 2
      continue
    }
    if (isPunct(token, '{')) {
      const close = tokens.findIndex(
        (candidate, at) => at > index && isPunct(candidate, '}')
      )
      const inner = tokens.slice(index + 1, close === -1 ? undefined : close)
      let element: Token[] = []
      const flush = (): void => {
        if (element.length === 0) {
          return
        }
        const typeOnly =
          isIdent(element[0], 'type') &&
          element.length > 1 &&
          !isIdent(element[1], 'as')
        const parts = typeOnly ? element.slice(1) : element
        const imported = stringValue(parts[0] as Token) ?? parts[0]?.value ?? ''
        const asIndex = parts.findIndex((part) => isIdent(part, 'as'))
        const local =
          asIndex === -1 ? imported : (parts[asIndex + 1]?.value ?? imported)
        named.push({ imported, local, typeOnly })
        element = []
      }
      for (const part of inner) {
        if (isPunct(part, ',')) {
          flush()
        } else {
          element.push(part)
        }
      }
      flush()
      index = close === -1 ? tokens.length : close
      continue
    }
    if (token.type === 'ident' && defaultLocal === null && namespace === null) {
      defaultLocal = token.value
    }
  }
  return { defaultLocal, namespace, named }
}

/** `{ Resend, Resend: R, a }` → elements (property → local). */
function parseObjectPattern(
  tokens: readonly Token[]
): ReadonlyArray<{ readonly imported: string; readonly local: string }> {
  const out: Array<{ imported: string; local: string }> = []
  let element: Token[] = []
  const flush = (): void => {
    const [first, colon, second] = element
    if (first?.type === 'ident') {
      out.push({
        imported: first.value,
        local:
          isPunct(colon, ':') && second?.type === 'ident'
            ? second.value
            : first.value,
      })
    }
    element = []
  }
  for (const token of tokens) {
    if (isPunct(token, ',')) {
      flush()
    } else {
      element.push(token)
    }
  }
  flush()
  return out
}

/** Whether the `{` at `open` starts a class body. */
function isClassBody(tokens: readonly Token[], open: number): boolean {
  for (let index = open - 1; index >= 0 && index >= open - 40; index -= 1) {
    const token = tokens[index] as Token
    if (isIdent(token, 'class')) {
      return true
    }
    if (
      token.type === 'ident' ||
      token.type === 'string' ||
      ['.', '<', '>', ',', '?.', '[', ']'].includes(token.value)
    ) {
      continue
    }
    return false
  }
  return false
}

type Collected = {
  imports: ResendImport[]
  localImports: LocalImport[]
  exports: Array<{ local: string; exported: string }>
  importInsertAt: number
  esm: boolean
  cjs: boolean
  relativeImportsUseJs: boolean
}

function collectModuleSyntax(
  tokens: readonly Token[],
  collected: Collected
): void {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] as Token
    // import … from '…' / import '…'
    if (
      isIdent(token, 'import') &&
      !isPunct(tokens[index + 1], '(') &&
      !isDot(tokens[index + 1])
    ) {
      let at = index + 1
      let typeOnly = false
      if (
        isIdent(tokens[at], 'type') &&
        !isIdent(tokens[at + 1], 'from') &&
        !isPunct(tokens[at + 1], ',')
      ) {
        typeOnly = true
        at += 1
      }
      let specifierIndex = -1
      let clause: Token[] = []
      if (tokens[at]?.type === 'string') {
        specifierIndex = at
      } else {
        const fromIndex = tokens.findIndex(
          (candidate, position) =>
            position > at &&
            isIdent(candidate, 'from') &&
            tokens[position + 1]?.type === 'string'
        )
        if (fromIndex === -1) {
          continue
        }
        clause = tokens.slice(at, fromIndex)
        if (clause.some((part) => isPunct(part, ';'))) {
          continue
        }
        specifierIndex = fromIndex + 1
      }
      const specifierToken = tokens[specifierIndex] as Token
      const specifier = stringValue(specifierToken) ?? ''
      collected.esm = true
      const statementEnd = isPunct(tokens[specifierIndex + 1], ';')
        ? (tokens[specifierIndex + 1] as Token).end
        : specifierToken.end
      collected.importInsertAt = Math.max(
        collected.importInsertAt,
        statementEnd
      )
      const parsed = parseImportClause(clause)
      if (specifier === RESEND_MODULE) {
        collected.imports.push({
          kind: 'esm',
          specifier: { start: specifierToken.start, end: specifierToken.end },
          typeOnly,
          ctorNames: typeOnly
            ? []
            : parsed.named
                .filter(
                  (entry) => entry.imported === 'Resend' && !entry.typeOnly
                )
                .map((entry) => entry.local),
          namespaces: typeOnly
            ? []
            : [parsed.namespace, parsed.defaultLocal].filter(
                (name): name is string => name !== null
              ),
          importedNames: [
            ...(parsed.defaultLocal === null ? [] : ['default']),
            ...(parsed.namespace === null ? [] : ['*']),
            ...parsed.named.map((entry) => entry.imported),
          ],
        })
      } else if (isProjectSpecifier(specifier)) {
        if (/\.js$/.test(specifier)) {
          collected.relativeImportsUseJs = true
        }
        if (!typeOnly) {
          if (parsed.defaultLocal !== null) {
            collected.localImports.push({
              local: parsed.defaultLocal,
              imported: 'default',
              from: specifier,
            })
          }
          if (parsed.namespace !== null) {
            collected.localImports.push({
              local: parsed.namespace,
              imported: '*',
              from: specifier,
            })
          }
          for (const entry of parsed.named) {
            if (!entry.typeOnly) {
              collected.localImports.push({
                local: entry.local,
                imported: entry.imported,
                from: specifier,
              })
            }
          }
        }
      }
      index = specifierIndex
      continue
    }
    // require('…')
    if (
      isIdent(token, 'require') &&
      isPunct(tokens[index + 1], '(') &&
      tokens[index + 2]?.type === 'string' &&
      isPunct(tokens[index + 3], ')')
    ) {
      const specifierToken = tokens[index + 2] as Token
      const specifier = stringValue(specifierToken) ?? ''
      collected.cjs = true
      // `const X = require('resend').Resend`
      const member =
        isDot(tokens[index + 4]) && isIdent(tokens[index + 5])
          ? (tokens[index + 5] as Token).value
          : null
      let bindings: ReadonlyArray<{ imported: string; local: string }> = []
      if (isPunct(tokens[index - 1], '=')) {
        const before = tokens[index - 2]
        if (before?.type === 'ident') {
          bindings = [{ imported: member ?? '*', local: before.value }]
        } else if (isPunct(before, '}')) {
          const open = matchingOpen(tokens, index - 2)
          if (open !== -1) {
            bindings = parseObjectPattern(tokens.slice(open + 1, index - 2))
          }
        }
      }
      if (specifier === RESEND_MODULE) {
        collected.imports.push({
          kind: 'require',
          specifier: { start: specifierToken.start, end: specifierToken.end },
          typeOnly: false,
          ctorNames: bindings
            .filter((binding) => binding.imported === 'Resend')
            .map((binding) => binding.local),
          namespaces: bindings
            .filter((binding) => binding.imported === '*')
            .map((binding) => binding.local),
          importedNames: bindings.map((binding) => binding.imported),
        })
      } else if (isProjectSpecifier(specifier)) {
        for (const binding of bindings) {
          collected.localImports.push({
            local: binding.local,
            imported: binding.imported === '*' ? '*' : binding.imported,
            from: specifier,
          })
        }
      }
      continue
    }
    // export const x / export { a as b } / export default x
    if (isIdent(token, 'export')) {
      collected.esm = true
      const next = tokens[index + 1]
      if (DECLARATIONS.has(next?.value ?? '') && isIdent(tokens[index + 2])) {
        const name = (tokens[index + 2] as Token).value
        collected.exports.push({ local: name, exported: name })
      } else if (isPunct(next, '{')) {
        const close = matchingBracket(tokens, index + 1)
        const fromAfter = isIdent(tokens[close + 1], 'from')
        if (close !== -1 && !fromAfter) {
          for (const entry of parseImportClause(
            tokens.slice(index + 1, close + 1)
          ).named) {
            collected.exports.push({
              local: entry.imported,
              exported: entry.local,
            })
          }
        }
      } else if (
        isIdent(next, 'default') &&
        isIdent(tokens[index + 2]) &&
        !isIdent(tokens[index + 2], 'new') &&
        !isIdent(tokens[index + 2], 'function') &&
        !isIdent(tokens[index + 2], 'class')
      ) {
        collected.exports.push({
          local: (tokens[index + 2] as Token).value,
          exported: 'default',
        })
      }
      continue
    }
    // module.exports = { a, b: c } / module.exports = x / exports.a = b
    const isModuleExports =
      isIdent(token, 'module') &&
      isDot(tokens[index + 1]) &&
      isIdent(tokens[index + 2], 'exports')
    const isExportsMember =
      isIdent(token, 'exports') &&
      isDot(tokens[index + 1]) &&
      !isDot(tokens[index - 1])
    if (isModuleExports || isExportsMember) {
      collected.cjs = true
      let at = isModuleExports ? index + 3 : index + 1
      let exportedName: string | null = null
      if (isDot(tokens[at]) && isIdent(tokens[at + 1])) {
        exportedName = (tokens[at + 1] as Token).value
        at += 2
      }
      if (!isPunct(tokens[at], '=')) {
        continue
      }
      const value = tokens[at + 1]
      if (isPunct(value, '{') && exportedName === null) {
        const close = matchingBracket(tokens, at + 1)
        for (const entry of parseObjectPattern(tokens.slice(at + 2, close))) {
          collected.exports.push({
            local: entry.local,
            exported: entry.imported,
          })
        }
      } else if (value?.type === 'ident') {
        collected.exports.push({
          local: value.value,
          exported: exportedName ?? 'default',
        })
      }
    }
  }
}

function walkCode(
  text: string,
  tokens: readonly Token[],
  ctorNames: ReadonlySet<string>,
  namespaces: ReadonlySet<string>,
  exported: ReadonlyMap<string, string>,
  clients: ClientSite[],
  calls: CallLocation[]
): void {
  const braceStack: boolean[] = []
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index] as Token
    if (token.children !== undefined && token.children.length > 0) {
      walkCode(
        text,
        token.children,
        ctorNames,
        namespaces,
        exported,
        clients,
        calls
      )
    }
    if (isPunct(token, '{')) {
      braceStack.push(isClassBody(tokens, index))
      continue
    }
    if (isPunct(token, '}')) {
      braceStack.pop()
      continue
    }
    // new Resend(…) / new ns.Resend(…)
    if (isIdent(token, 'new')) {
      let ctorEnd = -1
      const first = tokens[index + 1]
      if (first?.type === 'ident' && ctorNames.has(first.value)) {
        ctorEnd = index + 1
      } else if (
        first?.type === 'ident' &&
        namespaces.has(first.value) &&
        isDot(tokens[index + 2]) &&
        isIdent(tokens[index + 3], 'Resend')
      ) {
        ctorEnd = index + 3
      }
      if (ctorEnd === -1) {
        continue
      }
      let args = {
        start: (tokens[ctorEnd] as Token).end,
        end: (tokens[ctorEnd] as Token).end,
      }
      let exprEnd = ctorEnd
      if (isPunct(tokens[ctorEnd + 1], '(')) {
        const close = matchingBracket(tokens, ctorEnd + 1)
        if (close !== -1) {
          args = {
            start: (tokens[ctorEnd + 1] as Token).end,
            end: (tokens[close] as Token).start,
          }
          exprEnd = close
        }
      }
      const member = memberAt(tokens, exprEnd + 1)
      const inline = member?.name === 'emails' || member?.name === 'batch'
      const binding = bindingBefore(tokens, index, braceStack.at(-1) === true)
      const exportName = binding.exportDefault
        ? 'default'
        : binding.name === null
          ? null
          : binding.exported
            ? binding.name
            : (exported.get(binding.name) ?? null)
      const position = lineColumn(text, token.start)
      clients.push({
        binding: binding.name,
        exportName,
        line: position.line,
        column: position.column,
        args,
        inline,
      })
      continue
    }
    // <receiver>.emails.send( / <receiver>.batch.send(, either member
    // also as a literal computed one (`['emails']`).
    const group = memberAt(tokens, index)
    const send =
      group?.name === 'emails' || group?.name === 'batch'
        ? memberAt(tokens, group.next)
        : null
    if (
      group !== null &&
      send !== null &&
      send.name === 'send' &&
      isPunct(tokens[send.next], '(')
    ) {
      const receiver = receiverBefore(tokens, index, ctorNames, namespaces)
      if (receiver === null) {
        continue
      }
      const argument = firstArgument(tokens, send.next)
      const open = tokens[send.next] as Token
      const args =
        argument === null
          ? { start: open.end, end: open.end }
          : {
              start: (tokens[argument.from] as Token).start,
              end: (tokens[argument.to] as Token).end,
            }
      const startToken = tokens[receiver.from] as Token
      const position = lineColumn(text, startToken.start)
      calls.push({
        receiver: text.slice(
          startToken.start,
          (tokens[index - 1] as Token).end
        ),
        method: group.name === 'emails' ? 'emails.send' : 'batch.send',
        line: position.line,
        column: position.column,
        args,
        inlineClient: receiver.inlineClient,
      })
    }
  }
}

/** What a `new Resend(…)` at `newIndex` is assigned to. */
function bindingBefore(
  tokens: readonly Token[],
  newIndex: number,
  inClassBody: boolean
): {
  readonly name: string | null
  readonly exported: boolean
  readonly exportDefault: boolean
} {
  const previous = tokens[newIndex - 1]
  if (isIdent(previous, 'default') && isIdent(tokens[newIndex - 2], 'export')) {
    return { name: null, exported: false, exportDefault: true }
  }
  if (!isPunct(previous, '=')) {
    return { name: null, exported: false, exportDefault: false }
  }
  // Step over a type annotation: `const resend: Resend | null = new …`.
  let nameIndex = newIndex - 2
  for (
    let index = newIndex - 2;
    index >= 0 && index >= newIndex - 16;
    index -= 1
  ) {
    const token = tokens[index] as Token
    if (
      isPunct(token, ';') ||
      isPunct(token, '{') ||
      isPunct(token, '}') ||
      isPunct(token, '=') ||
      DECLARATIONS.has(token.value)
    ) {
      break
    }
    if (isPunct(token, ':') && isIdent(tokens[index - 1])) {
      nameIndex = index - 1
      break
    }
  }
  const nameToken = tokens[nameIndex]
  if (nameToken?.type !== 'ident') {
    return { name: null, exported: false, exportDefault: false }
  }
  if (isDot(tokens[nameIndex - 1])) {
    return isIdent(tokens[nameIndex - 2], 'this') &&
      !isDot(tokens[nameIndex - 3])
      ? {
          name: `this.${nameToken.value}`,
          exported: false,
          exportDefault: false,
        }
      : { name: null, exported: false, exportDefault: false }
  }
  const declaration = tokens[nameIndex - 1]
  if (DECLARATIONS.has(declaration?.value ?? '')) {
    return {
      name: nameToken.value,
      exported: isIdent(tokens[nameIndex - 2], 'export'),
      exportDefault: false,
    }
  }
  if (
    inClassBody &&
    (CLASS_MODIFIERS.has(declaration?.value ?? '') ||
      isPunct(declaration, ';') ||
      isPunct(declaration, '{') ||
      isPunct(declaration, '}') ||
      declaration === undefined)
  ) {
    return {
      name: `this.${nameToken.value}`,
      exported: false,
      exportDefault: false,
    }
  }
  return { name: nameToken.value, exported: false, exportDefault: false }
}

/** The receiver expression ending right before the `.` at `dotIndex`. */
function receiverBefore(
  tokens: readonly Token[],
  dotIndex: number,
  ctorNames: ReadonlySet<string>,
  namespaces: ReadonlySet<string>
): { readonly from: number; readonly inlineClient: boolean } | null {
  let at = dotIndex - 1
  const last = tokens[at]
  if (last === undefined) {
    return null
  }
  const inlineClient = false
  if (isPunct(last, ')') || isPunct(last, ']')) {
    const open = matchingOpen(tokens, at)
    if (open === -1) {
      return null
    }
    at = open
    // `new Resend(k)` / `new ns.Resend(k)`
    const callee = tokens[at - 1]
    if (callee?.type === 'ident') {
      at -= 1
      if (ctorNames.has(callee.value) && isIdent(tokens[at - 1], 'new')) {
        return { from: at - 1, inlineClient: true }
      }
      if (
        callee.value === 'Resend' &&
        isDot(tokens[at - 1]) &&
        namespaces.has(tokens[at - 2]?.value ?? '') &&
        isIdent(tokens[at - 3], 'new')
      ) {
        return { from: at - 3, inlineClient: true }
      }
    } else if (isPunct(last, ')')) {
      // A parenthesized expression: `(await getClient()).emails.send`.
      return { from: at, inlineClient: false }
    }
  } else if (last.type !== 'ident') {
    return null
  }
  while (isDot(tokens[at - 1]) && tokens[at - 2]?.type === 'ident') {
    at -= 2
  }
  return { from: at, inlineClient }
}

export function locateWithTokens(text: string, path: string): FileLocations {
  const tokens = tokenize(text, { jsx: allowsJsx(path) })
  const collected: Collected = {
    imports: [],
    localImports: [],
    exports: [],
    importInsertAt: 0,
    esm: false,
    cjs: false,
    relativeImportsUseJs: false,
  }
  collectModuleSyntax(tokens, collected)
  const ctorNames = new Set(
    collected.imports.flatMap((entry) => entry.ctorNames)
  )
  const namespaces = new Set(
    collected.imports.flatMap((entry) => entry.namespaces)
  )
  const exported = new Map(
    collected.exports.map((entry) => [entry.local, entry.exported] as const)
  )
  const clients: ClientSite[] = []
  const calls: CallLocation[] = []
  walkCode(text, tokens, ctorNames, namespaces, exported, clients, calls)
  return {
    imports: collected.imports,
    localImports: collected.localImports,
    clients,
    calls,
    exports: collected.exports,
    importInsertAt: collected.importInsertAt,
    moduleSyntax: collected.esm || !collected.cjs ? 'esm' : 'cjs',
    relativeImportsUseJs: collected.relativeImportsUseJs,
  }
}
