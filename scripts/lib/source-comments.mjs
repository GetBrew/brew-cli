import ts from 'typescript'

export function isRequiredComment(value) {
  const body = value
    .replace(/^\/\/\/?[ \t]?|^\/\*+\s*|\*\/$/g, '')
    .replace(/^[ \t]*\*[ \t]?/gm, '')
    .trim()
  return (
    value.startsWith('/*!') ||
    /^(?:auto-)?generated (?:by|from)\b/i.test(body) ||
    /^(?:@(?:ts-(?:check|nocheck|expect-error|ignore)|jsx\b|jsxImportSource\b|jsxRuntime\b|vitest-environment\b|jest-environment\b)|@?vite-ignore\b|eslint\b|<(?:reference|amd-module|amd-dependency)\b|(?:biome|eslint|prettier|stylelint|oxlint)[-:]|(?:istanbul|c8|v8|coverage) ignore\b|noinspection\s|[#@]\s*(?:__PURE__|__NO_SIDE_EFFECTS__|sourceURL|sourceMappingURL)|webpack[A-Z]|turbopack[A-Z]|vite-ignore|rollup-plugin-)/m.test(
      body
    ) ||
    /@(?:license|preserve|copyright|deprecated|internal|public|sealed|typedef|template|callback|overload|this|constructor|import)\b|@(?:type|param|returns?|property|satisfies|implements|extends|enum)\s*\{|SPDX-License-Identifier|\bCopyright\s+(?:\(c\)\s+)?\d{4}|\blicensed under\b/i.test(
      body
    )
  )
}

export function findComments(file, source) {
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    /\.jsonc?$/.test(file) ? ts.ScriptKind.JSON : undefined
  )
  const generatedHeaderEnd = /^\/\/\s*(?:auto-)?generated (?:by|from)\b/i.test(
    source
  )
    ? source.match(/^(?:\/\/[^\n]*(?:\n|$)|[ \t\r]*\n)*/)[0].length
    : 0
  const ranges = new Map()
  const tokens = []
  const add = (items) => {
    for (const range of items ?? []) {
      ranges.set(range.pos, range)
    }
  }
  const visit = (node) => {
    if (
      node.kind >= ts.SyntaxKind.FirstJSDocNode &&
      node.kind <= ts.SyntaxKind.LastJSDocNode
    ) {
      return
    }
    if (node.kind !== ts.SyntaxKind.JsxText) {
      add(ts.getLeadingCommentRanges(source, node.pos))
      add(ts.getTrailingCommentRanges(source, node.end))
    }
    const children = node.getChildren(ast)
    if (children.length === 0 && node.end > node.getStart(ast)) {
      tokens.push({ pos: node.getStart(ast), end: node.end })
    }
    for (const child of children) {
      visit(child)
    }
  }
  visit(ast)
  add(ts.getLeadingCommentRanges(source, 0))
  tokens.sort((left, right) => left.pos - right.pos)
  let tokenIndex = 0
  return [...ranges.values()]
    .sort((left, right) => left.pos - right.pos)
    .filter((range) => {
      while (tokens[tokenIndex]?.end <= range.pos) {
        tokenIndex++
      }
      return !tokens[tokenIndex] || tokens[tokenIndex].pos >= range.end
    })
    .filter(
      (range) =>
        range.end > generatedHeaderEnd &&
        !isRequiredComment(source.slice(range.pos, range.end))
    )
}

export function withoutComments(file, source) {
  let result = source
  for (const range of findComments(file, source).reverse()) {
    const replacement = source
      .slice(range.pos, range.end)
      .replace(/[^\r\n\u2028\u2029]/g, ' ')
    result = result.slice(0, range.pos) + replacement + result.slice(range.end)
  }
  return result
}
