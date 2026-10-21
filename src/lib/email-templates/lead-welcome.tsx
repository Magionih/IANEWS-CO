import React from 'react'
import { Link, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { C, CtaButton, Shell, SITE, s } from './layout'

interface Props {
  name?: string
  confirmUrl?: string
  origin?: string
}

const Email = ({ name, confirmUrl }: Props) => (
  <Shell
    preview="Confirme seu e-mail e receba a IANews todo dia às 7h"
    footer={
      <Text style={{ ...s.small, textAlign: 'center' as const }}>
        Você recebe este e-mail porque se inscreveu em ianewsbr.com. Se não foi você, é só ignorar.
      </Text>
    }
  >
    <Text style={s.kick}>Bem-vindo à IANews</Text>
    <Text style={s.h1}>{name ? `${name}, falta um clique.` : 'Falta um clique.'}</Text>
    <Text style={s.p}>
      Confirme seu e-mail para receber, todo dia às 7h da manhã, as notícias de inteligência artificial
      que saíram na IANews no dia anterior, explicadas para quem decide.
    </Text>
    {confirmUrl ? <CtaButton href={confirmUrl}>Confirmar meu e-mail</CtaButton> : null}
    {confirmUrl ? (
      <Text style={s.small}>
        Se o botão não abrir, copie este link no navegador:{' '}
        <Link href={confirmUrl} style={{ color: C.blueInk, wordBreak: 'break-all' as const }}>
          {confirmUrl}
        </Link>
      </Text>
    ) : null}
    <Text style={{ ...s.p, fontSize: '15px', marginTop: '18px' }}>
      Enquanto isso, veja o que saiu hoje em{' '}
      <Link href={`${SITE}/noticias`} style={{ color: C.blueInk }}>
        ianewsbr.com
      </Link>{' '}
      e qual IA lidera o{' '}
      <Link href={`${SITE}/ranking`} style={{ color: C.blueInk }}>
        Ranking IA
      </Link>
      .
    </Text>
  </Shell>
)

export const template = {
  component: Email,
  subject: 'Confirme seu e-mail para receber a IANews',
  displayName: 'Boas-vindas ao lead',
  previewData: {
    name: 'Ana',
    confirmUrl: 'https://ianewsbr.com/confirmar?t=00000000-0000-0000-0000-000000000000',
    origin: 'site',
  },
} satisfies TemplateEntry
