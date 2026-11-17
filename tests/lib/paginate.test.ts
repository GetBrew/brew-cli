import { describe, expect, it } from 'vitest'
import { defineCommand } from '../../src/lib/define-command'
import { collectAll } from '../../src/lib/paginate'
import { runCli } from '../helpers/run-cli'

describe('pagination protocol', () => {
  it.each([
    ['a', 'a'],
    ['a', 'b', 'a'],
  ])(
    'fails a cyclic drain without printing partial data',
    async (...cursors) => {
      const requested: Array<string | undefined> = []
      const command = defineCommand({
        path: ['pagination-fixture'],
        summary: 'Fixture',
        sdkMethod: null,
        commandClass: 'read',
        examples: ['brew-cli pagination-fixture'],
        run: async ({ ctx }) => ({
          data: await collectAll(ctx, async (cursor) => {
            requested.push(cursor)
            if (requested.length > cursors.length) {
              throw new Error('refetched a known page')
            }
            return {
              data: [requested.length],
              pagination: { cursor: cursors[requested.length - 1] ?? null },
            }
          }),
        }),
      })
      const result = await runCli(['pagination-fixture', '--quiet'], {
        extraCommands: [command],
      })
      expect(result.code).toBe(1)
      expect(result.stdout).toBe('')
      expect(JSON.parse(result.stderr)).toMatchObject({
        error: {
          code: 'CLI_PAGINATION',
          progress: {
            rowsFetched: cursors.length,
            pagesFetched: cursors.length,
          },
        },
      })
      expect(requested).toEqual([undefined, ...cursors.slice(0, -1)])
      expect(
        JSON.parse(result.stderr).error.progress.resumeCursor
      ).toBeUndefined()
    }
  )

  it('follows empty advancing pages and stops on a terminal or absent envelope', async () => {
    const requested: Array<string | undefined> = []
    const command = defineCommand({
      path: ['pagination-fixture'],
      summary: 'Fixture',
      sdkMethod: null,
      commandClass: 'read',
      examples: ['brew-cli pagination-fixture'],
      run: async ({ ctx }) => ({
        data: await collectAll(ctx, async (cursor) => {
          requested.push(cursor)
          return cursor === undefined
            ? { data: [], pagination: { cursor: 'a' } }
            : { data: [7] }
        }),
      }),
    })
    const result = await runCli(['pagination-fixture', '--quiet'], {
      extraCommands: [command],
    })
    expect(result.code).toBe(0)
    expect(result.json).toEqual([7])
    expect(requested).toEqual([undefined, 'a'])
  })
})
