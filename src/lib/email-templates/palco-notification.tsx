import React from 'react'
import { Link, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { C, CtaButton, Shell, s } from './layout'

/* Aviso interno: nova inscrição no Palco IA News Online (/palco). O CRM já recebeu a pessoa. */

interface Props {
  nome?: string
  empresa?: string
  cargo?: string | null
  whatsapp?: string
  email?: string
  papel?: string
  setor?: string | null
  funcionarios?: string | null
  desafio?: string | null
  origem_path?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  device?: string | null
}

const PAPEL: Record<string, string> = {
  empresario: 'Empresário (perfil C)',
  fornecedor: 'Fornecedor de IA (perfil A)',
  criador: 'Criador ou educador (perfil B)',
  marca: 'Empresa ou marca (perfil D, também em Publicidade)',
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
    <Shell preview={`Palco IA News: ${p.nome ?? ''} (${p.empresa ?? ''}) entrou na lista`}>
      <Text style={s.kick}>Palco IA News · ianewsbr.com/palco</Text>
      <Text style={s.h1}>Nova inscrição: {p.nome}</Text>
      <Row label="Papel" value={p.papel ? (PAPEL[p.papel] ?? p.papel) : null} />
      <Row label="Empresa" value={p.empresa} />
      <Row label="Cargo" value={p.cargo} />
      <Row label="Setor" value={p.setor} />
      <Row label="Funcionários" value={p.funcionarios} />
      <Row label="WhatsApp" value={p.whatsapp} href={wa(p.whatsapp)} />
      <Row label="E-mail" value={p.email} href={p.email ? `mailto:${p.email}` : undefined} />
      {p.desafio ? (
        <Text
          style={{ ...s.p, whiteSpace: 'pre-wrap' as const, backgroundColor: C.soft, padding: '14px 16px', borderRadius: '8px', marginTop: '12px' }}
        >
          {p.desafio}
        </Text>
      ) : null}
      <Text style={{ ...s.kick, marginTop: '8px' }}>Origem</Text>
      <Row label="Página" value={p.origem_path} />
      <Row label="UTM" value={utm || 'sem UTM (acesso direto)'} />
      <Row label="Dispositivo" value={p.device} />
      <Text style={{ ...s.small, marginTop: '10px' }}>
        A pessoa já está no CRM, no funil "Palco IA News Online · 16/12", na etapa Na lista. Próximo passo: enviar o link de pagamento (R$ 97).
      </Text>
      <CtaButton href="https://ianews-crm.vercel.app/lista">Abrir a lista do dia</CtaButton>
    </Shell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Palco IA News: ${d.nome ?? 'nova inscrição'} (${d.empresa ?? 'empresa'})`,
  displayName: 'Aviso de nova inscrição no Palco IA News',
  previewData: {
    nome: 'Ana Souza',
    empresa: 'Clínica Exemplo',
    cargo: 'Sócia',
    whatsapp: '(31) 99999-0000',
    email: 'ana@exemplo.com',
    papel: 'empresario',
    setor: 'Saúde',
    funcionarios: '11 a 50',
    desafio: 'Responder pacientes no WhatsApp fora do horário.',
    utm_source: 'instagram',
    utm_medium: 'bio',
  },
} satisfies TemplateEntry
