import { defaultOpenUrl } from '../project/process'
import type { CliIo } from '../types'
import { detectRemoteEnv, type RemoteEnv } from './remote-env'

export type OpenOutcome =
  | { readonly status: 'opened' }
  /** A cloud shell, SSH or CI: this machine's browser is not the person's. */
  | { readonly status: 'remote'; readonly remote: RemoteEnv }
  /** `--no-open`. */
  | { readonly status: 'skipped' }
  /** No opener on this machine, or it refused. */
  | { readonly status: 'failed' }

/**
 * Opens the approval page in the person's browser when there is one to
 * open. Never throws: the link and code are already on the terminal, so a
 * missing opener only changes what the next line says.
 */
export async function openVerificationPage(
  io: Pick<CliIo, 'env' | 'openUrl'>,
  url: string,
  options: { readonly isDisabled: boolean }
): Promise<OpenOutcome> {
  if (options.isDisabled) {
    return { status: 'skipped' }
  }
  const remote = detectRemoteEnv(io.env)
  if (remote !== undefined) {
    return { status: 'remote', remote }
  }
  const open = io.openUrl ?? ((target) => defaultOpenUrl(target, io.env))
  try {
    await open(url)
    return { status: 'opened' }
  } catch {
    return { status: 'failed' }
  }
}
