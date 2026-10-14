import React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export type RankingEmailTool = {
  slug: string;
  name: string;
  maker: string;
  category: string;
  weekly_score: number;
  previous_score: number;
  rank_position: number;
  previous_position: number;
  ratings_avg: number;
  about: string;
  website: string;
};

export type WeeklyRankingProps = {
  editionLabel: string;
  siteUrl: string;
  recipientName?: string | null;
  tools: RankingEmailTool[];
};

const NAV = "#0b1220";
const ACCENT = "#2563eb";

const main: React.CSSProperties = {
  backgroundColor: "#ffffff",
  fontFamily: "Arial, Helvetica, sans-serif",
  color: "#111827",
};
const container: React.CSSProperties = { padding: "24px 20px", maxWidth: "620px" };
const eyebrow: React.CSSProperties = {
  margin: 0,
  fontSize: "11px",
  letterSpacing: "1.5px",
  textTransform: "uppercase",
  fontWeight: 700,
  color: ACCENT,
};
const h1: React.CSSProperties = {
  margin: "8px 0 4px",
  fontSize: "24px",
  lineHeight: "1.2",
  fontWeight: 800,
  color: NAV,
};
const sub: React.CSSProperties = { margin: 0, fontSize: "13px", color: "#4b5563" };
const row: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  padding: "14px 16px",
  marginBottom: "10px",
  backgroundColor: "#ffffff",
};
const rankBadge: React.CSSProperties = {
  margin: 0,
  fontSize: "12px",
  fontWeight: 800,
  color: ACCENT,
  letterSpacing: "0.5px",
};
const toolName: React.CSSProperties = {
  margin: "2px 0 0",
  fontSize: "17px",
  fontWeight: 800,
  color: NAV,
};
const meta: React.CSSProperties = { margin: "2px 0 0", fontSize: "12px", color: "#6b7280" };
const about: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: "13px",
  lineHeight: "1.55",
  color: "#374151",
};
const cta: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: ACCENT,
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: 700,
  padding: "12px 20px",
  textDecoration: "none",
};
const footer: React.CSSProperties = { fontSize: "11px", color: "#9ca3af", lineHeight: "1.6" };

function delta(tool: RankingEmailTool) {
  const move = (tool.previous_position || 0) - (tool.rank_position || 0);
  if (!tool.previous_position || move === 0) return "estável na semana";
  return move > 0 ? `subiu ${move} posição(ões)` : `caiu ${Math.abs(move)} posição(ões)`;
}

export function WeeklyRankingEmail({
  editionLabel,
  siteUrl,
  recipientName,
  tools,
}: WeeklyRankingProps) {
  const list = tools ?? [];
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`Ranking IA da semana: ${list[0]?.name ?? "as melhores ferramentas de IA"}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={eyebrow}>IA News · Ranking IA semanal</Text>
          <Heading style={h1}>As melhores ferramentas de IA da semana</Heading>
          <Text style={sub}>
            {recipientName ? `${recipientName}, ` : ""}
            edição de {editionLabel} — nota técnica, repercussão e avaliação dos leitores.
          </Text>

          <Section style={{ marginTop: "20px" }}>
            {list.map((tool, i) => (
              <Section key={tool.slug} style={row}>
                <Text style={rankBadge}>{`#${tool.rank_position || i + 1} · nota ${tool.weekly_score.toFixed(1)}`}</Text>
                <Text style={toolName}>{tool.name}</Text>
                <Text style={meta}>
                  {tool.maker} · {tool.category} · {delta(tool)}
                  {tool.ratings_avg ? ` · leitores ${tool.ratings_avg.toFixed(1)}/5` : ""}
                </Text>
                {tool.about ? <Text style={about}>{tool.about.slice(0, 220)}</Text> : null}
                <Text style={{ margin: "10px 0 0", fontSize: "12px" }}>
                  <Link href={`${siteUrl}/ranking?q=${encodeURIComponent(tool.name)}`} style={{ color: ACCENT }}>
                    Ver avaliação completa
                  </Link>
                </Text>
              </Section>
            ))}
          </Section>

          <Section style={{ marginTop: "16px", textAlign: "center" as const }}>
            <Link href={`${siteUrl}/ranking`} style={cta}>
              Abrir o Ranking IA completo
            </Link>
          </Section>

          <Hr style={{ borderColor: "#e5e7eb", margin: "24px 0 12px" }} />
          <Text style={footer}>
            IA News — jornalismo de tecnologia com curadoria editorial. Você recebe este ranking
            porque pediu o comparativo semanal das ferramentas de IA em {siteUrl}.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WeeklyRankingEmail;
