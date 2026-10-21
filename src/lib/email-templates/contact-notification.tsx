import React from 'react'
import { Link, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { C, CtaButton, Shell, SITE, s } from './layout'

interface Props {
  kind?: string
  full_name?: string
  email?: string
  phone?: string | null
  company?: string | null
  budget?: string | null
  subject?: string | null
  message?: string
}

const KIND: Record<string, string> = { anuncie: 'Anuncie', contato: 'Contato', empresas: 'Para empresas' }

const Row = ({ label, value }: { label: string; value?: string | null }) =>
  value ? (
    <Text style={{ ...s.small, color: C.ink2, margin: '0 0 4px' }}>
      <strong>{label}:</strong> {value}
    </Text>
  ) : null

const Email = (p: Props) => (
  <Shell preview={`Nova mensagem de ${p.full_name ?? 'contato'} pelo site`}>
    <Text style={s.kick}>Formulário · {KIND[p.kind ?? ''] ?? p.kind ?? 'Contato'}</Text>
    <Text style={s.h1}>Nova mensagem pelo site</Text>
    <Row label="Nome" value={p.full_name} />
    <Row label="E-mail" value={p.email} />
    <Row label="Telefone" value={p.phone} />
    <Row label="Empresa" value={p.company} />
    <Row label="Orçamento" value={p.budget} />
    <Row label="Assunto" value={p.subject} />
    <Text style={{ ...s.p, whiteSpace: 'pre-wrap' as const, backgroundColor: C.soft, padding: '14px 16px', borderRadius: '8px', marginTop: '12px' }}>
      {p.message}
    </Text>
    {p.email ? (
      <Text style={s.small}>
        Responder:{' '}
        <Link href={`mailto:${p.email}`} style={{ color: C.blueInk }}>
          {p.email}
        </Link>
      </Text>
    ) : null}
    <CtaButton href={`${SITE}/admin`}>Abrir o painel</CtaButton>
  </Shell>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `[IANews] ${KIND[d.kind] ?? 'Contato'}: ${d.full_name ?? 'nova mensagem'}`,
  displayName: 'Aviso de formulário para o administrador',
  to: 'magionih@gmail.com',
  previewData: { kind: 'empresas', full_name: 'Ana Souza', email: 'ana@exemplo.com', message: 'Olá!' },
} satisfies TemplateEntry
