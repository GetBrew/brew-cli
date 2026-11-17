import { ResendAccessError } from './resend/client'
import { addNextStep, phaseState, type RunContext, rethrowIfFatal } from './run'

/** Provider technical suppression must cover every sending class and host. */
export async function auditSuppressions(run: RunContext): Promise<boolean> {
  const phase = phaseState(run, 'suppressions')
  let checked = 0
  const hold = (message: string): false => {
    run.suppressionAudit = { verified: false, checked }
    phase.status = 'manual'
    phase.counts = { verified: checked }
    phase.detail = message
    delete phase.cursor
    delete phase.error
    addNextStep(run, {
      id: 'technical-suppressions',
      actor: 'human',
      kind: 'review',
      blocking: true,
      title: `${message} Keep the Resend sending, DNS and webhook path. Before applying or cutting over, preserve provider-wide technical protection through a supported process and verify the matching Brew contacts are technically suppressed; a marketing opt-out is insufficient.`,
    })
    return false
  }
  if (!run.inventory || !run.brew) {
    return hold(
      'A complete source suppression audit and Brew contact reads are required before apply, including code-only apply.'
    )
  }
  try {
    let after: string | null = null
    const cursors = new Set<string>()
    const emails = new Set<string>()
    do {
      run.ctx.signal.throwIfAborted()
      const page = await run.inventory.suppressions(after)
      for (const entry of page.rows) {
        const email = entry.email.trim().toLowerCase()
        if (emails.has(email)) continue
        emails.add(email)
        // Read the technical state; never write read-only flags or change consent.
        // biome-ignore lint/performance/noAwaitInLoops: Verify every address before admitting any migration effects.
        const contact = await run.brew.contacts.get(email)
        if (
          typeof contact.email !== 'string' ||
          contact.email.toLowerCase() !== email ||
          contact.suppressed !== true
        ) {
          return hold(
            'Provider-wide technical suppressions are not verified in Brew.'
          )
        }
        checked++
      }
      after = page.next
      if (after !== null) {
        if (cursors.has(after))
          return hold('The source suppression inventory did not finish paging.')
        cursors.add(after)
      }
    } while (after !== null)
  } catch (error) {
    run.ctx.signal.throwIfAborted()
    if (error instanceof ResendAccessError) {
      run.findings.push({
        code:
          error.reason === 'sending_only'
            ? 'RESEND_KEY_SENDING_ONLY'
            : 'RESEND_KEY_REJECTED',
        severity: 'error',
        message: error.message,
      })
    } else {
      rethrowIfFatal(run.ctx, error)
    }
    return hold(
      'The complete source suppression inventory or Brew technical protection could not be verified.'
    )
  }
  run.suppressionAudit = { verified: true, checked }
  phase.status = checked === 0 ? 'skipped' : 'done'
  phase.counts = { verified: checked }
  phase.detail =
    checked === 0
      ? 'no provider technical suppressions'
      : 'verified existing address-level technical suppression in Brew; no marketing opt-out imported'
  delete phase.cursor
  delete phase.error
  return true
}
