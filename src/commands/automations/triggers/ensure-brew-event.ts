import type { EnsureBrewEventTriggerInput } from '@brew.new/sdk'
import { defineCommand } from '../../../lib/define-command'
import { CliUsageError } from '../../../lib/errors'
import {
  asSdkInput,
  flagString,
  IDEMPOTENCY_FLAG,
  requestOptions,
} from '../../../lib/input'

const BREW_EVENTS: ReadonlySet<string> = new Set(['contact.unsubscribed'])
const SCOPES: ReadonlySet<string> = new Set(['domain', 'all'])

/**
 * Brew starts these triggers itself (the first is a contact unsubscribing),
 * so there is nothing to author: the scope names the trigger, and the same
 * scope always returns the same row (`created` says whether this call made
 * it). `fire` refuses them with `409 TRIGGER_NOT_FIREABLE`.
 */
export const automationsTriggersEnsureBrewEventCommand = defineCommand({
  path: ['automations', 'triggers', 'ensure-brew-event'],
  summary:
    "Get or create the brand's trigger for a contact unsubscribing (one domain's list, or all emails)",
  sdkMethod: 'automations.triggers.ensureBrewEvent',
  route: { method: 'POST', path: '/v1/automations/triggers/brew-events' },
  commandClass: 'write',
  flags: [
    {
      flag: '--scope <scope>',
      summary:
        "domain (one marketing domain's list, with --domain-id) | all (every email the brand sends)",
    },
    {
      flag: '--domain-id <domainId>',
      summary:
        'The marketing domain for --scope domain (ids from domains list)',
    },
    {
      flag: '--event <event>',
      summary: 'The Brew event (default contact.unsubscribed)',
    },
    IDEMPOTENCY_FLAG,
  ],
  examples: [
    'brew-cli automations triggers ensure-brew-event --scope domain --domain-id jd7f0c2a8w1x9m4n6p3q5r8s2t',
    'brew-cli automations triggers ensure-brew-event --scope all',
  ],
  run: async ({ ctx, flags }) => {
    const scope = flagString(flags.scope)
    if (scope === undefined) {
      throw new CliUsageError('--scope is required (domain | all).')
    }
    if (!SCOPES.has(scope)) {
      throw new CliUsageError(
        `Unknown --scope '${scope}' (expected domain | all).`
      )
    }
    const domainId = flagString(flags.domainId)
    if (scope === 'domain' && domainId === undefined) {
      throw new CliUsageError(
        '--scope domain needs --domain-id (ids from brew-cli domains list).'
      )
    }
    if (scope === 'all' && domainId !== undefined) {
      throw new CliUsageError('--domain-id applies only to --scope domain.')
    }
    const event = flagString(flags.event) ?? 'contact.unsubscribed'
    if (!BREW_EVENTS.has(event)) {
      throw new CliUsageError(
        `Unknown --event '${event}' (expected contact.unsubscribed).`
      )
    }
    const result = await ctx.client().automations.triggers.ensureBrewEvent(
      asSdkInput<EnsureBrewEventTriggerInput>({
        event,
        scope,
        ...(domainId === undefined ? {} : { domainId }),
      }),
      requestOptions(flags)
    )
    return { data: result }
  },
})
