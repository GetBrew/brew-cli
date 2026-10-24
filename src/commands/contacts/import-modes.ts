import { CliUsageError } from '../../lib/errors'

/** `--dry-run` on both imports. */
export const DRY_RUN_FLAG = {
  flag: '--dry-run',
  summary:
    'Show what the import would do and write nothing (no contacts, fields or Import History batch; --validate is skipped and nothing is charged)',
} as const

/** `--on-conflict` on both imports. */
export const ON_CONFLICT_FLAG = {
  flag: '--on-conflict <mode>',
  summary:
    'upsert (default) updates existing contacts; skip only creates missing ones and leaves existing contacts unchanged (counted as skipped)',
} as const

const ON_CONFLICT_MODES = ['upsert', 'skip'] as const

/**
 * The body keys `--dry-run` and `--on-conflict` set. An absent flag sets
 * nothing, so a value from --input or the file stays.
 */
export function importModeFlags(flags: {
  readonly dryRun?: unknown
  readonly onConflict?: unknown
}): { dryRun?: true; onConflict?: (typeof ON_CONFLICT_MODES)[number] } {
  // Any supplied value is checked before it is normalized: an empty one
  // (an unset shell variable) must stop the import, not run an upsert.
  const raw = flags.onConflict
  const onConflict = typeof raw === 'string' ? raw.trim() : raw
  if (
    onConflict !== undefined &&
    !(
      typeof onConflict === 'string' &&
      (ON_CONFLICT_MODES as ReadonlyArray<string>).includes(onConflict)
    )
  ) {
    throw new CliUsageError(
      `--on-conflict takes upsert or skip, not "${String(raw)}".`
    )
  }
  return {
    ...(flags.dryRun === true ? { dryRun: true } : {}),
    ...(onConflict !== undefined
      ? { onConflict: onConflict as (typeof ON_CONFLICT_MODES)[number] }
      : {}),
  }
}
