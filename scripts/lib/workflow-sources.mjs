import { isAlias, isMap, isScalar, isSeq, parseDocument } from 'yaml'

function resolve(node, document) {
  const seen = new Set()
  while (isAlias(node) && !seen.has(node)) {
    seen.add(node)
    node = node.resolve(document)
  }
  return isAlias(node) ? undefined : node
}

function field(node, name, document) {
  const map = resolve(node, document)
  return isMap(map) ? resolve(map.get(name, true), document) : undefined
}

function text(node) {
  return isScalar(node) && typeof node.value === 'string'
    ? node.value
    : undefined
}

function language(shell) {
  const executable = shell.trim().split(/\s+/)[0]?.split(/[\\/]/).at(-1)
  if (/^(?:bash|sh|zsh)(?:\.exe)?$/.test(executable ?? '')) return 'bash'
  if (/^python(?:3(?:\.\d+)?)?(?:\.exe)?$/.test(executable ?? ''))
    return 'python'
  if (/^node(?:\.exe)?$/.test(executable ?? '')) return 'javascript'
  return undefined
}

function labels(node, document) {
  const current = resolve(node, document)
  if (isScalar(current)) return [String(current.value)]
  if (isSeq(current))
    return current.items.flatMap((item) => labels(item, document))
  if (isMap(current))
    return labels(field(current, 'labels', document), document)
  return []
}

function platformShell(job, document) {
  const runner = labels(field(job, 'runs-on', document), document).join(' ')
  if (/windows/i.test(runner)) return undefined
  return /ubuntu|linux|macos|darwin|blacksmith/i.test(runner)
    ? 'bash'
    : undefined
}

function defaultShell(node, document) {
  return text(
    field(
      field(field(node, 'defaults', document), 'run', document),
      'shell',
      document
    )
  )
}

export function workflowSources(file, source) {
  const workflow = /^\.github\/workflows\/[^/]+\.ya?ml$/.test(file)
  const action = /^\.github\/actions\/(?:.+\/)?action\.ya?ml$/.test(file)
  if (!workflow && !action) return []
  const document = parseDocument(source)
  if (document.errors.length)
    throw new Error(document.errors.map((error) => error.message).join('; '))
  const root = resolve(document.contents, document)
  const result = []
  const add = (steps, fallback, path) => {
    if (!isSeq(steps)) return
    steps.items.forEach((step, index) => {
      const map = resolve(step, document)
      const raw = isMap(map) ? map.get('run', true) : undefined
      const run = resolve(raw, document)
      const value = text(run)
      const shell = text(field(map, 'shell', document)) ?? fallback
      const kind = shell ? language(shell) : undefined
      if (value === undefined || !kind || !run.range) return
      const line = source.slice(0, run.range[0]).split('\n').length
      result.push({
        file,
        source: value,
        language: kind,
        offset: line - (run.type?.startsWith('BLOCK_') ? 0 : 1),
        range: run.range.slice(0, 2),
        style: run.type,
        alias: isAlias(raw),
        path: [...path, index, 'run'],
      })
    })
  }
  if (workflow) {
    const jobs = field(root, 'jobs', document)
    if (isMap(jobs)) {
      for (const pair of jobs.items) {
        const job = resolve(pair.value, document)
        const shell =
          defaultShell(job, document) ??
          defaultShell(root, document) ??
          platformShell(job, document)
        add(field(job, 'steps', document), shell, [
          'jobs',
          String(pair.key.value),
          'steps',
        ])
      }
    }
  } else {
    const runs = field(root, 'runs', document)
    if (text(field(runs, 'using', document)) === 'composite') {
      add(field(runs, 'steps', document), undefined, ['runs', 'steps'])
    }
  }
  return result
}
