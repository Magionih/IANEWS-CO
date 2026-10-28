import React from 'react'
import { Link, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { C, CtaButton, Shell, SITE, s } from './layout'

/* Confirmação para quem enviou a pauta. Sem preço: o comercial conversa depois. */

interface Props {
  nome?: string
  empresa?: string
}

const first = (n?: string) => (n ?? '').trim().split(/\s+/)[0] || 'tudo bem'

const Email = (p: Props) => (
  <Shell preview="Recebemos sua pauta. A redação responde em até 2 dias úteis.">
    <Text style={s.kick}>Envie sua pauta</Text>
    <Text style={s.h1}>Recebemos sua pauta</Text>
    <Text style={s.p}>Olá, {first(p.nome)}.</Text>
    <Text style={s.p}>
      Obrigada por contar a história{p.empresa ? ` da ${p.empresa}` : ''} para a IA News. Nossa redação vai avaliar e
      responder em até 2 dias úteis, pelo WhatsApp ou por e-mail.
    </Text>
    <Text style={s.p}>Enquanto isso, veja o tipo de história que publicamos:</Text>
    <CtaButton href={`${SITE}/noticias`}>Ver as matérias</CtaButton>
    <Text style={{ ...s.p, marginTop: '18px' }}>
      Renata, da IA News
    </Text>
    <Text style={s.small}>
      Outro assunto? Escreva para{' '}
      <Link href="mailto:ianewscomercial@gmail.com" style={{ color: C.blueInk }}>
        ianewscomercial@gmail.com
      </Link>
      .
    </Text>
  </Shell>
)

export const template = {
  component: Email,
  subject: 'Recebemos sua pauta | IA News',
  displayName: 'Confirmação de pauta recebida',
  previewData: { nome: 'Ana Souza', empresa: 'Exemplo IA' },
} satisfies TemplateEntry
