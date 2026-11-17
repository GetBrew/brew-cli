import { chmodSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CliUsageError } from '../../errors'
import { type ProjectWriter, resolveWriteTarget } from '../../project/fs-writer'
import { ensureIgnored } from '../../project/gitignore'
import type { SpawnFn } from '../../types'
import { generateHookSecret, SUPABASE_REF_PATTERN } from './supabase'

export function hostedHookSecretPath(ref: string): string {
  if (!SUPABASE_REF_PATTERN.test(ref)) {
    throw new CliUsageError('A valid Supabase project reference is required.')
  }
  return `.env.brew-supabase-${ref}`
}

/**
 * Keep one setup credential before connecting either service. Exclusive
 * creation makes overlapping local runs share it; createOnly on the remote
 * connect refuses a different machine's competing credential. Keep the file
 * after a failure so a retry can finish a successful but unanswered connect.
 */
export async function getOrCreateHostedHookSecret(
  writer: ProjectWriter,
  ref: string,
  options: { readonly spawn?: SpawnFn; readonly signal?: AbortSignal } = {}
): Promise<string> {
  if (writer.dryRun) {
    throw new CliUsageError('A dry run cannot create a hook credential.')
  }
  const name = hostedHookSecretPath(ref)
  const ignored = await ensureIgnored(writer, [name], options)
  if (ignored.conflicts.length > 0) {
    throw new CliUsageError(
      `${name} must be ignored before configuring the hook.`
    )
  }
  options.signal?.throwIfAborted()
  const path = resolveWriteTarget(join(writer.root, name), {
    within: writer.root,
    sensitive: true,
  })
  try {
    writeFileSync(path, generateHookSecret(), { flag: 'wx', mode: 0o600 })
  } catch (error) {
    if (
      !(error instanceof Error && 'code' in error && error.code === 'EEXIST')
    ) {
      throw error
    }
  }
  const secret = readFileSync(path, 'utf8').trim()
  if (!/^v1,whsec_[A-Za-z0-9+/]{43}=$/.test(secret)) {
    throw new CliUsageError(
      `${name} has no complete setup credential; leave the hook unchanged and retry once the other setup finishes.`
    )
  }
  chmodSync(path, 0o600)
  return secret
}
