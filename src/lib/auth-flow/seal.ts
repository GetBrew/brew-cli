import { createHash, randomBytes, webcrypto } from 'node:crypto'

/**
 * The client half of the browser sign-in seal (brew-v2
 * `lib/cli-login/seal.ts`, whose `unsealForCli` this mirrors). Brew encrypts
 * the minted keys to a P-256 key pair that exists only for one sign-in:
 *
 *   1. Z = ECDH(cliPrivate, serverEphemeralPublic): the 32-byte x-coordinate.
 *   2. K = HKDF-SHA256(Z, salt = empty, info = "brew-cli-login-v1"), 32 bytes.
 *   3. AES-256-GCM with K, a 12-byte IV, the 128-bit tag appended to the
 *      ciphertext, and the UTF-8 session id as associated data, so a sealed
 *      blob cannot be moved to another session.
 *
 * Every binary field is base64url without padding. `node:crypto` only.
 */

export const SEAL_INFO = 'brew-cli-login-v1'

const EC_PARAMS = { name: 'ECDH', namedCurve: 'P-256' } as const
const TAG_BITS = 128
const POLL_SECRET_BYTES = 32

export type SealedKeys = {
  readonly serverPublicKey: string
  readonly iv: string
  readonly ciphertext: string
}

export type LoginKeyKind = 'cli' | 'app'

/** The plaintext inside the seal. */
export type SealedPayload = {
  readonly v: 1
  readonly keys: ReadonlyArray<{
    readonly kind: LoginKeyKind
    readonly keyId: string
    readonly key: string
  }>
}

/** A P-256 public key as the session route takes it. */
export type PublicKeyJwk = {
  readonly kty: 'EC'
  readonly crv: 'P-256'
  readonly x: string
  readonly y: string
}

/** The private half, persisted only for a `--no-wait` sign-in (mode 0600). */
export type PrivateKeyJwk = PublicKeyJwk & { readonly d: string }

export type LoginKeyPair = {
  readonly privateKey: webcrypto.CryptoKey
  readonly publicJwk: PublicKeyJwk
}

const BASE64URL = /^[A-Za-z0-9_-]*$/

export function base64UrlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

/** Throws on anything that is not base64url. */
export function base64UrlDecode(value: string): Uint8Array<ArrayBuffer> {
  if (!BASE64URL.test(value)) {
    throw new Error('Not base64url')
  }
  const decoded = Buffer.from(value, 'base64url')
  const bytes = new Uint8Array(decoded.byteLength)
  bytes.set(decoded)
  return bytes
}

/** A fresh, extractable P-256 key pair for one sign-in. */
export async function generateLoginKeyPair(): Promise<LoginKeyPair> {
  const pair = (await webcrypto.subtle.generateKey(EC_PARAMS, true, [
    'deriveBits',
  ])) as webcrypto.CryptoKeyPair
  const jwk = await webcrypto.subtle.exportKey('jwk', pair.publicKey)
  if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string') {
    throw new Error('Could not export the sign-in public key.')
  }
  return {
    privateKey: pair.privateKey,
    publicJwk: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y },
  }
}

export async function exportPrivateJwk(
  privateKey: webcrypto.CryptoKey
): Promise<PrivateKeyJwk> {
  const jwk = await webcrypto.subtle.exportKey('jwk', privateKey)
  if (
    typeof jwk.x !== 'string' ||
    typeof jwk.y !== 'string' ||
    typeof jwk.d !== 'string'
  ) {
    throw new Error('Could not export the sign-in private key.')
  }
  return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d }
}

export async function importPrivateJwk(
  jwk: PrivateKeyJwk
): Promise<webcrypto.CryptoKey> {
  return await webcrypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d, ext: true },
    EC_PARAMS,
    false,
    ['deriveBits']
  )
}

/** 32 random bytes, base64url: 43 printable characters, no spaces. */
export function generatePollSecret(): string {
  return randomBytes(POLL_SECRET_BYTES).toString('base64url')
}

/** base64url(SHA-256(UTF-8 bytes of the poll secret)): what Brew stores. */
export function hashPollSecret(pollSecret: string): string {
  return createHash('sha256').update(pollSecret, 'utf8').digest('base64url')
}

/**
 * Opens a seal with the session's private key. Throws when the blob was
 * altered, belongs to another session, or was sealed to another key.
 */
export async function unseal(input: {
  readonly privateKey: webcrypto.CryptoKey
  readonly sessionId: string
  readonly sealed: SealedKeys
}): Promise<string> {
  const serverKey = await webcrypto.subtle.importKey(
    'raw',
    base64UrlDecode(input.sealed.serverPublicKey),
    EC_PARAMS,
    false,
    []
  )
  const shared = await webcrypto.subtle.deriveBits(
    { name: 'ECDH', public: serverKey },
    input.privateKey,
    256
  )
  const ikm = await webcrypto.subtle.importKey('raw', shared, 'HKDF', false, [
    'deriveKey',
  ])
  const aesKey = await webcrypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(SEAL_INFO),
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
  const plaintext = await webcrypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64UrlDecode(input.sealed.iv),
      additionalData: new TextEncoder().encode(input.sessionId),
      tagLength: TAG_BITS,
    },
    aesKey,
    base64UrlDecode(input.sealed.ciphertext)
  )
  return new TextDecoder().decode(plaintext)
}

/** The sealed plaintext, checked; `undefined` for anything else. */
export function parseSealedPayload(text: string): SealedPayload | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return
  }
  if (!isRecord(parsed) || parsed.v !== 1 || !Array.isArray(parsed.keys)) {
    return
  }
  const keys: Array<SealedPayload['keys'][number]> = []
  for (const entry of parsed.keys) {
    // A kind this CLI does not know (a newer server) is skipped, not fatal:
    // the session is already consumed, so failing here would strand the
    // keys this CLI does know.
    if (isRecord(entry) && entry.kind !== 'cli' && entry.kind !== 'app') {
      continue
    }
    if (
      !isRecord(entry) ||
      (entry.kind !== 'cli' && entry.kind !== 'app') ||
      typeof entry.keyId !== 'string' ||
      typeof entry.key !== 'string' ||
      entry.key === ''
    ) {
      return
    }
    keys.push({ kind: entry.kind, keyId: entry.keyId, key: entry.key })
  }
  return { v: 1, keys }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
