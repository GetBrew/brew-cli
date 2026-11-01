import type * as TS from 'typescript'
import { isProjectSpecifier } from './locate'
import type {
  CallLocation,
  ClientSite,
  FileLocations,
  LocalImport,
  ResendImport,
} from './types'

/**
 * The TypeScript engine of the code scan: the same answers as
 * `locateWithTokens`, read from the project's own compiler's syntax tree
 * (exact for every construct the tokenizer approximates: JSX text, regular
 * expressions, type parameters). Only the parser runs; nothing type-checks.
 */

export type TypeScriptModule = typeof TS

const RESEND_MODULE = 'resend'

/** `a.name`, or `a['name']` with a literal name: `a` and the name. */
function memberOf(
  ts: TypeScriptModule,
  node: TS.Node
): { readonly object: TS.Expression; readonly name: string } | null {
  if (ts.isPropertyAccessExpression(node)) {
    return { object: node.expression, name: node.name.text }
  }
  if (
    ts.isElementAccessExpression(node) &&
    ts.isStringLiteralLike(node.argumentExpression)
  ) {
    return { object: node.expression, name: node.argumentExpression.text }
  }
  return null
}

function scriptKind(ts: TypeScriptModule, path: string): TS.ScriptKind {
  if (/\.tsx$/.test(path)) {
    return ts.ScriptKind.TSX
  }
  if (/\.(?:ts|mts|cts)$/.test(path)) {
    return ts.ScriptKind.TS
  }
  if (/\.jsx$/.test(path)) {
    return ts.ScriptKind.JSX
  }
  // `.js` files hold JSX often enough (React apps) that it must parse.
  return ts.ScriptKind.JSX
}

function hasModifier(
  ts: TypeScriptModule,
  node: TS.Node,
  kind: TS.SyntaxKind
): boolean {
  const modifiers = ts.canHaveModifiers(node)
    ? ts.getModifiers(node)
    : undefined
  return modifiers?.some((modifier) => modifier.kind === kind) === true
}

export function locateWithTypeScript(
  ts: TypeScriptModule,
  text: string,
  path: string
): FileLocations {
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(ts, path)
  )
  const imports: ResendImport[] = []
  const localImports: LocalImport[] = []
  const exportsList: Array<{ local: string; exported: string }> = []
  const clients: ClientSite[] = []
  const calls: CallLocation[] = []
  let importInsertAt = 0
  let esm = false
  let cjs = false
  let relativeImportsUseJs = false

  const position = (node: TS.Node) => {
    const { line, character } = source.getLineAndCharacterOfPosition(
      node.getStart(source)
    )
    return { line: line + 1, column: character + 1 }
  }

  // ---- Module syntax: imports and exports at the top level.
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement)) {
      esm = true
      importInsertAt = Math.max(importInsertAt, statement.getEnd())
      if (!ts.isStringLiteral(statement.moduleSpecifier)) {
        continue
      }
      const specifier = statement.moduleSpecifier.text
      const clause = statement.importClause
      const typeOnly = clause?.isTypeOnly === true
      const named =
        clause?.namedBindings !== undefined &&
        ts.isNamedImports(clause.namedBindings)
          ? clause.namedBindings.elements.map((element) => ({
              imported: (element.propertyName ?? element.name).text,
              local: element.name.text,
              typeOnly: typeOnly || element.isTypeOnly,
            }))
          : []
      const namespace =
        clause?.namedBindings !== undefined &&
        ts.isNamespaceImport(clause.namedBindings)
          ? clause.namedBindings.name.text
          : null
      const defaultLocal = clause?.name?.text ?? null
      if (specifier === RESEND_MODULE) {
        const literal = statement.moduleSpecifier
        imports.push({
          kind: 'esm',
          specifier: { start: literal.getStart(source), end: literal.getEnd() },
          typeOnly,
          ctorNames: named
            .filter((entry) => entry.imported === 'Resend' && !entry.typeOnly)
            .map((entry) => entry.local),
          namespaces: typeOnly
            ? []
            : [namespace, defaultLocal].filter(
                (name): name is string => name !== null
              ),
          importedNames: [
            ...(defaultLocal === null ? [] : ['default']),
            ...(namespace === null ? [] : ['*']),
            ...named.map((entry) => entry.imported),
          ],
        })
      } else if (isProjectSpecifier(specifier)) {
        if (/\.js$/.test(specifier)) {
          relativeImportsUseJs = true
        }
        if (!typeOnly) {
          if (defaultLocal !== null) {
            localImports.push({
              local: defaultLocal,
              imported: 'default',
              from: specifier,
            })
          }
          if (namespace !== null) {
            localImports.push({
              local: namespace,
              imported: '*',
              from: specifier,
            })
          }
          for (const entry of named) {
            if (!entry.typeOnly) {
              localImports.push({
                local: entry.local,
                imported: entry.imported,
                from: specifier,
              })
            }
          }
        }
      }
      continue
    }
    if (ts.isExportDeclaration(statement)) {
      esm = true
      if (
        statement.moduleSpecifier === undefined &&
        statement.exportClause !== undefined &&
        ts.isNamedExports(statement.exportClause)
      ) {
        for (const element of statement.exportClause.elements) {
          exportsList.push({
            local: (element.propertyName ?? element.name).text,
            exported: element.name.text,
          })
        }
      }
      continue
    }
    if (ts.isExportAssignment(statement)) {
      esm = true
      if (ts.isIdentifier(statement.expression)) {
        exportsList.push({
          local: statement.expression.text,
          exported: 'default',
        })
      }
      continue
    }
    if (
      ts.isVariableStatement(statement) &&
      hasModifier(ts, statement, ts.SyntaxKind.ExportKeyword)
    ) {
      esm = true
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          exportsList.push({
            local: declaration.name.text,
            exported: declaration.name.text,
          })
        }
      }
      continue
    }
    // module.exports = …, exports.x = …
    if (
      ts.isExpressionStatement(statement) &&
      ts.isBinaryExpression(statement.expression) &&
      statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      const { left, right } = statement.expression
      const target = left.getText(source)
      const member = /^(?:module\.)?exports(?:\.([A-Za-z_$][\w$]*))?$/.exec(
        target
      )
      if (member !== null && target !== 'exports') {
        cjs = true
        const exportedName = member[1] ?? null
        if (ts.isObjectLiteralExpression(right) && exportedName === null) {
          for (const property of right.properties) {
            if (ts.isShorthandPropertyAssignment(property)) {
              exportsList.push({
                local: property.name.text,
                exported: property.name.text,
              })
            } else if (
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.initializer) &&
              (ts.isIdentifier(property.name) ||
                ts.isStringLiteral(property.name))
            ) {
              exportsList.push({
                local: property.initializer.text,
                exported: property.name.text,
              })
            }
          }
        } else if (ts.isIdentifier(right)) {
          exportsList.push({
            local: right.text,
            exported: exportedName ?? 'default',
          })
        }
      }
    }
  }

  // ---- require('…') anywhere.
  const visitRequires = (node: TS.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'require' &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0] as TS.Node)
    ) {
      cjs = true
      const literal = node.arguments[0] as TS.StringLiteral
      const specifier = literal.text
      // `require('resend').Resend`
      let holder: TS.Node = node
      let member: string | null = null
      if (
        ts.isPropertyAccessExpression(node.parent) &&
        node.parent.expression === node
      ) {
        member = node.parent.name.text
        holder = node.parent
      }
      const declaration = holder.parent
      let bindings: Array<{ imported: string; local: string }> = []
      if (
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer === holder
      ) {
        if (ts.isIdentifier(declaration.name)) {
          bindings = [{ imported: member ?? '*', local: declaration.name.text }]
        } else if (ts.isObjectBindingPattern(declaration.name)) {
          for (const element of declaration.name.elements) {
            if (ts.isIdentifier(element.name)) {
              const property = element.propertyName
              bindings.push({
                imported:
                  property !== undefined && ts.isIdentifier(property)
                    ? property.text
                    : element.name.text,
                local: element.name.text,
              })
            }
          }
        }
      }
      if (specifier === RESEND_MODULE) {
        imports.push({
          kind: 'require',
          specifier: { start: literal.getStart(source), end: literal.getEnd() },
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
          localImports.push({
            local: binding.local,
            imported: binding.imported,
            from: specifier,
          })
        }
      }
    }
    ts.forEachChild(node, visitRequires)
  }
  visitRequires(source)

  const ctorNames = new Set(imports.flatMap((entry) => entry.ctorNames))
  const namespaces = new Set(imports.flatMap((entry) => entry.namespaces))
  const exported = new Map(
    exportsList.map((entry) => [entry.local, entry.exported])
  )

  const isResendConstructor = (node: TS.Expression): boolean =>
    (ts.isIdentifier(node) && ctorNames.has(node.text)) ||
    (ts.isPropertyAccessExpression(node) &&
      node.name.text === 'Resend' &&
      ts.isIdentifier(node.expression) &&
      namespaces.has(node.expression.text))

  const isClientExpression = (node: TS.Expression): boolean =>
    ts.isNewExpression(node) && isResendConstructor(node.expression)

  // ---- Clients and calls.
  const visit = (node: TS.Node): void => {
    if (ts.isNewExpression(node) && isResendConstructor(node.expression)) {
      let binding: string | null = null
      let exportName: string | null = null
      let parent = node.parent
      while (
        ts.isParenthesizedExpression(parent) ||
        ts.isAsExpression(parent) ||
        ts.isSatisfiesExpression(parent) ||
        ts.isNonNullExpression(parent)
      ) {
        parent = parent.parent
      }
      if (ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) {
        binding = parent.name.text
        const statement = parent.parent.parent
        exportName =
          ts.isVariableStatement(statement) &&
          hasModifier(ts, statement, ts.SyntaxKind.ExportKeyword)
            ? binding
            : (exported.get(binding) ?? null)
      } else if (
        ts.isPropertyDeclaration(parent) &&
        (ts.isIdentifier(parent.name) || ts.isPrivateIdentifier(parent.name))
      ) {
        binding = `this.${parent.name.text}`
      } else if (
        ts.isBinaryExpression(parent) &&
        parent.operatorToken.kind === ts.SyntaxKind.EqualsToken
      ) {
        const left = parent.left
        if (ts.isIdentifier(left)) {
          binding = left.text
          exportName = exported.get(binding) ?? null
        } else if (
          ts.isPropertyAccessExpression(left) &&
          left.expression.kind === ts.SyntaxKind.ThisKeyword
        ) {
          binding = `this.${left.name.text}`
        }
      } else if (ts.isExportAssignment(parent)) {
        exportName = 'default'
      }
      const args = node.arguments
      const span =
        args === undefined
          ? { start: node.expression.getEnd(), end: node.expression.getEnd() }
          : { start: args.pos, end: args.end }
      const outer = memberOf(ts, node.parent)
      const inline =
        outer !== null &&
        outer.object === node &&
        (outer.name === 'emails' || outer.name === 'batch')
      clients.push({
        binding,
        exportName,
        ...position(node),
        args: span,
        inline,
      })
    }
    const send = ts.isCallExpression(node)
      ? memberOf(ts, node.expression)
      : null
    const group = send?.name === 'send' ? memberOf(ts, send.object) : null
    if (
      ts.isCallExpression(node) &&
      group !== null &&
      (group.name === 'emails' || group.name === 'batch')
    ) {
      const receiver = group.object
      const first = node.arguments[0]
      const open = node.expression.getEnd()
      calls.push({
        receiver: receiver.getText(source),
        method: group.name === 'emails' ? 'emails.send' : 'batch.send',
        ...position(receiver),
        args:
          first === undefined
            ? { start: open + 1, end: open + 1 }
            : { start: first.getStart(source), end: first.getEnd() },
        inlineClient: isClientExpression(receiver),
      })
    }
    ts.forEachChild(node, visit)
  }
  visit(source)

  return {
    imports,
    localImports,
    clients,
    calls,
    exports: exportsList,
    importInsertAt,
    moduleSyntax: esm || !cjs ? 'esm' : 'cjs',
    relativeImportsUseJs,
  }
}
