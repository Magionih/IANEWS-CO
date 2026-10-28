import React from "react";
import { Text } from "@react-email/components";
import type { TemplateEntry } from "./registry";
import { C, CtaButton, Shell, SITE, s } from "./layout";

/* Resumo semanal do CRM (segunda) para o admin: leads por origem, avanços por etapa, fechamentos e receita. */

type Linha = { rotulo: string; valor: string };

interface Props {
  periodo?: string;
  numeros?: Linha[];
  origens?: Linha[];
  etapas?: Linha[];
  perdas?: Linha[];
  pendencias?: Linha[];
}

const Tabela = ({ titulo, linhas, vazio }: { titulo: string; linhas?: Linha[]; vazio: string }) => (
  <>
    <Text style={{ ...s.h2, marginTop: "18px" }}>{titulo}</Text>
    {linhas?.length ? (
      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        role="presentation"
        style={{ borderCollapse: "collapse" }}
      >
        <tbody>
          {linhas.map((l, i) => (
            <tr key={i}>
              <td
                style={{
                  ...s.small,
                  color: C.ink2,
                  padding: "6px 0",
                  borderBottom: `1px solid ${C.rule}`,
                }}
              >
                {l.rotulo}
              </td>
              <td
                align="right"
                style={{
                  ...s.small,
                  color: C.ink,
                  fontWeight: 700,
                  padding: "6px 0",
                  borderBottom: `1px solid ${C.rule}`,
                }}
              >
                {l.valor}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ) : (
      <Text style={s.small}>{vazio}</Text>
    )}
  </>
);

const Email = (p: Props) => (
  <Shell preview={`Resumo semanal do CRM · ${p.periodo ?? ""}`} topRight={p.periodo}>
    <Text style={s.kick}>CRM IANews · Resumo semanal</Text>
    <Text style={s.h1}>Como foi a semana</Text>
    <Text style={s.p}>
      Números calculados do banco. Revise os negócios em Proposta, os motivos de perda e os grupos
      pendentes.
    </Text>
    <Tabela titulo="Números da semana" linhas={p.numeros} vazio="Sem movimento." />
    <Tabela titulo="Novos leads por origem" linhas={p.origens} vazio="Nenhum lead novo." />
    <Tabela titulo="Avanços por etapa" linhas={p.etapas} vazio="Nenhuma mudança de etapa." />
    <Tabela titulo="Motivos de perda" linhas={p.perdas} vazio="Nenhuma perda registrada." />
    <Tabela titulo="Para decidir" linhas={p.pendencias} vazio="Nada pendente." />
    <CtaButton href={`${SITE}/admin/crm/relatorios`}>Abrir os relatórios</CtaButton>
  </Shell>
);

export const template = {
  component: Email,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mesmo formato dos outros modelos
  subject: (d: Record<string, any>) => `[CRM] Resumo semanal · ${d.periodo ?? ""}`,
  displayName: "CRM: resumo semanal para o admin",
  previewData: {
    periodo: "21 a 27 out",
    numeros: [
      { rotulo: "Novos leads", valor: "12" },
      { rotulo: "Receita", valor: "R$ 660,00" },
    ],
  },
} satisfies TemplateEntry;
