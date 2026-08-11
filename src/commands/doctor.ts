import { BrewApiError } from '@brew.new/sdk'
import { maskApiKey, resolveAuth } from '../lib/client'
import { defineCommand } from '../lib/define-command'
import { CliApiError } from '../lib/errors'
import { ALL_COMMANDS } from '../registry'

/** Discovery endpoints without a dedicated command route. */
const NON_COMMAND_OPS = new Set(['GET /v1/llms.txt'])

export const doctorCommand = defineCommand({
  path: ['doctor'],
  summary:
    'Trust check: auth, API reachability, and installed-CLI vs live-API drift',
  sdkMethod: null,
  commandClass: 'read',
  examples: ['brew-cli doctor', 'brew-cli doctor --json'],
  run: async ({ ctx }) => {
    const auth = resolveAuth({
      globals: ctx.globals,
      env: ctx.io.env,
      allowAnonymous: true,
    })
    const isKeyPresent = auth.apiKeySource !== 'anonymous'
    const anonymous = ctx.client({ allowAnonymous: true })

    let isReachable = false
    let apiVersion: string | null = null
    let reachabilityError: string | null = null
    try {
      const health = (await anonymous.health.get()) as {
        status?: string
        version?: string
      }
      isReachable = health.status === 'ok'
      apiVersion = health.version ?? null
    } catch (error) {
      reachabilityError = error instanceof Error ? error.message : String(error)
    }

    let isAuthValid: boolean | null = null
    let plan: string | null = null
    if (isKeyPresent && isReachable) {
      try {
        const usage = (await ctx.client().usage.get()) as {
          plan?: { key?: string }
        }
        isAuthValid = true
        plan = usage.plan?.key ?? null
      } catch (error) {
        if (
          (error instanceof BrewApiError || error instanceof CliApiError) &&
          (error.status === 401 || error.status === 403)
        ) {
          isAuthValid = false
        }
        // Other failures leave auth unknown; reachability already reported.
      }
    }

    let missingLocally: readonly string[] = []
    let extraLocally: readonly string[] = []
    let isSurfaceChecked = false
    if (isReachable) {
      try {
        const help = (await anonymous.help.get()) as {
          endpoints?: ReadonlyArray<{ method?: string; path?: string }>
        }
        const liveOps = new Set(
          (help.endpoints ?? [])
            .filter((e) => e.method !== undefined && e.path !== undefined)
            .map((e) => `${e.method} ${e.path}`)
        )
        const localOps = new Set(
          ALL_COMMANDS.flatMap((spec) =>
            spec.route === undefined
              ? []
              : [`${spec.route.method} ${spec.route.path}`]
          )
        )
        missingLocally = [...liveOps].filter(
          (op) => !(localOps.has(op) || NON_COMMAND_OPS.has(op))
        )
        extraLocally = [...localOps].filter((op) => !liveOps.has(op))
        isSurfaceChecked = true
      } catch {
        // /v1/help unavailable — surface check stays unperformed.
      }
    }

    const isHealthy =
      isReachable &&
      isAuthValid !== false &&
      isSurfaceChecked &&
      missingLocally.length === 0
    const data = {
      ok: isHealthy,
      apiUrl: auth.apiUrl,
      apiVersion,
      reachable: isReachable,
      ...(reachabilityError === null ? {} : { reachabilityError }),
      apiKey: isKeyPresent ? maskApiKey(auth.apiKey) : null,
      apiKeySource: isKeyPresent ? auth.apiKeySource : null,
      authValid: isAuthValid,
      plan,
      brandId: auth.brandId ?? null,
      surface: {
        checked: isSurfaceChecked,
        commands: ALL_COMMANDS.length,
        missingLocally,
        extraLocally,
      },
    }
    const lines = [
      `${isReachable ? 'ok' : 'FAIL'}  api ${auth.apiUrl} (${apiVersion ?? 'unreachable'})`,
      isKeyPresent
        ? `${isAuthValid === false ? 'FAIL' : isAuthValid === true ? 'ok' : '??'}  auth ${maskApiKey(auth.apiKey)} via ${auth.apiKeySource}${plan === null ? '' : ` (${plan} plan)`}`
        : '--  no API key (run `brew-cli login` or set BREW_API_KEY)',
      isSurfaceChecked
        ? missingLocally.length === 0
          ? `ok  surface in sync (${ALL_COMMANDS.length} commands cover the live API)`
          : `DRIFT  live API has ${missingLocally.length} operation(s) this CLI lacks — update @brew.new/cli:\n${missingLocally.map((op) => `      ${op}`).join('\n')}`
        : '--  surface not checked (API unreachable)',
      ...(extraLocally.length > 0
        ? [
            `note  ${extraLocally.length} local command route(s) unknown to this server (server behind the CLI?)`,
          ]
        : []),
    ]
    return {
      data,
      human: lines.join('\n'),
      exitCode: isHealthy ? 0 : 1,
    }
  },
})
