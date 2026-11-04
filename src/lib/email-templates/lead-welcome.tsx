import React from 'react'
import { Link, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { C, CtaButton, Shell, SITE, s } from './layout'

/* Boas-vindas sem confirmação: a inscrição já vale e a primeira edição chega no dia seguinte às 7h. */

interface Props {
  name?: string
  origin?: string
}

const Email = ({ name }: Props) => (
  <Shell
    preview="Sua inscrição está feita. A primeira edição chega amanhã às 7h."
    footer={
      <Text style={{ ...s.small, textAlign: 'center' as const }}>
        Você recebe este e-mail porque se inscreveu em ianewsbr.com. Se não foi você, use o link de
        descadastro em qualquer edição.
      </Text>
    }
  >
    <Text style={s.kick}>Bem-vindo à IANews</Text>
    <Text style={s.h1}>{name ? `${name}, sua inscrição está feita.` : 'Sua inscrição está feita.'}</Text>
    <Text style={s.p}>
      A partir de amanhã, todo dia às 7h, você recebe as notícias de inteligência artificial que saíram
      na IANews no dia anterior, explicadas para quem decide.
    </Text>
    <Text style={s.p}>
      Para não cair no spam, salve este endereço nos seus contatos.
    </Text>
    <CtaButton href={`${SITE}/noticias`}>Ver o que saiu hoje</CtaButton>
    <Text style={{ ...s.p, fontSize: '15px', marginTop: '18px' }}>
      E veja qual IA lidera o{' '}
      <Link href={`${SITE}/ranking`} style={{ color: C.blueInk }}>
        Ranking IA
      </Link>
      .
    </Text>
  </Shell>
)

export const template = {
  component: Email,
  subject: 'Bem-vindo à IANews: sua primeira edição chega amanhã às 7h',
  displayName: 'Boas-vindas ao lead',
  previewData: { name: 'Ana', origin: 'site' },
} satisfies TemplateEntry
