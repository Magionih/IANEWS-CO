import React from 'react'
import { Link, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { C, CtaButton, Shell, SITE, s } from './layout'

/* Confirmação para quem entrou na lista antecipada do Palco IA News. Sem preço: o 1º lote chega depois. */

interface Props {
  nome?: string
}

const first = (n?: string) => (n ?? '').trim().split(/\s+/)[0] || 'tudo bem'

const Email = (p: Props) => (
  <Shell preview="Seu nome está na lista do Palco IA News, dia 16/12, em Belo Horizonte.">
    <Text style={s.kick}>Palco IA News · 16/12 · Belo Horizonte</Text>
    <Text style={s.h1}>Seu nome está na lista</Text>
    <Text style={s.p}>Olá, {first(p.nome)}.</Text>
    <Text style={s.p}>
      Obrigada por entrar na lista antecipada do Palco IA News: uma tarde, no dia 16 de dezembro, em Belo Horizonte,
      em que só sobe ao palco quem já colocou IA para trabalhar numa empresa.
    </Text>
    <Text style={s.p}>
      Quando o 1º lote abrir, você recebe o aviso antes de todo mundo, pelo WhatsApp e por aqui. O local e a programação
      completa saem junto.
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
  subject: 'Seu nome está na lista do Palco IA News',
  displayName: 'Confirmação da lista antecipada do Palco IA News',
  previewData: { nome: 'Ana Souza' },
} satisfies TemplateEntry
