import ts from 'typescript'

const PROSE_TAG_KINDS = new Set([
  ts.SyntaxKind.JSDocTag,
  ts.SyntaxKind.JSDocSeeTag,
  ts.SyntaxKind.JSDocAuthorTag,
  ts.SyntaxKind.JSDocThrowsTag,
])
const GENERIC_TYPE_TAGS = new Set(['internal', 'public', 'sealed'])
const JS_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'jsonc',
])

function compilerMetadata(value) {
  if (!value.includes('@')) return false
  const ast = ts.createSourceFile(
    'directive.js',
    `${value}\nfunction subject() {}`,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  )
  if (ast.pragmas?.size) return true
  if (!value.startsWith('/**')) return false
  return (ast.statements[0]?.jsDoc ?? []).some((doc) =>
    (doc.tags ?? []).some(
      (tag) =>
        !PROSE_TAG_KINDS.has(tag.kind) ||
        GENERIC_TYPE_TAGS.has(tag.tagName.text)
    )
  )
}

function lintDeclarations(value, body) {
  if (!value.startsWith('/*')) return false
  const match = body.match(/^(globals?|exported)\s+([\s\S]*)$/)
  if (!match) return false
  return match[2].split(',').every((declaration) => {
    const [name, mode, ...extra] = declaration.trim().split(/\s*:\s*/)
    return (
      ts.isIdentifierText(name, ts.ScriptTarget.Latest) &&
      extra.length === 0 &&
      (mode === undefined ||
        (match[1] !== 'exported' &&
          /^(?:readonly|readable|writable|writeable|off|true|false)$/.test(
            mode
          )))
    )
  })
}

export function isRequiredComment(value, language = 'typescript') {
  if (
    value.startsWith('/*!') ||
    /@(?:license|preserve|copyright)\b|SPDX-License-Identifier|\bCopyright\s+(?:\(c\)\s+)?\d{4}|\blicensed under\b/i.test(
      value
    )
  )
    return true
  const body = value
    .replace(/^<!--\s*|\s*-->$/g, '')
    .replace(/^\/\/\/?[ \t]?|^\/\*+\s*|\*\/$/g, '')
    .replace(/^[ \t]*\*[ \t]?/gm, '')
    .trim()
  if (JS_LANGUAGES.has(language)) {
    return (
      /@internal\b/.test(value) ||
      compilerMetadata(value) ||
      lintDeclarations(value, body) ||
      /^(?:@ts-[\w-]+\b|@(?:vitest|jest)-environment\b|@?vite-ignore\b|eslint\b|billing-exempt:\s|<(?:reference|amd-module|amd-dependency)\b|(?:biome|prettier|stylelint|oxlint)[-:]|(?:istanbul|c8|v8|coverage) ignore\b|noinspection\s|[#@]\s*(?:__PURE__|__NO_SIDE_EFFECTS__|sourceURL|sourceMappingURL)|(?:webpack|turbopack)[A-Z]|rollup-plugin-)/m.test(
        body
      )
    )
  }
  if (language === 'html')
    return /^(?:\[if\b|<!\[endif\]|\[endif\]|\/?\$|\/?ko\b|#(?:include|if|else|endif)\b|(?:svelte|vue)-ignore\b)/i.test(
      body
    )
  if (language === 'css')
    return /^(?:(?:stylelint|prettier|biome)[-:]|autoprefixer\b|rtl:|[#@]\s*sourceMappingURL)/.test(
      body
    )
  if (language === 'dockerfile')
    return /^#\s*(?:syntax|escape|check)=/.test(value)
  if (language === 'sql') return /^\/\*\+/.test(value)
  if (language === 'python')
    return /^#(?:!|.*coding[:=])|^#\s*(?:type:|noqa\b|fmt:|pragma:|pylint:|pyright:|ruff:|mypy:)/im.test(
      value
    )
  if (language === 'bash')
    return /^#(?:!|\s*(?:shellcheck|shfmt)\b)/m.test(value)
  if (language === 'yaml')
    return /^#\s*(?:yaml-language-server:|yamllint\b|actionlint\b|cloud-config\b)/m.test(
      value
    )
  return false
}

export function commentRanges(file, source) {
  const ast = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    /\.jsonc?$/.test(file) ? ts.ScriptKind.JSON : undefined
  )
  const ranges = new Map()
  const tokens = []
  const add = (items) => {
    for (const range of items ?? []) ranges.set(range.pos, range)
  }
  const visit = (node) => {
    if (
      node.kind >= ts.SyntaxKind.FirstJSDocNode &&
      node.kind <= ts.SyntaxKind.LastJSDocNode
    )
      return
    if (node.kind !== ts.SyntaxKind.JsxText) {
      add(ts.getLeadingCommentRanges(source, node.pos))
      add(ts.getTrailingCommentRanges(source, node.end))
    }
    const children = node.getChildren(ast)
    if (children.length === 0 && node.end > node.getStart(ast))
      tokens.push({ pos: node.getStart(ast), end: node.end })
    for (const child of children) visit(child)
  }
  visit(ast)
  add(ts.getLeadingCommentRanges(source, 0))
  tokens.sort((left, right) => left.pos - right.pos)
  let tokenIndex = 0
  return [...ranges.values()]
    .sort((left, right) => left.pos - right.pos)
    .filter((range) => {
      while (tokens[tokenIndex]?.end <= range.pos) tokenIndex++
      return !tokens[tokenIndex] || tokens[tokenIndex].pos >= range.end
    })
}

export function findComments(file, source) {
  return commentRanges(file, source).filter(
    (range) => !isRequiredComment(source.slice(range.pos, range.end))
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
