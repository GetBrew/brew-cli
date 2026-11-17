import { Body, Html, Text } from '@react-email/components'
import { Footer } from './components/footer'

export default function InvoiceEmail({ total }: { total: string }) {
  return (
    <Html>
      <Body>
        <Text>Total: {total}</Text>
        <Footer />
      </Body>
    </Html>
  )
}
