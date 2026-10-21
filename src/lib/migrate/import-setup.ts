import type {
  EmailImportInput,
  EmailImportResponse,
  UpsertAppEmailInput,
} from '@brew.new/sdk'
import { asSdkInput } from '../input'
import type { MigrationItem } from './manifest'
import {
  addWarning,
  errorOf,
  idempotencyKey,
  type RunContext,
  rethrowIfFatal,
  say,
} from './run'

/**
 * One migrated email: import the source (`POST /v1/emails/import`, with the
 * migration modes), then set up the app email by key from what the import
 * produced (`PUT /v1/app-emails/{key}`), then delete the intermediate
 * import so the brand keeps one design per key.
 *
 * The import modes (`props`, `placeholders`, `variables`) and the response's
 * `variables` come from brew-v2#2169 (in the vendored spec, not yet in the
 * SDK's types), so the body and the response are typed here and passed
 * through the SDK, which sends a body verbatim.
 */

export type ImportModeFields = {
  readonly props?: 'fold' | 'merge_tags'
  readonly placeholders?: 'resend'
  readonly variables?: ReadonlyArray<{
    readonly key: string
    readonly fallbackValue?: string
  }>
}

export type ImportBody = {
  readonly format: 'html' | 'jsx'
  readonly content: string
  readonly title?: string
  readonly subjectLine?: string
} & ImportModeFields

export type ImportResponse = Omit<EmailImportResponse, 'assetReport'> & {
  readonly variables?: ReadonlyArray<{
    readonly path: string
    readonly fallback?: string
  }>
  readonly assetReport?: {
    readonly warnings?: ReadonlyArray<{
      readonly code: string
      readonly location?: string
      readonly host?: string
    }>
  }
}

const WARNING_MESSAGES: Readonly<Record<string, string>> = {
  dynamic_prop_folded:
    'A prop is used in a way a merge tag cannot express (arithmetic, a style, a call), so it was folded to its preview or default value.',
  dynamic_control_flow_unsupported:
    'A .map, .filter or condition over a prop cannot become Liquid, so it was folded to its preview value.',
  escaping_changed:
    'Resend printed {{{VAR}}} values raw; Brew escapes merge values. Add `| raw` to a merge tag whose value is HTML.',
  placeholder_unmapped:
    'A Resend placeholder with no Brew equivalent (RESEND_UNSUBSCRIBE_URL outside an href) was left as written.',
  tailwind_config_unresolved:
    'The Tailwind config is imported from another file; the email-safe pixel preset was used instead.',
  tailwind_class_dropped:
    'Some Tailwind classes have no inline style (unknown theme values, hover or breakpoint variants) and were dropped.',
  foreign_component_dropped:
    'A component imported from another file was left out of the design.',
}

export function importWarningMessage(code: string, host?: string): string {
  return (
    WARNING_MESSAGES[code] ??
    `Import notice ${code}${host === undefined ? '' : ` (${host})`}.`
  )
}

/** One warning per import notice code on the item. */
export function recordImportWarnings(
  item: MigrationItem,
  imported: ImportResponse
): void {
  const seen = new Set<string>()
  for (const warning of imported.assetReport?.warnings ?? []) {
    if (seen.has(warning.code)) {
      continue
    }
    seen.add(warning.code)
    addWarning(item, {
      code: warning.code,
      message: importWarningMessage(warning.code, warning.host),
    })
  }
}

export function looksLikeMissingImportModes(error: {
  code: string
  message: string
}): boolean {
  return (
    error.code === 'INVALID_REQUEST' &&
    /placeholders|props|variables|unrecognized/i.test(error.message)
  )
}

export async function importAndSetUp(
  run: RunContext,
  item: MigrationItem,
  input: {
    readonly body: ImportBody
    readonly publish: boolean
    readonly subject?: string
    readonly from?: { readonly localPart?: string; readonly name?: string }
  }
): Promise<void> {
  const brew = run.brew
  if (brew === undefined || item.key === undefined) {
    return
  }
  const key = item.key
  let importedId: string | undefined
  try {
    say(run, `Importing ${item.name} as app email ${key}…`)
    const imported = (await brew.emails.import(
      asSdkInput<EmailImportInput>(input.body),
      { idempotencyKey: idempotencyKey(run, `import-${key}`, input.body) }
    )) as unknown as ImportResponse
    importedId = imported.emailId
    item.warnings = []
    recordImportWarnings(item, imported)
    const paths = (imported.variables ?? []).map((variable) => variable.path)
    const subject = imported.subjectLine ?? input.subject
    const setup = await brew.appEmails.upsert(
      asSdkInput<UpsertAppEmailInput>({
        triggerKey: key,
        source: { format: 'html', content: imported.html },
        ...(input.body.title === undefined
          ? {}
          : { title: input.body.title.slice(0, 120) }),
        ...(subject === undefined ? {} : { subject: subject.slice(0, 250) }),
        ...(input.from === undefined ? {} : { from: input.from }),
        publish: input.publish,
      })
    )
    for (const warning of setup.warnings) {
      addWarning(item, { code: warning.code, message: warning.message })
    }
    item.status = 'done'
    delete item.error
    item.brew = {
      triggerEventId: setup.triggerEventId,
      automationId: setup.automationId,
      emailId: setup.emailId,
      published: setup.published,
    }
    item.detail = `app email ${key} ${setup.published ? 'published' : 'set up (not published)'}, sender ${setup.sender.mode}${paths.length === 0 ? '' : `; reads ${paths.join(', ')}`}`
  } catch (error) {
    rethrowIfFatal(run.ctx, error)
    const failure = errorOf(run, error)
    if (failure.code === 'APP_EMAIL_EDITED_IN_BREW') {
      item.status = 'skipped'
      item.detail = `${key} was edited in Brew since it was set up; the Brew version is kept`
    } else if (failure.code === 'APP_EMAIL_TRIGGER_IN_USE') {
      // Another published automation already sends on this key's trigger:
      // a person picks which one stays, then a re-run sets it up.
      item.status = 'manual'
      item.error = failure
      item.detail = failure.message
    } else {
      item.status = 'failed'
      item.error = failure
      if (looksLikeMissingImportModes(failure)) {
        addWarning(item, {
          code: 'IMPORT_MODES_UNAVAILABLE',
          message:
            "Brew's import does not take the migration modes yet (props, placeholders, variables); try again once it does.",
        })
      }
    }
  } finally {
    if (importedId !== undefined) {
      try {
        await brew.emails.delete({ emailId: importedId })
      } catch (error) {
        rethrowIfFatal(run.ctx, error)
        addWarning(item, {
          code: 'IMPORT_DESIGN_LEFT',
          message: `The intermediate import ${importedId} could not be deleted; delete it in Brew.`,
        })
      }
    }
    run.persist()
  }
}
