import {
  closeSync,
  fstatSync,
  lstatSync,
  openSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { resolveWriteTarget } from '../project/fs-writer'

const INIT_LOCK_FILE = '.brew-init.lock'

class ProjectInitBusyError extends Error {}

/** Serialize every real init, including rollback, before its first state read. */
export function acquireProjectInitLock(root: string): () => void {
  const target = resolveWriteTarget(join(root, INIT_LOCK_FILE), {
    within: root,
    sensitive: true,
  })
  let descriptor: number
  try {
    descriptor = openSync(target, 'wx', 0o600)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      throw new ProjectInitBusyError(
        `Another init is already running for this project. Retry after it finishes. If the previous process stopped, remove ${INIT_LOCK_FILE} only after checking no init is running here.`
      )
    }
    throw error
  }
  const owned = fstatSync(descriptor)
  const release = (): void => {
    try {
      const current = lstatSync(target)
      // Keep our descriptor open so a removed inode cannot be recycled here.
      if (current.dev === owned.dev && current.ino === owned.ino) {
        unlinkSync(target)
      }
    } catch (error) {
      if (
        !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
      ) {
        throw error
      }
    } finally {
      closeSync(descriptor)
    }
  }
  try {
    writeFileSync(descriptor, `${process.pid}\n`)
  } catch (error) {
    release()
    throw error
  }
  return release
}
