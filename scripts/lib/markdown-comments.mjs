import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkMdx from 'remark-mdx'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { commentRanges } from './source-comments.mjs'

const markdown = unified().use(remarkParse).use(remarkGfm).use(remarkMath)
const mdx = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkMdx)
const JS = {
  js: 'javascript',
  javascript: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  typescript: 'typescript',
  tsx: 'tsx',
  json: 'jsonc',
  jsonc: 'jsonc',
  mjs: 'javascript',
  cjs: 'javascript',
}
const OTHER = {
  bash: 'bash',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  css: 'css',
  html: 'html',
  svg: 'html',
  python: 'python',
  py: 'python',
  rust: 'rust',
  rs: 'rust',
  yaml: 'yaml',
  yml: 'yaml',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  toml: 'toml',
}

export function markdownComments(file, source) {
  const body = source.replace(/^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/, (block) =>
    block.replace(/[^\r\n]/g, ' ')
  )
  const tree = (file.endsWith('.mdx') ? mdx : markdown).parse(body)
  const comments = []
  const payloads = []
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/)
  if (frontmatter) {
    payloads.push({ file, source: frontmatter[1], language: 'yaml', offset: 1 })
  }
  const visit = (node) => {
    if (node.type === 'code') {
      const language = JS[node.lang] ?? OTHER[node.lang]
      if (!language) {
        return
      }
      const offset = node.position.start.line
      if (JS[node.lang]) {
        try {
          const extension = {
            typescript: 'ts',
            javascript: 'js',
            jsx: 'jsx',
            tsx: 'tsx',
            jsonc: 'jsonc',
          }[language]
          for (const range of commentRanges(
            `example.${extension}`,
            node.value
          )) {
            comments.push({
              file,
              value: node.value.slice(range.pos, range.end),
              language,
              line:
                offset +
                node.value.slice(0, range.pos).split(/\r\n|[\r\n\u2028\u2029]/)
                  .length,
            })
          }
        } catch {
          payloads.push({
            file,
            source: node.value,
            language: { jsonc: 'javascript', jsx: 'tsx' }[language] ?? language,
            offset,
          })
        }
      } else {
        payloads.push({ file, source: node.value, language, offset })
      }
      return
    }
    if (node.type === 'html') {
      payloads.push({
        file,
        source: node.value,
        language: 'html',
        offset: node.position.start.line - 1,
      })
    }
    for (const comment of node.data?.estree?.comments ?? []) {
      comments.push({
        file,
        value:
          comment.type === 'Line'
            ? `//${comment.value}`
            : `/*${comment.value}*/`,
        language: 'javascript',
        line: comment.loc?.start.line ?? node.position.start.line,
      })
    }
    for (const child of node.children ?? []) {
      visit(child)
    }
    for (const attribute of node.attributes ?? []) {
      visit(attribute)
    }
    if (node.value && typeof node.value === 'object') {
      visit(node.value)
    }
  }
  visit(tree)
  return { comments, payloads }
}
