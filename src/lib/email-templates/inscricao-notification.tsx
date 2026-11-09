import React from 'react'
import { Link, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'
import { C, CtaButton, Shell, s } from './layout'

/* Aviso interno de cada envio em /lista100, /aula, /conselho e /projetos. O CRM já recebeu a pessoa. */

interface Props {
  tipo?: string
  nome?: string
  empresa?: string | null
  cargo?: string | null
  whatsapp?: string
  email?: string
  perfil?: string | null
  dados?: Record<string, string>
  indicados?: { nome: string; empresa?: string; contato: string }[]
  agendado_em?: string | null
  origem_path?: string | null
  utm_source?: string | null
  utm_medium?: string | null
  utm_campaign?: string | null
  device?: string | null
}

const NOME: Record<string, { titulo: string; funil: string }> = {
  lista100: { titulo: 'Candidatura à Lista 100', funil: 'Lista IA News 100, etapa Candidato' },
  indicacao: { titulo: 'Indicação para a Lista 100', funil: 'Lista IA News 100, etapa Indicado (cada indicado)' },
  aula: { titulo: 'Inscrição na Aula ao vivo', funil: 'Aula ao vivo, etapa Inscrito' },
  conselho: { titulo: 'Candidatura ao Conselho', funil: 'Conselho IA News' },
  projeto: { titulo: 'Pedido no Balcão de Projetos', funil: 'Implementação, etapa Lead' },
}

const ROTULO: Record<string, string> = {
  categoria: 'Categoria',
  caso: 'Caso',
  resultado: 'Resultado',
  setor: 'Setor',
  porte: 'Porte',
  problema: 'O que quer resolver',
  prazo: 'Prazo',
  investimento: 'Investimento',
  materia: 'Veio da matéria',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
}

const wa = (v?: string) => {
  const d = (v ?? '').replace(/\D/g, '')
  return d ? `https://wa.me/${d.startsWith('55') ? d : `55${d}`}` : undefined
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

const Email = (p: Props) => {
  const n = NOME[p.tipo ?? ''] ?? { titulo: 'Novo envio', funil: 'CRM' }
  const utm = [p.utm_source, p.utm_medium, p.utm_campaign].filter(Boolean).join(' / ')
  const quando = p.agendado_em
    ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' }).format(new Date(p.agendado_em))
    : null
  return (
    <Shell preview={`${n.titulo}: ${p.nome ?? ''}${p.empresa ? ` (${p.empresa})` : ''}`}>
      <Text style={s.kick}>{n.titulo}</Text>
      <Text style={s.h1}>{p.nome}</Text>
      {quando ? <Row label="Conversa de 15 min" value={quando} /> : null}
      <Row label="Empresa" value={p.empresa} />
      <Row label="Cargo" value={p.cargo} />
      <Row label="Perfil" value={p.perfil} />
      <Row label="WhatsApp" value={p.whatsapp} href={wa(p.whatsapp)} />
      <Row label="E-mail" value={p.email} href={p.email ? `mailto:${p.email}` : undefined} />
      {Object.entries(p.dados ?? {}).map(([k, v]) => (
        <Row key={k} label={ROTULO[k] ?? k} value={v} />
      ))}
      {p.indicados?.length ? (
        <>
          <Text style={{ ...s.kick, marginTop: '10px' }}>Indicou</Text>
          {p.indicados.map((i) => (
            <Row key={i.nome + i.contato} label={i.nome} value={[i.empresa, i.contato].filter(Boolean).join(' · ')} />
          ))}
        </>
      ) : null}
      <Text style={{ ...s.kick, marginTop: '10px' }}>Origem</Text>
      <Row label="Página" value={p.origem_path} />
      <Row label="UTM" value={utm || 'sem UTM (acesso direto)'} />
      <Row label="Dispositivo" value={p.device} />
      <Text style={{ ...s.small, marginTop: '10px' }}>A pessoa já está no CRM, no funil {n.funil}.</Text>
      <CtaButton href="https://ianews-crm.vercel.app/lista">Abrir o CRM</CtaButton>
    </Shell>
  )
}

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `${NOME[d.tipo as string]?.titulo ?? 'Novo envio'}: ${d.nome ?? ''}${d.empresa ? ` (${d.empresa})` : ''}`,
  displayName: 'Aviso interno das inscrições (Lista 100, Aula, Conselho, Projetos)',
  previewData: {
    tipo: 'lista100',
    nome: 'Ana Souza',
    empresa: 'Clínica Exemplo',
    whatsapp: '(31) 99999-0000',
    email: 'ana@exemplo.com',
    dados: { categoria: 'aplica', caso: 'Agente no WhatsApp agenda consultas.', resultado: '40% menos faltas' },
    indicados: [{ nome: 'João', contato: '@joao' }],
  },
} satisfies TemplateEntry
