import { defineCommand } from '../../lib/define-command'
import { rawRequest } from '../../lib/raw-request'

type RunDataCommandResponse = {
  exitCode: number
  output: string
  truncated: boolean
}

/**
 * `brew-cli data run '<command>'` — the unified `db …` surface over the
 * brand's data (POST /v1/data): find/agg with --since/--until time
 * ranges + policy-gated writes, composable with jq/grep/sort pipes
 * inside the sandbox. Start with `db ls` and `db schema <table>`.
 *
 * Raw route while the installed SDK pre-dates `data.run` (the v9.1.0
 * binding lands with the SDK-alignment pass, same staging as the
 * contract commands). A failed COMMAND is a normal HTTP 200 with
 * `exitCode !== 0` and the message in `output` — the command prints it
 * and exits non-zero so shell scripts compose.
 */
export const dataRunCommand = defineCommand({
  path: ['data', 'run'],
  summary: "Run a `db …` command over the brand's data",
  sdkMethod: null,
  route: { method: 'POST', path: '/v1/data' },
  commandClass: 'read',
  args: [
    {
      name: 'command',
      summary: "The db command line, e.g. 'db find audiences --fields name'",
      isRequired: true,
    },
  ],
  flags: [],
  examples: [
    "brew-cli data run 'db ls'",
    "brew-cli data run 'db find contacts --since 30d --fields email --limit 20'",
    "brew-cli data run 'db agg analyticsEvents --since 7d --group-by eventType --bucket day'",
  ],
  run: async ({ ctx, args }) => {
    const result = await rawRequest<RunDataCommandResponse>(ctx, {
      method: 'POST',
      path: '/v1/data',
      body: { command: args.command ?? '' },
    })
    return {
      data: result,
      human: result.output,
      exitCode: result.exitCode === 0 ? 0 : 1,
    }
  },
})
