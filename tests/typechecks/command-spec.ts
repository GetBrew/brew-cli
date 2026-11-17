import { defineCommand } from '../../src/lib/define-command'

const base = {
  path: ['fixture'],
  summary: 'Typecheck fixture',
  sdkMethod: null,
  examples: ['brew-cli fixture'],
  run: async () => undefined,
}

// @ts-expect-error Destructive commands must describe their confirmation gate.
defineCommand({ ...base, commandClass: 'destructive' })

// @ts-expect-error Only destructive commands can declare a confirmation gate.
defineCommand({
  ...base,
  commandClass: 'write',
  confirmSummary: () => 'Confirm',
})

defineCommand({
  ...base,
  commandClass: 'destructive',
  confirmSummary: () => 'Confirm',
})
defineCommand({ ...base, commandClass: 'read' })
