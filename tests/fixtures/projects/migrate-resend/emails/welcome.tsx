import { Body, Button, Html, Text } from '@react-email/components'

export default function WelcomeEmail({ name, plan = 'free' }: { name: string; plan?: string }) {
  return (
    <Html>
      <Body>
        <Text>Welcome, {name}!</Text>
        <Text>You are on the {plan} plan.</Text>
        <Button href="https://acme.com/start">Get started</Button>
      </Body>
    </Html>
  )
}
