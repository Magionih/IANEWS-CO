import React from 'react'
import { Link, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { C, CtaButton, Shell, SITE, s } from './layout'

/* Aviso interno: nova pauta enviada pela página /pauta. */

interface Props {
  nome?: string
  cargo?: string
  empresa?: string
  site?: string | null
  instagram?: string | null
  linkedin?: string | null
  whatsapp?: string
  email?: string
  descricao?: string
  link_noticia?: string | null
  origem_path?: string | null
  article_slug?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  device?: string | null
}

const Row = ({ label, value, href }: { label: string; value?: string | null; href?: string }) =>
  value ? (
    <Text style={{ ...s.small, color: C.ink2, margin: '0 0 4px' }}>
      <strong>{label}:</strong>{' '}
      {href ? (
        <Link href={href} style={{ color: C.blueInk }}>
          {value}
        </Link>
      ) : (
        value
      )}
    </Text>
  ) : null

const wa = (v?: string) => {
  const d = (v ?? '').replace(/\D/g, '')
  return d ? `https://wa.me/${d.startsWith('55') ? d : `55${d}`}` : undefined
}

const Email = (p: Props) => {
  const utm = [p.utm_source, p.utm_medium, p.utm_campaign].filter(Boolean).join(' / ')
  return (
    <Shell preview={`Nova pauta: ${p.empresa ?? ''} (${p.cargo ?? ''})`}>
      <Text style={s.kick}>Envie sua pauta · ianewsbr.com/pauta</Text>
      <Text style={s.h1}>Nova pauta: {p.empresa}</Text>
      <Row label="Nome" value={p.nome} />
      <Row label="Cargo" value={p.cargo} />
      <Row label="Empresa" value={p.empresa} />
      <Row label="WhatsApp" value={p.whatsapp} href={wa(p.whatsapp)} />
      <Row label="E-mail" value={p.email} href={p.email ? `mailto:${p.email}` : undefined} />
      <Row label="Site" value={p.site} href={p.site ?? undefined} />
      <Row label="Instagram" value={p.instagram} href={p.instagram ? `https://www.instagram.com/${p.instagram.replace(/^@/, '')}/` : undefined} />
      <Row label="LinkedIn" value={p.linkedin} href={p.linkedin ?? undefined} />
      <Row label="Notícia / release" value={p.link_noticia} href={p.link_noticia ?? undefined} />
      <Text style={{ ...s.p, whiteSpace: 'pre-wrap' as const, backgroundColor: C.soft, padding: '14px 16px', borderRadius: '8px', marginTop: '12px' }}>
        {p.descricao}
      </Text>
      <Text style={{ ...s.kick, marginTop: '8px' }}>Origem</Text>
      <Row label="Página" value={p.origem_path} />
      <Row label="Matéria" value={p.article_slug} href={p.article_slug ? `${SITE}/materia/${p.article_slug}` : undefined} />
      <Row label="UTM" value={utm || 'sem UTM (acesso direto)'} />
      <Row label="Dispositivo" value={p.device} />
      <CtaButton href={`${SITE}/admin?aba=pautas`}>Abrir a pauta no painel</CtaButton>
    </Shell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Nova pauta: ${d.empresa ?? 'empresa'} (${d.cargo ?? 'cargo'})`,
  displayName: 'Aviso de nova pauta para o comercial',
  previewData: {
    nome: 'Ana Souza',
    cargo: 'CEO',
    empresa: 'Exemplo IA',
    whatsapp: '(11) 99999-0000',
    email: 'ana@exemplo.com',
    descricao: 'Usamos IA para automatizar o atendimento de clínicas.',
    utm_source: 'instagram',
    utm_medium: 'bio',
  },
} satisfies TemplateEntry
