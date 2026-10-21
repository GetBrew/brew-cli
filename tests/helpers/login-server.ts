import { createHash, webcrypto } from 'node:crypto'
import { HttpResponse, http } from 'msw'
import type { Clock } from '../../src/lib/clock'
import { server } from './msw-server'

/**
 * A stand-in for brew-v2's browser sign-in routes (`POST /api/cli/sessions`,
 * `POST /api/cli/sessions/{id}/token`), sealing keys exactly as
 * `lib/cli-login/seal.ts` `sealForCli` does: a fresh server P-256 key, ECDH
 * with the CLI's public key, HKDF-SHA256 (empty salt, info
 * `brew-cli-login-v1`), AES-256-GCM with the session id as associated data.
 */

export const T0 = Date.parse('2026-10-13T12:00:00.000Z')
export const SESSION_ID = 'Qm9ndXNTZXNzaW9uSWRGb3JUZXN0czAx'
export const USER_CODE = 'WDJB-MJHT'
export const CLI_KEY = 'brew_clikey0123456789abcdefghijklmnop'
export const APP_KEY = 'brew_appkey0123456789abcdefghijklmnop'
export const CLI_KEY_ID = 'key_cli_1'
export const APP_KEY_ID = 'key_app_1'
export const APPROVER_EMAIL = 'ada@acme.com'
export const BRAND = { brandId: 'bd_acme', name: 'Acme' } as const

export type FakeClock = Clock & {
  /** Every wait the CLI asked for, in ms. */
  readonly sleeps: number[]
}

/** Time that moves only when the CLI waits: a 10-minute poll in 0 ms. */
export function fakeClock(start = T0): FakeClock {
  let now = start
  const sleeps: number[] = []
  return {
    sleeps,
    now: () => now,
    sleep: async (ms, signal) => {
      signal.throwIfAborted()
      sleeps.push(ms)
      now += ms
    },
  }
}

export type TokenStep =
  | 'pending'
  | 'slow_down'
  | 'approved'
  | 'denied'
  | 'expired'
  | 'invalid_grant'
  | 'rate_limited'
  | 'server_error'

type CreateBody = {
  readonly publicKey: { kty: string; crv: string; x: string; y: string }
  readonly pollSecretHash: string
  readonly keys: readonly string[]
  readonly client: Record<string, unknown>
}

export type LoginServer = {
  readonly createBodies: CreateBody[]
  /** Poll secrets the CLI sent, one per poll. */
  readonly pollSecrets: string[]
  readonly polls: () => number
}

export function useLoginServer(
  options: {
    readonly origin?: string
    /** One answer per poll; the last one repeats. */
    readonly steps?: readonly TokenStep[]
    readonly expiresAt?: string
    readonly interval?: number
    /** Seal to this session id instead (a blob moved between sessions). */
    readonly sealSessionId?: string
    readonly createStatus?: number
  } = {}
): LoginServer {
  const origin = options.origin ?? 'https://brew.new'
  const steps = options.steps ?? ['approved']
  const createBodies: CreateBody[] = []
  const pollSecrets: string[] = []
  server.use(
    http.post(`${origin}/api/cli/sessions`, async ({ request }) => {
      if (options.createStatus !== undefined) {
        return HttpResponse.text('Not Found', { status: options.createStatus })
      }
      createBodies.push((await request.json()) as CreateBody)
      return HttpResponse.json(
        {
          sessionId: SESSION_ID,
          userCode: USER_CODE,
          verificationUrl: `${origin}/cli/authorize?session=${SESSION_ID}`,
          expiresAt:
            options.expiresAt ?? new Date(T0 + 10 * 60_000).toISOString(),
          interval: options.interval ?? 2,
        },
        { status: 201 }
      )
    }),
    http.post(
      `${origin}/api/cli/sessions/:sessionId/token`,
      async ({ request, params }) => {
        const { pollSecret } = (await request.json()) as { pollSecret: string }
        pollSecrets.push(pollSecret)
        const created = createBodies.at(-1)
        if (
          params.sessionId !== SESSION_ID ||
          created === undefined ||
          sha256(pollSecret) !== created.pollSecretHash
        ) {
          return HttpResponse.json({ error: 'invalid_grant' }, { status: 400 })
        }
        const step =
          steps[Math.min(pollSecrets.length - 1, steps.length - 1)] ?? 'pending'
        return await answer(step, created, options.sealSessionId ?? SESSION_ID)
      }
    )
  )
  return { createBodies, pollSecrets, polls: () => pollSecrets.length }
}

async function answer(
  step: TokenStep,
  created: CreateBody,
  sealSessionId: string
): Promise<Response> {
  switch (step) {
    case 'pending':
      return HttpResponse.json(
        { error: 'authorization_pending' },
        { status: 400 }
      )
    case 'slow_down':
      return HttpResponse.json({ error: 'slow_down' }, { status: 400 })
    case 'denied':
      return HttpResponse.json({ error: 'access_denied' }, { status: 403 })
    case 'expired':
      return HttpResponse.json({ error: 'expired_token' }, { status: 410 })
    case 'invalid_grant':
      return HttpResponse.json({ error: 'invalid_grant' }, { status: 400 })
    case 'rate_limited':
      return HttpResponse.json(
        { error: 'rate_limited', message: 'Too many polls.' },
        { status: 429, headers: { 'retry-after': '7' } }
      )
    case 'server_error':
      return HttpResponse.json({ error: 'server_error' }, { status: 500 })
    case 'approved': {
      const keys = [
        { kind: 'cli', keyId: CLI_KEY_ID, key: CLI_KEY },
        ...(created.keys.includes('app')
          ? [{ kind: 'app', keyId: APP_KEY_ID, key: APP_KEY }]
          : []),
      ]
      const sealed = await sealForCli(
        created.publicKey,
        sealSessionId,
        JSON.stringify({ v: 1, keys })
      )
      return HttpResponse.json({
        sealed,
        keys: keys.map(({ kind, keyId }) => ({ kind, keyId })),
        orgId: 'org_1',
        brand: BRAND,
        approver: { email: APPROVER_EMAIL },
        apiBaseUrl: 'https://brew.new/api',
      })
    }
  }
}

export function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('base64url')
}

const EC = { name: 'ECDH', namedCurve: 'P-256' } as const

/** brew-v2 `sealForCli`, from the client's JWK. */
export async function sealForCli(
  clientJwk: { x: string; y: string },
  sessionId: string,
  plaintext: string
): Promise<{ serverPublicKey: string; iv: string; ciphertext: string }> {
  const subtle = webcrypto.subtle
  const clientKey = await subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: clientJwk.x, y: clientJwk.y, ext: true },
    EC,
    false,
    []
  )
  const ephemeral = (await subtle.generateKey(EC, true, [
    'deriveBits',
  ])) as webcrypto.CryptoKeyPair
  const shared = await subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    ephemeral.privateKey,
    256
  )
  const ikm = await subtle.importKey('raw', shared, 'HKDF', false, [
    'deriveKey',
  ])
  const aesKey = await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(0),
      info: new TextEncoder().encode('brew-cli-login-v1'),
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  const iv = webcrypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
      additionalData: new TextEncoder().encode(sessionId),
      tagLength: 128,
    },
    aesKey,
    new TextEncoder().encode(plaintext)
  )
  const serverPublicKey = await subtle.exportKey('raw', ephemeral.publicKey)
  return {
    serverPublicKey: Buffer.from(serverPublicKey).toString('base64url'),
    iv: Buffer.from(iv).toString('base64url'),
    ciphertext: Buffer.from(ciphertext).toString('base64url'),
  }
}
