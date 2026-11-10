import React from 'react'
import { Link, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { C, CtaButton, Shell, SITE, s } from './layout'

/* Confirmação da inscrição no Palco IA News Online (16/12, 19h, R$ 97). O link de pagamento segue pelo WhatsApp. */

interface Props {
  nome?: string
}

const first = (n?: string) => (n ?? '').trim().split(/\s+/)[0] || 'tudo bem'

const Email = (p: Props) => (
  <Shell preview="Sua inscrição no Palco IA News Online, dia 16/12, às 19h, foi recebida.">
    <Text style={s.kick}>Palco IA News Online · 16/12 · 19h às 20h30</Text>
    <Text style={s.h1}>Inscrição recebida</Text>
    <Text style={s.p}>Olá, {first(p.nome)}.</Text>
    <Text style={s.p}>
      Obrigada por se inscrever no Palco IA News Online: um workshop ao vivo de 1h30, no dia 16 de dezembro, às 19h,
      com o Raio-X do que deu certo com IA nas empresas brasileiras em 2026, três cases com números e o Playbook IA
      2027.
    </Text>
    <Text style={s.p}>
      O ingresso é R$ 97 e inclui a gravação por 30 dias. O link de pagamento chega pelo WhatsApp e por aqui, e o link
      de acesso vai na véspera e 2 horas antes do início. Esse valor ainda vira desconto no Palco presencial, em Belo
      Horizonte, em fevereiro de 2027.
    </Text>
    <CtaButton href={`${SITE}/palco`}>Ver a página do evento</CtaButton>
    <Text style={{ ...s.p, marginTop: '18px' }}>Renata, da IA News</Text>
    <Text style={s.small}>
      Dúvidas? Escreva para{' '}
      <Link href="mailto:ianewscomercial@gmail.com" style={{ color: C.blueInk }}>
        ianewscomercial@gmail.com
      </Link>
      .
    </Text>
  </Shell>
)

export const template = {
  component: Email,
  subject: 'Sua inscrição no Palco IA News Online (16/12, 19h)',
  displayName: 'Confirmação de inscrição no Palco IA News Online',
  previewData: { nome: 'Ana Souza' },
} satisfies TemplateEntry
