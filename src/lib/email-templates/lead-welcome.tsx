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
  origin?: string
}

const Email = ({ name, confirmUrl, origin }: Props) => (
  <Html lang="pt-BR" dir="ltr">
    <Head />
    <Preview>Confirme sua assinatura do IA News e receba a edição diária</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>IA NEWS</Text>
        <Heading style={h1}>{name ? `Bem-vindo, ${name}!` : 'Bem-vindo ao IA News!'}</Heading>
        <Text style={text}>
          Falta um passo: confirme seu e-mail para começar a receber a edição diária com as
          notícias de inteligência artificial que realmente importam para quem decide.
        </Text>
        {confirmUrl ? (
          <Section style={{ margin: '28px 0' }}>
            <Button style={button} href={confirmUrl}>
              Confirmar minha assinatura
            </Button>
          </Section>
        ) : null}
        {confirmUrl ? (
          <Text style={small}>
            Se o botão não funcionar, copie este link:{' '}
            <Link href={confirmUrl} style={{ color: '#2563eb' }}>
              {confirmUrl}
            </Link>
          </Text>
        ) : null}
        <Hr style={hr} />
        <Text style={small}>
          Você recebe este e-mail porque se inscreveu no IA News
          {origin ? ` (${origin})` : ''}. Leia todas as matérias em{' '}
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
  subject: 'Confirme sua assinatura do IA News',
  displayName: 'Boas-vindas ao lead',
  previewData: {
    name: 'Ana',
    confirmUrl: 'https://ianews.site/confirmar?t=exemplo',
    origin: 'popup-assinatura',
  },
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
