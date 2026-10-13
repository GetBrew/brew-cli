---
name: brew-app-emails
description: Send and change this app's emails through Brew, covering auth emails (verify, magic link, one-time code, password reset), lifecycle emails (welcome, trial ending, payment failed) and your own keyed emails. Use when code sends an email, an auth library needs an email callback, or a send fails with TRIGGER_KEY_NOT_FOUND, DOMAIN_REQUIRED or SANDBOX_DAILY_LIMIT.
---

# App emails with Brew

Every email this app sends has a **trigger key** (`auth.password-reset`,
`lifecycle.welcome`, `order.paid`). Brew holds the design and the
automation behind the key; code only sends the key and a payload:

```ts
import { getBrew } from './lib/brew' // written by `npx brew.new init`

await getBrew().send(
  'auth.password-reset',
  { email: user.email, userName: user.name, confirmationUrl: resetUrl },
  { idempotencyKey: `auth.password-reset:${tokenId}` } // a retry never sends twice
)
```

`brew.json` (committed) lists the keys this project set up;
`lib/brew-contracts.ts` types each key's payload and makes an unknown key a
compile error. Regenerate it after changing a payload contract:
`npx brew.new types --out lib/brew-contracts.ts`.

## Rules

- Send from server code only. `BREW_API_KEY` lives in `.env.local`
  (git-ignored); never give it a `NEXT_PUBLIC_`, `VITE_` or `PUBLIC_` name,
  never print it, never commit it.
- Derive `idempotencyKey` from what makes the email unique (the token id,
  the order id, the user id), never from the token itself.
- Fields like `confirmationUrl` and `otp` are template-only secrets: Brew
  renders them and never stores them on the contact.

## Auth libraries

`lib/brew-auth.ts` wires the one this app uses:

- Better Auth: `brewEmails` from `@brew.new/sdk/better-auth` goes into
  `betterAuth({ emailVerification, emailAndPassword, databaseHooks })`.
- Auth.js: `brewEmailProvider` (`@brew.new/sdk/next-auth`) goes into
  `providers`; email sign-in needs a database adapter.
- Supabase: the Send Email Hook in `supabase/functions/send-email` sends
  every auth email; deploy it and point Authentication > Hooks at it.
- Clerk, Firebase, WorkOS, Stytch: the provider keeps its auth emails;
  Brew sends lifecycle emails (`sendWelcomeEmail`).

## A new email

```bash
npx brew.new app-emails upsert order.paid --source-file emails/order-paid.tsx --subject "Order confirmed" --yes
npx brew.new types --out lib/brew-contracts.ts
npx brew.new send order.paid --to you@example.com --data '{"orderId":"ord_1"}' --yes
```

A design edited in Brew is never replaced: `upsert` answers
`409 APP_EMAIL_EDITED_IN_BREW` until you pass `--overwrite`.

## When a send fails

| Error | Meaning | Fix |
| --- | --- | --- |
| `TRIGGER_KEY_NOT_FOUND` (404) | No trigger has the key in this brand | `npx brew.new app-emails list`; set it up with `app-emails upsert` or `init` |
| `NO_PUBLISHED_AUTOMATION` (422) | The key exists, nothing publishes it | `npx brew.new app-emails upsert <key> --yes` |
| `DOMAIN_REQUIRED` | Sandbox: the recipient is not in your Brew organization | Verify a sending domain (`npx brew.new domains add <host>`) |
| `SANDBOX_DAILY_LIMIT` (429) | The team sandbox's daily cap is spent | Verify a domain, or wait for the UTC day |
| `INVALID_PAYLOAD` | The payload misses a required field | Check `lib/brew-contracts.ts`; `details.errors[]` names the field |

Until a sending domain verifies, app emails go out from Brew's team-only
sandbox: members of your Brew organization receive them, nobody else.
