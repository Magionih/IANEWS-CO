import React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  name?: string
  confirmUrl?: string
  headline?: string
}

const Email = ({ name, confirmUrl, headline }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Sua assinatura do IA News ainda não foi confirmada</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>IA NEWS</Text>
        <Heading style={h1}>
          {name ? `${name}, falta confirmar` : 'Falta confirmar sua assinatura'}
        </Heading>
        <Text style={text}>
          Você se inscreveu no IA News, mas ainda não confirmou o e-mail — e por isso não está
          recebendo a edição diária.
        </Text>
        {headline ? <Text style={text}>Hoje você perderia: “{headline}”.</Text> : null}
        {confirmUrl ? (
          <Section style={{ margin: '28px 0' }}>
            <Button style={button} href={confirmUrl}>
              Confirmar agora
            </Button>
          </Section>
        ) : null}
        <Hr style={hr} />
        <Text style={small}>
          Se não foi você quem se inscreveu, basta ignorar este e-mail. Conteúdo completo em{' '}
          <Link href="https://ianews.site" style={{ color: '#2563eb' }}>
            ianews.site
          </Link>
          .
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: 'Falta 1 clique para receber o IA News',
  displayName: 'Lembrete de confirmação',
  previewData: { name: 'Ana', confirmUrl: 'https://ianews.site/confirmar?t=exemplo' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px' }
const eyebrow = {
  fontSize: '12px',
  letterSpacing: '2px',
  fontWeight: 700,
  color: '#2563eb',
  margin: '0 0 8px',
}
const h1 = { fontSize: '26px', lineHeight: '1.2', margin: '0 0 12px', color: '#0b1020' }
const text = { fontSize: '15px', lineHeight: '1.6', color: '#2c3345' }
const small = { fontSize: '12px', lineHeight: '1.6', color: '#6b7280' }
const button = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 700,
  padding: '14px 26px',
  borderRadius: '8px',
  textDecoration: 'none',
}
const hr = { borderColor: '#e5e7eb', margin: '28px 0 16px' }
