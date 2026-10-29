import React from "react";
import { Link, Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { C, CtaButton, Shell, s } from "./layout";

/* Resumo diário do CRM (8h) para a equipe comercial: tarefas do dia, novos leads e negócios atrasados. */

type Item = { titulo: string; detalhe?: string | null; href?: string | null };

interface Props {
  crmUrl?: string;
  nome?: string;
  data?: string;
  tarefas?: Item[];
  tarefasTotal?: number;
  novos?: Item[];
  atrasados?: Item[];
  semResposta?: Item[];
  viraramPauta?: Item[];
  aquecidos?: Item[];
  semana?: {
    novosLeads: number;
    mensagensEnviadas: number;
    fechados: number;
    receita: string;
    tarefasFeitas: number;
  };
}

const Bloco = ({
  titulo,
  itens,
  vazio,
  total,
}: {
  titulo: string;
  itens?: Item[];
  vazio: string;
  total?: number;
}) => (
  <>
    <Text style={{ ...s.h2, marginTop: "18px" }}>
      {titulo}{" "}
      {itens?.length ? <span style={{ color: C.blueInk }}>({total ?? itens.length})</span> : null}
    </Text>
    {itens?.length ? (
      itens.map((i, n) => (
        <Text
          key={n}
          style={{
            ...s.small,
            color: C.ink2,
            margin: "0 0 6px",
            borderLeft: `3px solid ${C.blue}`,
            paddingLeft: "10px",
          }}
        >
          {i.href ? (
            <Link href={i.href} style={{ color: C.ink, fontWeight: 700, textDecoration: "none" }}>
              {i.titulo}
            </Link>
          ) : (
            <strong style={{ color: C.ink }}>{i.titulo}</strong>
          )}
          {i.detalhe ? <span> · {i.detalhe}</span> : null}
        </Text>
      ))
    ) : (
      <Text style={s.small}>{vazio}</Text>
    )}
  </>
);

const Email = (p: Props) => (
  <Shell
    preview={`Hoje no CRM: ${p.tarefasTotal ?? 0} tarefas, ${p.novos?.length ?? 0} novos leads`}
    topRight={p.data}
  >
    <Text style={s.kick}>CRM IANews · Hoje</Text>
    <Text style={s.h1}>Bom dia{p.nome ? `, ${p.nome}` : ""}!</Text>
    <Text style={s.p}>
      O que fazer hoje, direto do banco. Responda primeiro quem respondeu e os formulários.
    </Text>
    <Bloco
      titulo="Tarefas de hoje e atrasadas"
      itens={p.tarefas}
      total={p.tarefasTotal}
      vazio="Nenhuma tarefa para hoje."
    />
    <Bloco
      titulo="Novos leads (24h)"
      itens={p.novos}
      vazio="Nenhum lead novo nas últimas 24 horas."
    />
    <Bloco titulo="Negócios atrasados" itens={p.atrasados} vazio="Nenhum negócio atrasado." />
    <Bloco
      titulo="Sem resposta há mais de 3 dias"
      itens={p.semResposta}
      vazio="Ninguém esperando retorno."
    />
    <Bloco
      titulo="Leads aquecidos"
      itens={p.aquecidos}
      vazio="Nenhum lead aquecido nos últimos 7 dias."
    />
    <Bloco titulo='Fila "Viraram pauta"' itens={p.viraramPauta} vazio="Fila vazia." />
    {p.semana ? (
      <Text
        style={{
          ...s.small,
          backgroundColor: C.soft,
          padding: "12px 14px",
          borderRadius: "8px",
          marginTop: "18px",
        }}
      >
        <strong>Últimos 7 dias:</strong> {p.semana.novosLeads} novos leads ·{" "}
        {p.semana.mensagensEnviadas} mensagens enviadas · {p.semana.fechados} fechados ·{" "}
        {p.semana.receita} recebidos · {p.semana.tarefasFeitas} tarefas feitas
      </Text>
    ) : null}
    <CtaButton href={p.crmUrl || "#"}>Abrir o CRM</CtaButton>
  </Shell>
);

export const template = {
  component: Email,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mesmo formato dos outros modelos
  subject: (d: Record<string, any>) =>
    `[CRM] Hoje: ${d.tarefasTotal ?? 0} tarefas, ${d.novos?.length ?? 0} novos leads`,
  displayName: "CRM: resumo diário da equipe comercial",
  previewData: {
    nome: "Renata",
    data: "28 out",
    tarefasTotal: 1,
    tarefas: [{ titulo: "Responder pauta · Acme IA", detalhe: "hoje" }],
    novos: [{ titulo: "Pauta · Acme IA", detalhe: "Respondeu" }],
    semana: {
      novosLeads: 4,
      mensagensEnviadas: 12,
      fechados: 1,
      receita: "R$ 280,00",
      tarefasFeitas: 9,
    },
  },
} satisfies TemplateEntry;
