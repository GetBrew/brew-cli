import { HttpResponse, http } from 'msw'
import type { Clock } from '../../src/lib/clock'

/**
 * A Resend account behind `https://api.resend.com`, for `migrate resend`.
 * Lists page with `limit` / `after` like the real API, every request is
 * recorded with the clock's time (to check the pacing), and the
 * authorization header is checked against the expected key.
 */

export const RESEND_API = 'https://api.resend.com'

type Row = Record<string, unknown>

export type ResendAccount = {
  readonly domains: Row[]
  readonly templates: Row[]
  readonly templateDetails: Record<string, Row>
  readonly contacts: Row[]
  readonly segments: Row[]
  readonly segmentContacts: Record<string, Row[]>
  readonly topics: Row[]
  readonly contactTopics: Record<string, Row[]>
  readonly suppressions: Row[]
  readonly broadcasts: Row[]
  readonly broadcastDetails: Record<string, Row>
  readonly webhooks: Row[]
  readonly automations: Row[]
}

export const RESEND_ACCOUNT: ResendAccount = {
  domains: [
    { id: 'rdom_1', name: 'acme.com', status: 'verified', region: 'us-east-1' },
  ],
  templates: [
    {
      id: 'tmpl_reset',
      name: 'Reset password',
      alias: 'reset-password',
      status: 'published',
    },
    {
      id: 'tmpl_receipt_1',
      name: 'Receipt',
      alias: null,
      status: 'draft',
    },
  ],
  templateDetails: {
    tmpl_reset: {
      id: 'tmpl_reset',
      name: 'Reset password',
      alias: 'reset-password',
      status: 'published',
      subject: 'Reset your password',
      from: 'Acme <hello@acme.com>',
      html: '<p>Hi {{{FIRST_NAME|there}}}, <a href="{{{RESET_URL}}}">reset</a></p>',
      variables: [
        { key: 'RESET_URL', type: 'string', fallback_value: null },
        { key: 'PRODUCT', type: 'string', fallback_value: 'Acme' },
      ],
    },
    tmpl_receipt_1: {
      id: 'tmpl_receipt_1',
      name: 'Receipt',
      alias: null,
      status: 'draft',
      subject: 'Your receipt',
      from: { name: 'Acme Billing', email: 'billing@acme.com' },
      html: '<p>Total: {{{TOTAL}}}</p>',
      variables: [{ key: 'TOTAL', type: 'string', fallback_value: null }],
    },
  },
  contacts: [
    {
      id: 'ct_1',
      email: 'ada@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      unsubscribed: false,
      properties: { plan: { value: 'pro' } },
    },
    {
      id: 'ct_2',
      email: 'bob@example.com',
      first_name: 'Bob',
      last_name: null,
      unsubscribed: true,
    },
    { id: 'ct_3', email: 'carol@example.com', first_name: 'Carol' },
  ],
  segments: [{ id: 'seg_1', name: 'Beta users' }],
  segmentContacts: {
    seg_1: [
      { id: 'ct_1', email: 'ada@example.com', unsubscribed: false },
      { id: 'ct_2', email: 'bob@example.com', unsubscribed: true },
      { id: 'ct_3', email: 'carol@example.com' },
    ],
  },
  topics: [
    { id: 'top_1', name: 'Product updates', default_subscription: 'opt_in' },
  ],
  contactTopics: {
    ct_1: [{ id: 'top_1', name: 'Product updates', subscription: 'opt_in' }],
    ct_2: [{ id: 'top_1', name: 'Product updates', subscription: 'opt_out' }],
  },
  suppressions: [
    { id: 'sup_1', email: 'bounced@example.com', origin: 'bounce' },
  ],
  broadcasts: [
    { id: 'bc_1', name: 'October news', status: 'draft', segment_id: 'seg_1' },
    { id: 'bc_2', name: 'Launch', status: 'sent', segment_id: 'seg_1' },
  ],
  broadcastDetails: {
    bc_1: {
      id: 'bc_1',
      name: 'October news',
      status: 'draft',
      segment_id: 'seg_1',
      subject: 'October news',
      html: '<p>Hi {{{FIRST_NAME|there}}}</p><a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a>',
    },
  },
  webhooks: [
    {
      id: 'wh_1',
      endpoint: 'https://hooks.acme.com/resend?token=WEBHOOKTOKEN123',
      events: ['email.sent', 'email.bounced'],
      status: 'enabled',
    },
  ],
  automations: [{ id: 'auto_1', name: 'Onboarding', status: 'enabled' }],
}

export type ResendRequest = {
  readonly path: string
  readonly after: string | null
  readonly at: number
  readonly authorization: string | null
}

/** Rows after `after`, `limit` at a time, as Resend pages them. */
function pageOf(rows: readonly Row[], url: URL) {
  const limit = Number(url.searchParams.get('limit') ?? '100')
  const after = url.searchParams.get('after')
  const start =
    after === null ? 0 : rows.findIndex((row) => row.id === after) + 1
  const data = rows.slice(start, start + limit)
  return {
    object: 'list',
    has_more: start + limit < rows.length,
    data,
  }
}

export function useResendApi(input: {
  readonly key: string
  readonly clock: Clock
  readonly account?: ResendAccount
  /** Rows per page (the CLI asks for 100; a smaller page tests paging). */
  readonly pageSize?: number
  /** Answer every request with this status and body instead. */
  readonly reject?: { readonly status: number; readonly body: Row }
}) {
  const account = input.account ?? RESEND_ACCOUNT
  const requests: ResendRequest[] = []
  const list = (rows: readonly Row[]) => (url: URL) => {
    const sized = new URL(url)
    if (input.pageSize !== undefined) {
      sized.searchParams.set('limit', String(input.pageSize))
    }
    return pageOf(rows, sized)
  }
  const routes: Array<[RegExp, (url: URL, match: RegExpExecArray) => unknown]> =
    [
      [/^\/domains$/, list(account.domains)],
      [/^\/templates$/, list(account.templates)],
      [
        /^\/templates\/([^/]+)$/,
        (_url, match) => account.templateDetails[match[1] ?? ''],
      ],
      [/^\/contacts$/, list(account.contacts)],
      [
        /^\/contacts\/([^/]+)\/topics$/,
        (url, match) => list(account.contactTopics[match[1] ?? ''] ?? [])(url),
      ],
      [/^\/segments$/, list(account.segments)],
      [
        /^\/segments\/([^/]+)\/contacts$/,
        (url, match) =>
          list(account.segmentContacts[match[1] ?? ''] ?? [])(url),
      ],
      [/^\/topics$/, list(account.topics)],
      [/^\/suppressions$/, list(account.suppressions)],
      [/^\/broadcasts$/, list(account.broadcasts)],
      [
        /^\/broadcasts\/([^/]+)$/,
        (_url, match) => account.broadcastDetails[match[1] ?? ''],
      ],
      [/^\/webhooks$/, list(account.webhooks)],
      [/^\/automations$/, list(account.automations)],
    ]
  const handler = http.get(`${RESEND_API}/*`, ({ request }) => {
    const url = new URL(request.url)
    requests.push({
      path: url.pathname,
      after: url.searchParams.get('after'),
      at: input.clock.now(),
      authorization: request.headers.get('authorization'),
    })
    if (request.headers.get('authorization') !== `Bearer ${input.key}`) {
      return HttpResponse.json(
        {
          statusCode: 401,
          name: 'validation_error',
          message: 'API key is invalid',
        },
        { status: 401 }
      )
    }
    if (input.reject !== undefined) {
      return HttpResponse.json(input.reject.body, {
        status: input.reject.status,
      })
    }
    for (const [pattern, answer] of routes) {
      const match = pattern.exec(url.pathname)
      if (match !== null) {
        const body = answer(url, match)
        return body === undefined
          ? HttpResponse.json(
              { statusCode: 404, name: 'not_found', message: 'Not found' },
              { status: 404 }
            )
          : HttpResponse.json(body)
      }
    }
    return HttpResponse.json(
      { statusCode: 404, name: 'not_found', message: 'Not found' },
      { status: 404 }
    )
  })
  return { handler, requests }
}
