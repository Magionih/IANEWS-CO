import React from 'react'
import { Link, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { C, CtaButton, Shell, SITE, s } from './layout'

/* Confirmação para quem se inscreveu em /lista100, /aula, /conselho ou /projetos. Sempre com o canal das 7h. */

const CANAL = 'https://chat.whatsapp.com/Is5edILjICj0D2MMHUmGbL'

interface Props {
  tipo?: 'lista100' | 'indicacao' | 'aula' | 'conselho' | 'projeto'
  nome?: string
  agendado_em?: string | null
  indicados?: number
}

const first = (n?: string) => (n ?? '').trim().split(/\s+/)[0] || 'tudo bem'

const quando = (iso?: string | null) =>
  iso
    ? new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso))
    : null

// Aula nº 1 · 25/11, 19h às 20h (Brasília) → link para salvar na agenda do Google
const AGENDA_AULA =
  'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' +
  encodeURIComponent('Aula ao vivo IA News · Como empresas brasileiras estão colocando IA para vender') +
  '&dates=20261125T220000Z/20261125T230000Z&details=' +
  encodeURIComponent('O link chega pelo WhatsApp 1 hora antes. ' + SITE + '/aula')

const TEXTO: Record<string, { kick: string; h1: string; corpo: (p: Props) => string[]; cta?: { href: string; label: string } }> = {
  lista100: {
    kick: 'Lista IA News 100 · 2026',
    h1: 'Recebemos sua candidatura',
    corpo: (p) => [
      'Obrigada por se candidatar à Lista IA News 100: os 100 nomes que estão fazendo IA de verdade nos negócios no Brasil.',
      'O júri avalia as candidaturas de 08 a 12/12, e quem for escolhido recebe o aviso antes do anúncio, que acontece no Palco IA News, em 16/12. Não se paga nada para entrar, em nenhuma etapa.',
      ...(p.indicados ? [`Recebemos também ${p.indicados === 1 ? 'a sua indicação' : `as suas ${p.indicados} indicações`}. Vamos convidar cada pessoa e contar que foi você quem indicou.`] : []),
    ],
    cta: { href: `${SITE}/lista100/criterios`, label: 'Ver os critérios da Lista' },
  },
  indicacao: {
    kick: 'Lista IA News 100 · 2026',
    h1: 'Obrigada pela indicação',
    corpo: (p) => [
      `Recebemos ${p.indicados && p.indicados > 1 ? `as suas ${p.indicados} indicações` : 'a sua indicação'} para a Lista IA News 100. Vamos convidar cada pessoa a se candidatar e contar que foi você quem indicou.`,
      'Se você também tem um caso de IA com resultado, a candidatura fica aberta até 07/12.',
    ],
    cta: { href: `${SITE}/lista100`, label: 'Me candidatar também' },
  },
  aula: {
    kick: 'Aula ao vivo · IA News',
    h1: 'Sua vaga na Aula está garantida',
    corpo: () => [
      'A Aula ao vivo nº 1 é na quarta-feira, 25 de novembro, às 19h (horário de Brasília): "Como empresas brasileiras estão colocando IA para vender". São 60 minutos com casos reais e números.',
      'O link chega pelo WhatsApp 1 hora antes. Salve na sua agenda para não perder:',
    ],
    cta: { href: AGENDA_AULA, label: 'Salvar na agenda' },
  },
  conselho: {
    kick: 'Conselho IA News',
    h1: 'Recebemos sua candidatura',
    corpo: (p) => [
      'Obrigada por se candidatar ao Conselho IA News, o grupo de quem coloca IA para trabalhar de verdade no Brasil.',
      quando(p.agendado_em)
        ? `Nossa conversa de 15 minutos está marcada para ${quando(p.agendado_em)} (horário de Brasília). Vamos te chamar pelo WhatsApp que você informou.`
        : 'Vamos te chamar pelo WhatsApp em até 1 dia útil para marcar a conversa de 15 minutos.',
      'Na conversa, entendemos o seu momento e explicamos como funciona a turma de fundadores.',
    ],
    cta: { href: `${SITE}/conselho`, label: 'Ver a página do Conselho' },
  },
  projeto: {
    kick: 'Balcão de Projetos · IA News',
    h1: 'Recebemos seu pedido',
    corpo: () => [
      'Obrigada por contar o que você quer resolver com IA. Em até 1 dia útil, alguém da IA News te chama pelo WhatsApp para uma conversa de 20 minutos.',
      'Depois dela, escrevemos o escopo e apresentamos 2 ou 3 especialistas que já fizeram projetos parecidos. Para você, isso não tem custo.',
    ],
  },
}

const Email = (p: Props) => {
  const x = TEXTO[p.tipo ?? 'lista100'] ?? TEXTO.lista100
  return (
    <Shell preview={`${x.h1}, ${first(p.nome)}.`}>
      <Text style={s.kick}>{x.kick}</Text>
      <Text style={s.h1}>{x.h1}</Text>
      <Text style={s.p}>Olá, {first(p.nome)}.</Text>
      {x.corpo(p).map((t) => (
        <Text key={t.slice(0, 24)} style={s.p}>
          {t}
        </Text>
      ))}
      {x.cta ? <CtaButton href={x.cta.href}>{x.cta.label}</CtaButton> : null}
      <Text style={{ ...s.p, marginTop: '22px' }}>
        Enquanto isso, entre no canal da IA News no WhatsApp: todo dia, às 7h, as notícias de IA que importam para quem tem negócio.{' '}
        <Link href={CANAL} style={s.link}>
          Entrar no canal das 7h
        </Link>
      </Text>
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
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    ({
      lista100: 'Recebemos sua candidatura à Lista IA News 100',
      indicacao: 'Obrigada pela indicação à Lista IA News 100',
      aula: 'Sua vaga na Aula ao vivo da IA News (25/11, 19h)',
      conselho: 'Recebemos sua candidatura ao Conselho IA News',
      projeto: 'Recebemos seu pedido no Balcão de Projetos da IA News',
    })[d.tipo as string] ?? 'Recebemos seu envio',
  displayName: 'Confirmação das inscrições (Lista 100, Aula, Conselho, Projetos)',
  previewData: { tipo: 'conselho', nome: 'Ana Souza', agendado_em: '2026-11-12T13:30:00.000Z' },
} satisfies TemplateEntry
