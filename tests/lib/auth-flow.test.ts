import { describe, expect, it } from 'vitest'
import { detectRemoteEnv } from '../../src/lib/auth-flow/remote-env'
import {
  exportPrivateJwk,
  generateLoginKeyPair,
  generatePollSecret,
  hashPollSecret,
  importPrivateJwk,
  parseSealedPayload,
  unseal,
} from '../../src/lib/auth-flow/seal'
import { siteUrlFromApiUrl } from '../../src/lib/auth-flow/session'
import { browserOpener } from '../../src/lib/project/process'
import { sealForCli, sha256 } from '../helpers/login-server'

describe('detectRemoteEnv', () => {
  it.each([
    [{ CODESPACES: 'true' }, 'GitHub Codespaces'],
    [{ REPL_ID: 'abc' }, 'Replit'],
    [{ GITPOD_WORKSPACE_ID: 'ws-1' }, 'Gitpod'],
    [{ SSH_CONNECTION: '10.0.0.1 5000 10.0.0.2 22' }, 'an SSH session'],
    [{ CI: 'true' }, 'CI'],
  ])('%j is %s', (env, name) => {
    expect(detectRemoteEnv(env, {})?.name).toBe(name)
  })

  it('treats SSH with a display as local, and off spellings as unset', () => {
    expect(
      detectRemoteEnv({ SSH_CONNECTION: '1 2 3 4', DISPLAY: ':0' }, {})
    ).toBeUndefined()
    expect(detectRemoteEnv({ CI: 'false', CODESPACES: '0' }, {})).toBe(
      undefined
    )
    expect(detectRemoteEnv({}, {})).toBeUndefined()
  })

  it('spots a WebContainer from process.versions', () => {
    expect(detectRemoteEnv({}, { webcontainer: '1.0' })?.name).toBe(
      'a WebContainer'
    )
  })
})

describe('browserOpener', () => {
  const url = 'https://brew.new/cli/authorize?session=abc'

  it('picks the platform opener, wslview under WSL', () => {
    expect(browserOpener(url, 'darwin', {})).toEqual({
      command: 'open',
      args: [url],
    })
    expect(browserOpener(url, 'linux', {})).toEqual({
      command: 'xdg-open',
      args: [url],
    })
    expect(browserOpener(url, 'linux', { WSL_DISTRO_NAME: 'Ubuntu' })).toEqual({
      command: 'wslview',
      args: [url],
    })
    expect(browserOpener(url, 'win32', {})).toEqual({
      command: 'rundll32',
      args: ['url.dll,FileProtocolHandler', url],
    })
  })
})

describe('siteUrlFromApiUrl', () => {
  it('strips the /api suffix', () => {
    expect(siteUrlFromApiUrl('https://brew.new/api')).toBe('https://brew.new')
    expect(siteUrlFromApiUrl('http://localhost:3000/api/')).toBe(
      'http://localhost:3000'
    )
    expect(siteUrlFromApiUrl('https://tunnel.example/brew/api')).toBe(
      'https://tunnel.example/brew'
    )
  })

  it('refuses a URL that is not http(s)', () => {
    expect(() => siteUrlFromApiUrl('ftp://brew.new/api')).toThrow(/http\(s\)/)
    expect(() => siteUrlFromApiUrl('not a url')).toThrow(/http\(s\)/)
  })
})

describe('seal', () => {
  it('opens what brew-v2 sealForCli seals, bound to the session id', async () => {
    const pair = await generateLoginKeyPair()
    const plaintext = JSON.stringify({
      v: 1,
      keys: [{ kind: 'cli', keyId: 'k1', key: 'brew_secret' }],
    })
    const sealed = await sealForCli(pair.publicJwk, 'session-a', plaintext)
    expect(sealed.serverPublicKey).toMatch(/^[A-Za-z0-9_-]{87}$/)
    expect(sealed.iv).toMatch(/^[A-Za-z0-9_-]{16}$/)

    const opened = await unseal({
      privateKey: pair.privateKey,
      sessionId: 'session-a',
      sealed,
    })
    expect(parseSealedPayload(opened)).toEqual({
      v: 1,
      keys: [{ kind: 'cli', keyId: 'k1', key: 'brew_secret' }],
    })
    await expect(
      unseal({ privateKey: pair.privateKey, sessionId: 'session-b', sealed })
    ).rejects.toThrow()
  })

  it('survives a round trip through the persisted private JWK', async () => {
    const pair = await generateLoginKeyPair()
    const restored = await importPrivateJwk(
      await exportPrivateJwk(pair.privateKey)
    )
    const sealed = await sealForCli(pair.publicJwk, 's', '{"v":1,"keys":[]}')
    expect(await unseal({ privateKey: restored, sessionId: 's', sealed })).toBe(
      '{"v":1,"keys":[]}'
    )
  })

  it('refuses another key pair', async () => {
    const pair = await generateLoginKeyPair()
    const other = await generateLoginKeyPair()
    const sealed = await sealForCli(pair.publicJwk, 's', '{}')
    await expect(
      unseal({ privateKey: other.privateKey, sessionId: 's', sealed })
    ).rejects.toThrow()
  })

  it('makes a 43-character poll secret and hashes it as the server does', () => {
    const secret = generatePollSecret()
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(generatePollSecret()).not.toBe(secret)
    expect(hashPollSecret(secret)).toBe(sha256(secret))
    expect(hashPollSecret(secret)).toHaveLength(43)
  })

  it('rejects payloads outside the contract', () => {
    expect(parseSealedPayload('not json')).toBeUndefined()
    expect(parseSealedPayload('{"v":2,"keys":[]}')).toBeUndefined()
    expect(
      parseSealedPayload(
        '{"v":1,"keys":[{"kind":"root","keyId":"k","key":"x"}]}'
      )
    ).toBeUndefined()
  })
})
