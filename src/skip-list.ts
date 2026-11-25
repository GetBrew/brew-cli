import type { HttpMethod } from './lib/define-command'

export type SdkSkip = {
  readonly sdkPath: string
  readonly reason: string
}

export type SpecSkip = {
  readonly method: HttpMethod
  readonly path: string
  readonly reason: string
}

export const SDK_SKIP_LIST: readonly SdkSkip[] = [
  {
    sdkPath: 'webhooks.attempts',
    reason:
      'the `webhooks` commands send raw requests (they predate the SDK resource); bind them when the CLI moves to a released SDK',
  },
  {
    sdkPath: 'webhooks.create',
    reason:
      'the `webhooks` commands send raw requests (they predate the SDK resource); bind them when the CLI moves to a released SDK',
  },
  {
    sdkPath: 'webhooks.delete',
    reason:
      'the `webhooks` commands send raw requests (they predate the SDK resource); bind them when the CLI moves to a released SDK',
  },
  {
    sdkPath: 'webhooks.events',
    reason:
      'the `webhooks` commands send raw requests (they predate the SDK resource); bind them when the CLI moves to a released SDK',
  },
  {
    sdkPath: 'webhooks.get',
    reason:
      'the `webhooks` commands send raw requests (they predate the SDK resource); bind them when the CLI moves to a released SDK',
  },
  {
    sdkPath: 'webhooks.list',
    reason:
      'the `webhooks` commands send raw requests (they predate the SDK resource); bind them when the CLI moves to a released SDK',
  },
  {
    sdkPath: 'webhooks.replay',
    reason:
      'the `webhooks` commands send raw requests (they predate the SDK resource); bind them when the CLI moves to a released SDK',
  },
  {
    sdkPath: 'webhooks.rotateSecret',
    reason:
      'the `webhooks` commands send raw requests (they predate the SDK resource); bind them when the CLI moves to a released SDK',
  },
  {
    sdkPath: 'webhooks.test',
    reason:
      'the `webhooks` commands send raw requests (they predate the SDK resource); bind them when the CLI moves to a released SDK',
  },
  {
    sdkPath: 'webhooks.update',
    reason:
      'the `webhooks` commands send raw requests (they predate the SDK resource); bind them when the CLI moves to a released SDK',
  },
  {
    sdkPath: 'webhooks.verify',
    reason:
      'local signature check for webhook receivers; the CLI does not receive webhooks',
  },
  {
    sdkPath: 'contacts.searchAll',
    reason: 'auto-pager covered by `contacts search --all`',
  },
  {
    sdkPath: 'analytics.eventsAll',
    reason: 'auto-pager covered by `analytics events --all`',
  },
  {
    sdkPath: 'sends.listAll',
    reason: 'auto-pager covered by `sends list --all`',
  },
  {
    sdkPath: 'automations.triggerInstances.listAll',
    reason: 'auto-pager covered by `automations trigger-instances list --all`',
  },
  {
    sdkPath: 'chats.listAll',
    reason: 'auto-pager covered by `chats list --all`',
  },
  {
    sdkPath: 'emails.comments.listAllMessages',
    reason:
      'auto-pager covered by `emails comments list <emailId> --comment-id <id> --all`',
  },
  {
    sdkPath: 'notifications.listAll',
    reason: 'auto-pager covered by `notifications list --all`',
  },
  {
    sdkPath: 'brand.update',
    reason: 'SDK alias of brand.patch, exposed as `brand update`',
  },
  {
    sdkPath: 'brands.waitForExtraction',
    reason:
      'read-only SDK polling helper over brands.get; lifecycle reads are exposed by `brands get`',
  },
  {
    sdkPath: 'withBrand',
    reason:
      'client scoping helper activated by the global `--brand`; not an API command',
  },
]

export const SPEC_SKIP_LIST: readonly SpecSkip[] = []
