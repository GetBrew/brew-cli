# create-brew

Set up [Brew](https://brew.new) email in your app:

```bash
npm create brew@latest
# pnpm create brew · yarn create brew · bun create brew
```

It runs `init` from [`@brew.new/cli`](https://www.npmjs.com/package/@brew.new/cli)
(pinned to the same version): detect your framework and auth library, sign
in through the browser, set up the auth and lifecycle starter emails,
install `@brew.new/sdk`, write `lib/brew.ts`, put the app key in
`.env.local`, connect your AI editor, and send you a test email. Pass
flags after `--`: `npm create brew@latest -- --dry-run --json`.

The same launcher as `npx brew.new init`. Docs: https://docs.brew.new
