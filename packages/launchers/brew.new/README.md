# brew.new

Set up [Brew](https://brew.new) email in your app with one command:

```bash
npx brew.new init
```

`init` finds your framework and auth library, signs you in through the
browser, sets up the auth and lifecycle starter emails, installs
`@brew.new/sdk`, writes `lib/brew.ts` (and the helpers for Better Auth,
Auth.js or Supabase), puts the app key in `.env.local`, connects your AI
editor to the Brew MCP server, and sends you a test email. It never
overwrites a file you changed.

```bash
npx brew.new init --dry-run --json   # the plan, nothing changed
npx brew.new init --yes --json       # for agents: exit 3 means approve the sign-in, then run the resume command
```

Every other command works too: `npx brew.new send lifecycle.welcome --to you@example.com --yes`.

This package is a launcher for [`@brew.new/cli`](https://www.npmjs.com/package/@brew.new/cli)
(pinned to the same version). Docs: https://docs.brew.new
