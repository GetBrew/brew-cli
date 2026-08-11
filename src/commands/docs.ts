import { defineCommand } from '../lib/define-command'
import { buildManifest } from '../lib/manifest'

const DOCS_POINTERS = {
  documentation: 'https://docs.getbrew.io',
  openapiSpec: 'https://brew.new/openapi/public-api-v1.yaml',
  agentGuide: 'https://brew.new/api/v1/llms.txt',
  apiCatalog: 'https://brew.new/api/v1/help',
  createApiKeys: 'https://brew.new/settings/api',
}

export const docsCommand = defineCommand({
  path: ['docs'],
  summary: 'Documentation pointers; --agent prints the command manifest',
  sdkMethod: null,
  commandClass: 'read',
  flags: [
    {
      flag: '--agent',
      summary: 'Print the machine-readable manifest of every command',
    },
  ],
  examples: ['brew-cli docs', 'brew-cli docs --agent'],
  run: async ({ flags }) => {
    if (flags.agent === true) {
      return { data: buildManifest() }
    }
    return {
      data: DOCS_POINTERS,
      human: Object.entries(DOCS_POINTERS)
        .map(([key, url]) => `${key.padEnd(16)} ${url}`)
        .join('\n'),
    }
  },
})

export const docsApiCommand = defineCommand({
  path: ['docs', 'api'],
  summary: 'Fetch the live machine-readable API catalog (GET /v1/help)',
  sdkMethod: 'help.get',
  route: { method: 'GET', path: '/v1/help' },
  commandClass: 'read',
  examples: ['brew-cli docs api --json'],
  run: async ({ ctx }) => ({
    data: await ctx.client({ allowAnonymous: true }).help.get(),
  }),
})
