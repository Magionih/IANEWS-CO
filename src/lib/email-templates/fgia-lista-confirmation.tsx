import React from 'react'
import { Link, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { C, CtaButton, Shell, s } from './layout'

/* Confirmação para quem entrou na lista de espera da FGIA Educação (ianewsbr.com/eventos).
   Só a data do primeiro encontro: formato, local e convidados saem depois, primeiro para a lista. */

interface Props {
  nome?: string
}

const first = (n?: string) => (n ?? '').trim().split(/\s+/)[0] || 'tudo bem'

const Email = (p: Props) => (
  <Shell preview="Seu nome está na lista. Os detalhes do dia 17 de dezembro chegam primeiro para você.">
    <Text style={s.kick}>FGIA Educação · uma marca IA News</Text>
    <Text style={s.h1}>Você está na lista</Text>
    <Text style={s.p}>Olá, {first(p.nome)}.</Text>
    <Text style={s.p}>
      Seu nome entrou na lista de espera da FGIA Educação, o palco da IA News: eventos, palestras e mesas com
      empresários que já colocaram IA para trabalhar.
    </Text>
    <Text style={s.p}>
      Nosso primeiro encontro acontece em 17 de dezembro. Formato, local, convidados e condições chegam
      primeiro para quem está na lista, por e-mail e WhatsApp.
    </Text>
    <CtaButton href="https://www.instagram.com/fgiaeducacao/">Seguir @fgiaeducacao</CtaButton>
    <Text style={{ ...s.p, marginTop: '18px' }}>Equipe FGIA Educação</Text>
    <Text style={s.small}>
      Dúvidas? Responda este e-mail ou escreva para{' '}
      <Link href="mailto:ianewscomercial@gmail.com" style={{ color: C.blueInk }}>
        ianewscomercial@gmail.com
      </Link>
      .
    </Text>
  </Shell>
)

export const template = {
  component: Email,
  subject: 'Você está na lista da FGIA Educação',
  displayName: 'Confirmação da lista de espera FGIA',
  previewData: { nome: 'Ana Souza' },
} satisfies TemplateEntry
