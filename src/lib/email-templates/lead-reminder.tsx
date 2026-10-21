import React from 'react'
import { Link, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { C, CtaButton, Shell, s } from './layout'

interface Props {
  name?: string
  confirmUrl?: string
  headline?: string
}

const Email = ({ name, confirmUrl, headline }: Props) => (
  <Shell
    preview="Sua inscrição na IANews ainda não foi confirmada"
    footer={
      <Text style={{ ...s.small, textAlign: 'center' as const }}>
        Você recebe este lembrete uma única vez porque se inscreveu em ianewsbr.com.
      </Text>
    }
  >
    <Text style={s.kick}>Lembrete</Text>
    <Text style={s.h1}>{name ? `${name}, sua inscrição está quase pronta.` : 'Sua inscrição está quase pronta.'}</Text>
    <Text style={s.p}>
      Falta confirmar seu e-mail para garantir a newsletter diária da IANews, todo dia às 7h.
    </Text>
    {headline ? (
      <Text style={{ ...s.p, borderLeft: `3px solid ${C.blue}`, paddingLeft: '12px' }}>
        Na edição de hoje: “{headline}”.
      </Text>
    ) : null}
    {confirmUrl ? <CtaButton href={confirmUrl}>Confirmar meu e-mail</CtaButton> : null}
    {confirmUrl ? (
      <Text style={s.small}>
        Ou copie o link:{' '}
        <Link href={confirmUrl} style={{ color: C.blueInk, wordBreak: 'break-all' as const }}>
          {confirmUrl}
        </Link>
      </Text>
    ) : null}
  </Shell>
)

export const template = {
  component: Email,
  subject: 'Falta 1 clique para receber a IANews',
  displayName: 'Lembrete de confirmação',
  previewData: {
    name: 'Ana',
    confirmUrl: 'https://ianewsbr.com/confirmar?t=00000000-0000-0000-0000-000000000000',
    headline: 'Exemplo de manchete',
  },
} satisfies TemplateEntry
