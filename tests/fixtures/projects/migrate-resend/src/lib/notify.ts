import { resend } from './resend'

/* resend.emails.send({ html: 'a comment, not a call' }) */
export async function sendPasswordReset(email: string, resetUrl: string) {
  return resend.emails.send({
    from: 'Acme <hello@acme.com>',
    to: email,
    template: {
      id: 'reset-password',
      variables: { RESET_URL: resetUrl },
    },
  })
}

export async function sendReceipt(email: string, total: string) {
  const template = { id: 'tmpl_receipt_1', variables: { TOTAL: total } }
  return resend.emails.send({ to: [email], template })
}
