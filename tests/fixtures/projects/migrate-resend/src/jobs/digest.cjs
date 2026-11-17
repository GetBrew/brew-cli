const { Resend } = require('resend')

const resend = new Resend(process.env.RESEND_API_KEY)

async function run() {
  await resend.batch.send([
    { to: 'a@example.com', html: '<p>Hi</p>' },
    { to: 'b@example.com', template: { id: 'digest' } },
  ])
  await resend.emails.send({
    to: 'c@example.com',
    text: 'plain text',
    cc: 'boss@example.com',
    scheduledAt: 'in 1 hour',
  })
  const re = /resend\.emails\.send\(/g
  return re
}

module.exports = { run }
