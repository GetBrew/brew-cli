import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../helpers/msw-server'
import { runCli } from '../helpers/run-cli'

describe('completed import validation output', () => {
  it.each(['import', 'import-csv'])(
    '%s shows paid check outcomes on a terminal and preserves JSON',
    async (command) => {
      const response = {
        summary: { inserted: 1, updated: 0, failed: 0, skipped: 0, total: 1 },
        fieldsCreated: [],
        errors: [],
        warnings: [],
        importId: 'imp_checked',
        validation: {
          valid: 0,
          risky: 0,
          invalid: 0,
          unscored: 1,
          persistence: { matched: 1, modified: 0, failed: 1 },
        },
      }
      server.use(
        http.post(
          `https://brew.new/api/v1/contacts/${command}`,
          async ({ request }) => {
            expect(await request.json()).toMatchObject({ validate: true })
            return HttpResponse.json(response)
          }
        )
      )
      const options = {
        env: {
          BREW_API_KEY: 'brew_validation_output_abcdefghijklmnopqrstuvwxyz',
        },
        stdin:
          command === 'import'
            ? '[{"email":"jane@example.com"}]'
            : 'Email\njane@example.com\n',
        ttyOut: true,
      }
      const args = ['contacts', command, '--file', '-', '--validate']
      const human = await runCli(args, options)
      expect(human.code).toBe(0)
      expect(human.stdout).toContain('0 valid, 0 risky, 0 invalid, 1 unscored.')
      expect(human.stdout).toContain('1 failed to save.')

      const json = await runCli([...args, '--json'], options)
      expect(json.code).toBe(0)
      expect(json.json).toEqual(response)
    }
  )
})
