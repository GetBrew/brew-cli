---
name: brew-migrate-from-resend
description: Move an app and its Resend account to Brew with `brew-cli migrate resend`, covering templates and React Email as app emails, contacts, segments, topics, suppressions and broadcast drafts, plus the code that calls resend.emails.send. Use when a project depends on `resend`, someone asks to switch from Resend to Brew, or a migration report (brew.migration.json) needs finishing.
---

# Migrate from Resend to Brew

Plan first, review with the person, then apply. Nothing in Resend is
changed or deleted, and the Resend key never leaves this machine for Brew.

```bash
# 1. Plan: reads Resend (2 requests a second) and Brew, scans the code,
#    writes brew.migration.json. Changes nothing.
printf %s "$RESEND_API_KEY" | npx @brew.new/cli migrate resend --resend-key-stdin --json

# 2. Apply after the person reviewed the plan (destructive class: exit 4
#    without --yes). Re-running resumes; done items are skipped.
printf %s "$RESEND_API_KEY" | npx @brew.new/cli migrate resend --resend-key-stdin --apply --domain <brew-marketing-domain> --yes --json
```

Ask the person for a **full-access** Resend key (a sending-only key exits 3
with `RESEND_KEY_SENDING_ONLY`). Pass it on stdin; never print it, write
it to a file, or put it in a command line that gets logged. Brew needs its
own key (`brew-cli login`, or `BREW_API_KEY`).

## What moves where

| Resend | Brew |
| --- | --- |
| Template (`{{{VAR}}}`) | App email by key (alias or name), published if it was; placeholders become `{{ trigger.VAR }}` |
| React Email file | App email by key (file name); props become merge tags |
| Contact | Contact; subscribed ones with an import consent record, unsubscribed stay unsubscribed; no state, left out |
| Segment | Boolean field `resend_segment_*` and an audience on it |
| Topic | Boolean field `resend_topic_*` (true = opted in) and an audience; one Resend request per contact |
| Suppression, unsubscribed contact | The `--domain`'s unsubscribe list |
| Draft broadcast | A Brew draft email (nothing is sent) |
| Domain, webhook, automation | Reported only |

Brew signs mail with the same DKIM selector as Resend (`resend._domainkey`),
so a domain cannot verify in both. Verify a subdomain in Brew (the plan
suggests one, e.g. `mail.acme.com`) and keep the Resend domain until
cutover.

## Finish the code

- Every remaining `resend.emails.send` / `resend.batch.send` is a blocking
  `edit-file` next step with a suggested `getBrew().send(key, payload)`.
  `attachments`, `cc`, `bcc`, `headers`, `scheduledAt` and raw `html` do
  not carry over: say so to the person instead of dropping them silently.
- `--rewrite-imports` (with `--apply`) moves a file to
  `@brew.new/sdk/resend` only when every send through it is a migrated
  template, and writes `lib/brew-resend-map.ts`.
- Then send one migrated email to yourself (`brew-cli send <key> --to
  <you> --yes`; before a domain verifies, Brew delivers to your team only)
  and cut over: production gets `BREW_API_KEY`, then retire
  `RESEND_API_KEY` and the `resend` package.

`brew.migration.json` holds ids, keys, counts and cursors, never an
address, a name or a key: it is safe to commit.
