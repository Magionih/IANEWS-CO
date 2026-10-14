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

export type NewsletterArticle = {
  slug: string;
  title: string;
  dek: string | null;
  category: string;
  why_it_matters: string | null;
  read_minutes: number | null;
};

export type NewsletterProps = {
  editionLabel: string;
  siteUrl: string;
  articles: NewsletterArticle[];
  recipientName?: string | null;
};

const BLUE = "#1d6cf5";
const INK = "#0d1117";

const main = { backgroundColor: "#ffffff", fontFamily: "Roboto, Arial, sans-serif" };
const container = { maxWidth: "600px", margin: "0 auto", padding: "24px" };
const brand = {
  fontSize: "22px",
  fontWeight: 800 as const,
  color: INK,
  margin: "0",
  letterSpacing: "-0.5px",
};
const eyebrow = {
  fontSize: "11px",
  letterSpacing: "1.5px",
  textTransform: "uppercase" as const,
  color: BLUE,
  fontWeight: 700 as const,
  margin: "4px 0 0",
};
const h1 = { fontSize: "24px", lineHeight: "1.25", color: INK, margin: "24px 0 8px" };
const lede = { fontSize: "15px", color: "#4b5563", margin: "0 0 8px", lineHeight: "1.6" };
const itemTitle = {
  fontSize: "18px",
  fontWeight: 700 as const,
  color: INK,
  margin: "0 0 6px",
  lineHeight: "1.3",
};
const itemText = { fontSize: "14px", color: "#374151", margin: "0 0 8px", lineHeight: "1.6" };
const matters = {
  fontSize: "13px",
  color: "#1f2937",
  margin: "0 0 10px",
  lineHeight: "1.6",
  borderLeft: `3px solid ${BLUE}`,
  paddingLeft: "12px",
};
const linkStyle = { color: BLUE, fontSize: "14px", fontWeight: 700 as const };
const footer = { fontSize: "12px", color: "#6b7280", lineHeight: "1.6" };

export function DailyNewsletter({
  editionLabel,
  siteUrl,
  articles,
  recipientName,
}: NewsletterProps) {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head />
      <Preview>{`IA News · ${editionLabel} — ${articles[0]?.title ?? "as notícias que movem a IA hoje"}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>ia news</Text>
          <Text style={eyebrow}>Edição diária · {editionLabel}</Text>

          <Heading style={h1}>
            {recipientName ? `${recipientName}, ` : ""}as 5 notícias que movem a IA hoje
          </Heading>
          <Text style={lede}>
            Cinco minutos de leitura com o que realmente importa para quem decide.
          </Text>

          <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0" }} />

          {articles.map((a, index) => (
            <Section key={a.slug} style={{ marginBottom: "24px" }}>
              <Text style={eyebrow}>
                {String(index + 1).padStart(2, "0")} · {a.category}
              </Text>
              <Text style={itemTitle}>{a.title}</Text>
              {a.dek ? <Text style={itemText}>{a.dek}</Text> : null}
              {a.why_it_matters ? (
                <Text style={matters}>
                  <strong>Por que importa:</strong> {a.why_it_matters}
                </Text>
              ) : null}
              <Link style={linkStyle} href={`${siteUrl}/materia/${a.slug}`}>
                Ler a matéria completa →
              </Link>
            </Section>
          ))}

          <Hr style={{ borderColor: "#e5e7eb", margin: "20px 0" }} />

          <Text style={footer}>
            Você recebe esta edição porque assinou o IA News.{" "}
            <Link style={{ color: BLUE }} href={siteUrl}>
              Acessar o site
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default DailyNewsletter;