import { inputField, singleRowPage } from '../../../lib/compat'
import { defineCommand } from '../../../lib/define-command'
import {
  flagInt,
  flagString,
  INPUT_FLAG,
  mergeInput,
  readJsonFlag,
} from '../../../lib/input'
import { ALL_FLAG, CURSOR_FLAG, LIMIT_FLAG } from '../../../lib/paginate'
import {
  listTriggerInstances,
  renderInstances,
} from '../../automations/trigger-instances/list'

/**
 * The name agents already know. Trigger instances moved under automations;
 * one instance by id is `automations trigger-instances get`.
 */
export const analyticsTriggerInstancesListCommand = defineCommand({
  path: ['analytics', 'trigger-instances', 'list'],
  summary:
    'List fired-trigger instances with their lifecycle `state` (`automations trigger-instances list`)',
  sdkMethod: null,
  derivedFrom: 'automations.triggerInstances.list',
  route: { method: 'GET', path: '/v1/automations/trigger-instances' },
  commandClass: 'read',
  flags: [
    {
      flag: '--trigger <triggerEventId>',
      summary: 'Filter by trigger event',
    },
    {
      flag: '--trigger-instance <triggerInstanceId>',
      summary:
        '0.6 shim: read ONE instance as a single-row page (`automations trigger-instances get` is the real read)',
    },
    LIMIT_FLAG,
    CURSOR_FLAG,
    ALL_FLAG,
    INPUT_FLAG,
  ],
  examples: [
    'brew-cli analytics trigger-instances list --trigger tri_signup',
    'brew-cli analytics trigger-instances list --all --json',
  ],
  run: async ({ ctx, flags }) => {
    const base = await readJsonFlag(ctx, flags.input, '--input')
    const triggerInstanceId =
      flagString(flags.triggerInstance) ?? inputField(base, 'triggerInstanceId')
    if (triggerInstanceId !== undefined) {
      const row = await ctx
        .client()
        .automations.triggerInstances.get(triggerInstanceId)
      return { data: singleRowPage(row), human: renderInstances([row]) }
    }
    const input = mergeInput(base, {
      triggerEventId: flagString(flags.trigger),
      limit: flagInt(flags.limit, '--limit'),
      cursor: flagString(flags.cursor),
    })
    return await listTriggerInstances(ctx, input, flags.all === true)
  },
})
