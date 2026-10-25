import { readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { SDK_PACKAGE, SDK_RANGE } from '../init/templates'
import { ProjectWriter } from '../project/fs-writer'
import type { MessageAnalysis } from './code/analyze'
import {
  absoluteIn,
  decideRewrites,
  MAP_EXPORT,
  mapFileContent,
  mapFilePath,
  rewriteFile,
} from './code/rewrite'
import {
  type CodeScan,
  hasBrewClientFile,
  reactEmailBaseName,
  resolveProjectModule,
  type ScannedCallSite,
} from './code/scan'
import { importAndSetUp } from './import-setup'
import { deriveKey, isCanonicalKitKey, slugifyFileName } from './keys'
import type { CallSiteRecord, MigrationItem } from './manifest'
import {
  addNextStep,
  clean,
  phaseState,
  pruneItems,
  type RunContext,
  reconcileItem,
  say,
  settlePhase,
} from './run'

/**
 * The code phase: find every Resend send in the project, say what each
 * becomes in Brew, import React Email templates as app emails, and (with
 * `--rewrite-imports`) move the files whose sends are all template sends to
 * `@brew.new/sdk/resend`. Every other send is an agent next step with a
 * suggested `brew.send(key, payload)` replacement.
 */

export type CodePhaseResult = {
  readonly engine: CodeScan['engine']
  readonly filesScanned: number
}

function toPosix(path: string): string {
  return path.split(sep).join('/')
}

/** `{ a: 1, b }` → `a: 1, b`; anything else spreads. */
function payloadEntries(source: string | null): string[] {
  if (source === null || source === '') {
    return []
  }
  const trimmed = source.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const inner = trimmed.slice(1, -1).trim().replace(/,\s*$/, '')
    return inner === '' ? [] : [inner.replace(/\s*\n\s*/g, ' ')]
  }
  return [`...${trimmed}`]
}

/** The recipient expression: a one-element array is unwrapped. */
function recipient(to: string | null): string {
  if (to === null) {
    return '/* recipient email */'
  }
  const single = /^\[\s*([^,[\]]+?)\s*,?\s*\]$/.exec(to.trim())
  return (single?.[1] ?? to).replace(/\s*\n\s*/g, ' ')
}

function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ')
}

function sendLine(
  client: string,
  key: string,
  message: MessageAnalysis,
  extra: readonly string[]
): string {
  const fields = [`email: ${recipient(message.to)}`, ...extra.map(oneLine)]
  return `await ${client}.send('${key}', { ${fields.join(', ')} })`
}

type KeyIndex = {
  readonly templates: ReadonlyMap<string, MigrationItem>
  readonly reactEmail: ReadonlyMap<string, MigrationItem>
}

function keyIndex(run: RunContext): KeyIndex {
  const templates = new Map<string, MigrationItem>()
  for (const item of run.manifest.phases.templates?.items ?? []) {
    if (item.key === undefined) {
      continue
    }
    if (item.sourceId !== undefined) {
      templates.set(item.sourceId, item)
    }
    if (item.alias !== undefined) {
      templates.set(item.alias, item)
    }
  }
  const reactEmail = new Map<string, MigrationItem>()
  for (const item of run.manifest.phases.code?.items ?? []) {
    if (item.kind === 'react-email' && item.file !== undefined) {
      reactEmail.set(item.file, item)
    }
  }
  return { templates, reactEmail }
}

/** The React Email file a `<Component />` in `file` comes from. */
function componentFile(
  run: RunContext,
  scan: CodeScan,
  file: string,
  component: string
): string | null {
  const scanned = scan.files.get(file)
  const imported = scanned?.locations.localImports.find(
    (entry) => entry.local === component.split('.')[0]
  )
  if (imported === undefined) {
    return null
  }
  const resolved = resolveProjectModule(
    run.project.root,
    join(run.project.root, file),
    imported.from
  )
  return resolved === null
    ? null
    : toPosix(relative(run.project.root, resolved))
}

function callSiteRecord(
  run: RunContext,
  scan: CodeScan,
  site: ScannedCallSite,
  index: KeyIndex,
  client: string
): CallSiteRecord {
  const { analysis } = site
  const first = analysis.messages[0] as MessageAnalysis
  const templateIds = analysis.messages.flatMap((message) =>
    message.templateId === null ? [] : [message.templateId]
  )
  const unsupported = [
    ...new Set(analysis.messages.flatMap((message) => message.unsupported)),
  ]
  let key: string | null = null
  let component: string | null = null
  let replacement: string
  let note: string | undefined
  switch (analysis.kind) {
    case 'template': {
      const item =
        first.templateId === null
          ? undefined
          : index.templates.get(first.templateId)
      key = item?.key ?? null
      if (key === null) {
        note =
          first.templateId === null
            ? 'the template id is computed; map each id to its Brew key'
            : `template ${first.templateId} is not in the migration`
      }
      replacement = sendLine(
        client,
        key ?? '<brew-key>',
        first,
        payloadEntries(first.variables)
      )
      break
    }
    case 'react': {
      component = first.component?.name ?? null
      const file =
        component === null
          ? null
          : componentFile(run, scan, site.file, component)
      const item = file === null ? undefined : index.reactEmail.get(file)
      key = item?.key ?? null
      if (key === null) {
        note =
          component === null
            ? 'the React element is built elsewhere; import its template as an app email'
            : `<${component}> is not a React Email file the migration imports`
      } else if (item?.status === 'manual') {
        note = `${item.file} is migrated by hand (${item.detail ?? 'see the code phase'})`
      }
      const props = [
        ...(first.component?.props ?? []).map(
          (prop) => `${prop.name}: ${prop.value}`
        ),
        ...(first.component?.spreads ?? []).map((spread) => `...${spread}`),
      ]
      replacement = sendLine(client, key ?? '<brew-key>', first, props)
      break
    }
    case 'html':
    case 'text':
      note = `import the ${analysis.kind === 'html' ? 'HTML' : 'text'} as an app email first: ${run.prefix} app-emails upsert <brew-key> --source-file <file> --yes`
      replacement = sendLine(client, '<brew-key>', first, [])
      break
    default:
      note =
        'the message is built elsewhere: read it and pick the Brew key it sends'
      replacement = sendLine(client, '<brew-key>', first, [])
  }
  if (site.method === 'batch.send' && analysis.messages.length !== 1) {
    replacement = `send each message on its own: ${replacement}`
  }
  return {
    file: site.file,
    line: site.line,
    column: site.column,
    method: site.method,
    kind: analysis.kind,
    client: site.clientId,
    templateIds,
    key,
    component,
    unsupported,
    replacement: clean(run, replacement),
    status: 'manual',
    ...(note === undefined ? {} : { note: clean(run, note) }),
  }
}

export async function codePhase(run: RunContext): Promise<CodePhaseResult> {
  const phase = phaseState(run, 'code')
  delete phase.error
  const { root } = run.project
  say(run, `Scanning ${root} for Resend sends…`)
  const scan = run.source.scanCode(root)
  say(
    run,
    `Scanned ${scan.filesScanned} files (${scan.engine}): ${scan.callSites.length} sends, ${scan.reactEmail.length} React Email templates`
  )
  if (scan.truncated) {
    run.findings.push({
      code: 'CODE_SCAN_TRUNCATED',
      severity: 'warning',
      message:
        'The project has more source files than the scan reads; run it from the app directory (--cwd).',
    })
  }

  // ---- React Email templates → app emails (`props: 'merge_tags'`).
  const reuseKeys = run.manifest.options.keyPrefix === run.options.keyPrefix
  const taken = new Set<string>()
  const ours = new Set<string>()
  for (const item of [
    ...(run.manifest.phases.templates?.items ?? []),
    ...phase.items,
  ]) {
    if (item.key !== undefined && (item.status === 'done' || reuseKeys)) {
      taken.add(item.key)
      ours.add(item.key)
    }
  }
  for (const key of run.existingKeys ?? []) {
    if (!ours.has(key) && !isCanonicalKitKey(key)) {
      taken.add(key)
    }
  }
  const keep = new Set<string>()
  for (const file of scan.reactEmail) {
    const id = `react-email:${file.file}`
    keep.add(id)
    const previous = phase.items.find((item) => item.id === id)
    const key =
      previous?.key !== undefined && (previous.status === 'done' || reuseKeys)
        ? previous.key
        : deriveKey({
            base: slugifyFileName(reactEmailBaseName(file.file)),
            prefix: run.options.keyPrefix,
            taken,
            fallback: 'email',
          })
    const item = reconcileItem(phase, {
      id,
      kind: 'react-email',
      status: 'planned',
      name: file.file,
      file: file.file,
      key,
    })
    if (item.status === 'done') {
      continue
    }
    item.key = key
    delete item.error
    item.warnings = []
    if (file.manualReasons.length > 0) {
      item.status = 'manual'
      item.detail = `${file.manualReasons.join('; ')}: a static import cannot follow that, so move it by hand (inline what it needs, then ${run.prefix} app-emails upsert ${key} --source-file ${file.file} --input '{"source":{"props":"merge_tags"}}' --yes)`
    } else {
      item.status = 'planned'
      item.detail = `→ app email ${key}; props become {{ trigger.* }} merge tags`
    }
  }

  const index = keyIndex(run)
  const client = hasBrewClientFile(root, run.project.libDir)
    ? 'getBrew()'
    : 'brew'
  const records = scan.callSites.map((site) =>
    callSiteRecord(run, scan, site, index, client)
  )
  run.manifest.callSites = records
  run.persist()

  if (run.apply) {
    for (const item of phase.items) {
      if (
        item.kind !== 'react-email' ||
        item.file === undefined ||
        (item.status !== 'planned' && item.status !== 'failed')
      ) {
        continue
      }
      run.ctx.signal.throwIfAborted()
      let content: string
      try {
        content = readFileSync(absoluteIn(root, item.file), 'utf8')
      } catch {
        item.status = 'failed'
        item.error = {
          code: 'FILE_UNREADABLE',
          message: `${item.file} could not be read`,
        }
        continue
      }
      await importAndSetUp(run, item, {
        body: {
          format: 'jsx',
          content,
          title: reactEmailBaseName(item.file),
          props: 'merge_tags',
        },
        publish: true,
      })
    }
    // React call sites pick up the keys their files now have.
    const refreshed = keyIndex(run)
    for (const [position, site] of scan.callSites.entries()) {
      records[position] = callSiteRecord(run, scan, site, refreshed, client)
    }
  }

  // ---- Imports: which files can move to the Brew client as they are.
  const templateItems = run.manifest.phases.templates?.items ?? []
  const migrated = templateItems.filter((item) =>
    run.apply
      ? item.status === 'done'
      : item.status === 'done' || item.status === 'planned'
  )
  const knownTemplates = new Set(
    migrated.flatMap((item) => [
      ...(item.sourceId === undefined ? [] : [item.sourceId]),
      ...(item.alias === undefined ? [] : [item.alias]),
    ])
  )
  const allMigrated =
    templateItems.length > 0 && migrated.length === templateItems.length
  const decisions = decideRewrites(scan, knownTemplates, allMigrated)
  for (const decision of decisions) {
    const id = `rewrite:${decision.file}`
    keep.add(id)
    const item = reconcileItem(phase, {
      id,
      kind: 'rewrite',
      status: 'planned',
      name: decision.file,
      file: decision.file,
    })
    if (item.status === 'done') {
      continue
    }
    if (!decision.rewritable) {
      item.status = 'manual'
      item.detail = clean(run, `stays on resend: ${decision.reason}`)
    } else if (!run.options.rewriteImports) {
      item.status = 'skipped'
      item.detail = `every send is a migrated template: --rewrite-imports moves it to @brew.new/sdk/resend`
    } else {
      item.status = 'planned'
      item.detail = `import from @brew.new/sdk/resend, clients use BREW_API_KEY and ${MAP_EXPORT}`
    }
  }
  pruneItems(phase, keep)

  const rewritable = phase.items.filter(
    (item) => item.kind === 'rewrite' && item.status === 'planned'
  )
  const rewritten = new Set(
    phase.items
      .filter((item) => item.kind === 'rewrite' && item.status === 'done')
      .map((item) => item.file)
  )
  if (run.apply && run.options.rewriteImports && rewritable.length > 0) {
    rewriteImports(run, scan, rewritable, templateItems, rewritten)
  }

  // Call sites in files now on the Brew client are done.
  const doneClients = new Set(
    scan.clients
      .filter((entry) => rewritten.has(entry.file))
      .map((entry) => entry.id)
  )
  for (const record of records) {
    if (
      rewritten.has(record.file) ||
      (record.client !== null && doneClients.has(record.client))
    ) {
      record.status = 'done'
      record.replacement = `unchanged: @brew.new/sdk/resend sends template ${record.templateIds.join(', ') || '(computed id)'} by its Brew key`
      delete record.note
    }
  }
  run.manifest.callSites = records
  callSiteNextSteps(run, records, client)
  if (rewritten.size > 0) {
    rewriteNextSteps(run)
  }
  settlePhase(phase, { apply: run.apply })
  phase.counts = {
    sends: records.length,
    sendsDone: records.filter((record) => record.status === 'done').length,
    reactEmailTemplates: scan.reactEmail.length,
  }
  phase.detail = `${scan.callSites.length} Resend sends in ${new Set(scan.callSites.map((site) => site.file)).size} files`
  run.persist()
  return { engine: scan.engine, filesScanned: scan.filesScanned }
}

function rewriteImports(
  run: RunContext,
  scan: CodeScan,
  items: readonly MigrationItem[],
  templateItems: readonly MigrationItem[],
  rewritten: Set<string | undefined>
): void {
  const writer = new ProjectWriter({ root: run.project.root })
  const mapPath = mapFilePath(run.project.libDir, run.project.typescript)
  const entries = new Map<string, string>()
  for (const item of templateItems) {
    if (item.status !== 'done' || item.key === undefined) {
      continue
    }
    if (item.sourceId !== undefined) {
      entries.set(item.sourceId, item.key)
    }
    if (item.alias !== undefined) {
      entries.set(item.alias, item.key)
    }
  }
  const firstFile = scan.files.get(items[0]?.file ?? '')
  const content = mapFileContent({
    entries: [...entries.entries()],
    typescript: run.project.typescript,
    moduleSyntax: firstFile?.locations.moduleSyntax ?? 'esm',
    rerunCommand: `${run.prefix} migrate resend --apply --rewrite-imports`,
  })
  const recorded = run.manifest.files[mapPath]?.sha256
  const mapChange = writer.writeFile(
    mapPath,
    content,
    recorded === undefined ? {} : { managedSha256: recorded }
  )
  if (mapChange.action === 'refused') {
    run.findings.push({
      code: 'MAP_FILE_REFUSED',
      severity: 'error',
      message: `${mapPath} was not written (${mapChange.note ?? 'unsafe path'}); no imports were rewritten.`,
    })
    return
  }
  if (mapChange.action === 'kept-user-version') {
    run.findings.push({
      code: 'MAP_FILE_KEPT',
      severity: 'warning',
      message: `${mapPath} was edited since the migration wrote it, so it was kept; check it maps every template id.`,
    })
  } else if (mapChange.sha256 !== undefined) {
    run.manifest.files[mapPath] = { sha256: mapChange.sha256 }
  }
  for (const item of items) {
    const file = item.file ?? ''
    const scanned = scan.files.get(file)
    if (scanned === undefined) {
      continue
    }
    const next = rewriteFile({ file, scanned, mapFile: mapPath })
    const change = writer.writeFile(file, next, { overwrite: true })
    if (change.action === 'refused') {
      item.status = 'failed'
      item.error = {
        code: 'WRITE_REFUSED',
        message: change.note ?? 'unsafe path',
      }
      continue
    }
    item.status = 'done'
    item.detail = `now imports @brew.new/sdk/resend and ${mapPath}`
    if (change.sha256 !== undefined) {
      run.manifest.files[file] = { sha256: change.sha256 }
    }
    rewritten.add(file)
  }
  run.persist()
}

function callSiteNextSteps(
  run: RunContext,
  records: readonly CallSiteRecord[],
  client: string
): void {
  const open = records.filter((record) => record.status !== 'done')
  if (open.length > 0 && client === 'brew') {
    addNextStep(run, {
      id: 'set-up-brew-client',
      actor: 'agent',
      kind: 'run-command',
      command: `${run.prefix} init --yes`,
      title:
        'Set up the Brew client (lib/brew.ts with getBrew()) and BREW_API_KEY before replacing the Resend sends',
      blocking: true,
    })
  }
  for (const [position, record] of open.entries()) {
    const notes = [
      ...(record.unsupported.length === 0
        ? []
        : [
            `${record.unsupported.join(', ')} do not carry over: drop them or rework the email`,
          ]),
      ...(record.note === undefined ? [] : [record.note]),
    ]
    addNextStep(run, {
      id: `replace-send-${position + 1}`,
      actor: 'agent',
      kind: 'edit-file',
      path: record.file,
      title: `Replace the Resend ${record.method} at ${record.file}:${record.line} with ${record.replacement}${notes.length === 0 ? '' : ` (${notes.join('; ')})`}`,
      blocking: true,
    })
  }
}

function rewriteNextSteps(run: RunContext): void {
  if (!run.project.hasSdk) {
    addNextStep(run, {
      id: 'install-sdk',
      actor: 'agent',
      kind: 'run-command',
      command: run.project.addSdkCommand ?? 'npm install @brew.new/sdk',
      title: `Install ${SDK_PACKAGE}@${SDK_RANGE}: the rewritten files import ${SDK_PACKAGE}/resend`,
      blocking: true,
    })
  }
  addNextStep(run, {
    id: 'set-brew-api-key',
    actor: 'human',
    kind: 'set-secret',
    title:
      'Set BREW_API_KEY wherever the app runs (local env, hosting, CI); the rewritten clients read it instead of RESEND_API_KEY',
    blocking: true,
  })
}
