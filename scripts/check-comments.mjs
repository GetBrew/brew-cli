import { execFileSync, spawnSync } from 'node:child_process'
import { closeSync, lstatSync, openSync, readFileSync, readSync } from 'node:fs'
import { basename, delimiter, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  dotenvCommentRanges,
  shebangLanguage,
} from './lib/comment-file-languages.mjs'
import { loadCommentScope } from './lib/comment-scope.mjs'
import { gritCommentRanges } from './lib/grit-comments.mjs'
import { markdownComments } from './lib/markdown-comments.mjs'
import { findComments, isRequiredComment } from './lib/source-comments.mjs'
import { workflowSources } from './lib/workflow-sources.mjs'

const toolRoot = fileURLToPath(new URL('..', import.meta.url))
const args = process.argv.slice(2)
if (args.length && (args.length !== 2 || args[0] !== '--root')) {
  throw new Error('Usage: check-comments.mjs [--root repository]')
}
const root = args.length ? resolve(args[1]) : toolRoot
const scope = loadCommentScope(root)
const files = execFileSync(
  'git',
  ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
  {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }
)
  .split('\0')
  .filter(Boolean)
const failures = []
const payloads = []
let checked = 0
const languages = {
  '.css': 'css',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.sh': 'bash',
  '.bash': 'bash',
  '.py': 'python',
  '.pyi': 'python',
  '.rs': 'rust',
  '.wgsl': 'wgsl',
  '.html': 'html',
  '.svg': 'html',
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.toml': 'toml',
  '.ini': 'ini',
}
const required = (comment) =>
  scope.isManagedMarker(comment.file, comment.value) ||
  isRequiredComment(comment.value, comment.language)
const record = (comment) => {
  if (!required(comment)) {
    failures.push(
      `${comment.file}:${comment.line}: remove explanatory source comment`
    )
  }
}
for (const file of new Set(files)) {
  if (scope.excludes(file)) {
    continue
  }
  const extension = extname(file).toLowerCase()
  let isJavascript =
    /\.(?:[cm]?[jt]sx?|jsonc?)$/.test(file) || file === 'bun.lock'
  const isMarkdown = /\.(?:mdx?|mdc)$/.test(file)
  const name = basename(file).toLowerCase()
  const isIgnore =
    /^(?:\.gitignore|\.mintignore|\.npmignore|\.dockerignore|\.prettierignore|\.eslintignore|\.gitattributes|\.git-blame-ignore-revs)$/.test(
      name
    )
  let language = languages[extension]
  if (!language && !isJavascript && /^\.env(?:\.|$)/.test(name)) {
    language = 'dotenv'
  } else if (!language && extension === '.grit') {
    language = 'grit'
  }
  if (/^(?:dockerfile|.+\.dockerfile)$/.test(name)) {
    language = 'dockerfile'
  } else if (/^(?:makefile|gnumakefile)$/.test(name)) {
    language = 'make'
  } else if (name === '.editorconfig') {
    language = 'ini'
  }
  if (!isJavascript && !isMarkdown && !language && !isIgnore) {
    let descriptor
    let hasShebang = false
    try {
      if (!lstatSync(join(root, file)).isFile()) {
        continue
      }
      descriptor = openSync(join(root, file), 'r')
      const prefix = Buffer.alloc(512)
      const length = readSync(descriptor, prefix, 0, prefix.length, 0)
      const header = prefix.toString('utf8', 0, length)
      hasShebang = header.startsWith('#!')
      language = shebangLanguage(header)
    } catch (error) {
      if (error.code === 'ENOENT') {
        continue
      }
      failures.push(`${file}: unable to inspect shebang: ${error.message}`)
      continue
    } finally {
      if (descriptor !== undefined) {
        closeSync(descriptor)
      }
    }
    isJavascript = language === 'javascript'
    if (!language) {
      if (hasShebang) {
        failures.push(
          `${file}: unable to inspect comments: unsupported shebang interpreter`
        )
      }
      continue
    }
  }
  let source
  try {
    if (!lstatSync(join(root, file)).isFile()) {
      continue
    }
    source = readFileSync(join(root, file), 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') {
      continue
    }
    throw error
  }
  checked++
  try {
    if (isIgnore) {
      const pattern =
        name === '.git-blame-ignore-revs' ? /#[^\r\n]*/gm : /^#[^\r\n]*/gm
      for (const match of source.matchAll(pattern)) {
        record({
          file,
          value: match[0],
          language: 'ignore',
          line: source.slice(0, match.index).split('\n').length,
        })
      }
    } else if (language === 'grit' || language === 'dotenv') {
      const ranges =
        language === 'grit'
          ? gritCommentRanges(source)
          : dotenvCommentRanges(source)
      for (const range of ranges) {
        record({
          file,
          value: source.slice(range.pos, range.end),
          language,
          line: source.slice(0, range.pos).split(/\r\n|[\r\n]/).length,
        })
      }
    } else if (isJavascript) {
      const filename = file === 'bun.lock' ? 'bun.jsonc' : file
      for (const range of findComments(
        language === 'javascript' ? 'shebang.js' : filename,
        source
      )) {
        failures.push(
          `${file}:${source.slice(0, range.pos).split(/\r\n|[\r\n\u2028\u2029]/).length}: remove explanatory source comment`
        )
      }
    } else if (isMarkdown) {
      const result = markdownComments(file, source)
      result.comments.forEach(record)
      payloads.push(...result.payloads)
    } else {
      payloads.push({ file, source, language })
      if (language === 'yaml') {
        payloads.push(...workflowSources(file, source))
      }
    }
  } catch (error) {
    failures.push(`${file}: unable to inspect comments: ${error.message}`)
  }
}
if (payloads.length) {
  const target = join(toolRoot, 'node_modules/.comment-parsers')
  const parsed = spawnSync(
    'python3',
    [join(toolRoot, 'scripts/check-source-comments.py')],
    {
      input: JSON.stringify(payloads),
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        PYTHONPATH: [target, process.env.PYTHONPATH]
          .filter(Boolean)
          .join(delimiter),
      },
    }
  )
  if (parsed.error) {
    throw parsed.error
  }
  if (parsed.status !== 0) {
    console.error(parsed.stderr || 'Comment parser failed')
    process.exit(1)
  }
  JSON.parse(parsed.stdout).forEach(record)
}
if (failures.length) {
  console.error(failures.slice(0, 100).join('\n'))
  console.error(
    `${failures.length} explanatory comments or parsing failures found.`
  )
  process.exitCode = 1
} else {
  console.log(
    `Source comments: ${checked} owned source and Markdown files checked; no explanatory comments.`
  )
}
