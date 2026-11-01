import {
  chmodSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { configDir } from '../config-store'
import type { LoginKeyKind, PrivateKeyJwk } from './seal'

/**
 * A browser sign-in started with `--no-wait` (or whose `--wait` ran out),
 * kept so `login --resume` can collect it from another process. It holds
 * the poll secret and the private key, so it lives next to the config at
 * mode 0600 and is deleted as soon as the sign-in ends (approved, denied,
 * expired). Only one is kept: a new one replaces it.
 */
export type PendingLogin = {
  readonly v: 1
  readonly sessionId: string
  readonly pollSecret: string
  readonly privateKey: PrivateKeyJwk
  readonly userCode: string
  readonly verificationUrl: string
  /** ISO 8601, from the server. */
  readonly expiresAt: string
  /** Seconds between polls, from the server (after any `slow_down`). */
  readonly interval: number
  /** Epoch ms before which `--resume` must not poll. */
  readonly nextPollAt: number
  /** Where the sign-in routes live (`https://brew.new`). */
  readonly siteUrl: string
  /** The API URL the key is for. */
  readonly apiUrl: string
  readonly keys: readonly LoginKeyKind[]
}

export function pendingLoginPath(
  env: Readonly<Record<string, string | undefined>>
): string {
  return join(configDir(env), 'pending-auth.json')
}

export function readPendingLogin(
  env: Readonly<Record<string, string | undefined>>
): PendingLogin | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(pendingLoginPath(env), 'utf8'))
  } catch {
    return
  }
  return isPendingLogin(parsed) ? parsed : undefined
}

export function writePendingLogin(
  env: Readonly<Record<string, string | undefined>>,
  pending: PendingLogin
): string {
  mkdirSync(configDir(env), { recursive: true, mode: 0o700 })
  const path = pendingLoginPath(env)
  // A fresh 0600 file renamed into place: the secret is never readable
  // through an older, wider file, and a crash never leaves half a file.
  const temporary = `${path}.${process.pid}.tmp`
  rmSync(temporary, { force: true })
  writeFileSync(temporary, `${JSON.stringify(pending, null, 2)}\n`, {
    mode: 0o600,
    flag: 'wx',
  })
  chmodSync(temporary, 0o600)
  renameSync(temporary, path)
  return path
}

/**
 * Deletes the pending sign-in — only the one for `sessionId` when given, so
 * ending one sign-in never discards another that is still waiting.
 */
export function deletePendingLogin(
  env: Readonly<Record<string, string | undefined>>,
  sessionId?: string
): void {
  if (sessionId !== undefined) {
    const current = readPendingLogin(env)
    if (current !== undefined && current.sessionId !== sessionId) {
      return
    }
  }
  rmSync(pendingLoginPath(env), { force: true })
}

function isPendingLogin(value: unknown): value is PendingLogin {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  const key = record.privateKey as Record<string, unknown> | null | undefined
  return (
    record.v === 1 &&
    typeof record.sessionId === 'string' &&
    typeof record.pollSecret === 'string' &&
    typeof record.userCode === 'string' &&
    typeof record.verificationUrl === 'string' &&
    typeof record.expiresAt === 'string' &&
    typeof record.interval === 'number' &&
    typeof record.nextPollAt === 'number' &&
    typeof record.siteUrl === 'string' &&
    typeof record.apiUrl === 'string' &&
    Array.isArray(record.keys) &&
    typeof key === 'object' &&
    key !== null &&
    key.kty === 'EC' &&
    key.crv === 'P-256' &&
    typeof key.x === 'string' &&
    typeof key.y === 'string' &&
    typeof key.d === 'string'
  )
}
