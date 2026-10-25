import { Resend as ResendClient } from 'resend'
import WelcomeEmail from '../../../../emails/welcome'

const marketing = new ResendClient(process.env.RESEND_MARKETING_KEY)
const note = "marketing.emails.send( is only text here"

export async function POST(request: Request) {
  const user = (await request.json()) as { email: string; name: string }
  const greeting = <p>Don't panic: {user.name}</p>
  await marketing.emails.send({
    from: 'Acme <hello@acme.com>',
    to: [user.email],
    subject: 'Welcome',
    react: <WelcomeEmail name={user.name} plan="pro" />,
    attachments: [],
  })
  return Response.json({ ok: true, note, greeting: String(greeting) })
}
