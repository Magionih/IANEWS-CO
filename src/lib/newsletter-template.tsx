import React from "react";
import { Body, Container, Head, Html, Img, Link, Preview, Section, Text } from "@react-email/components";

import { CATEGORY_SEO } from "@/lib/categories";

/* Newsletter diária IANews — edição editorial (v2).
   Estrutura: cabeçalho de jornal → "Em 30 segundos" → matéria principal → mais de ontem
   → Ranking IA do dia → participe → rodapé. Tudo em tabelas/estilos inline (compatível com Gmail/Outlook). */

export type NewsletterArticle = {
  slug: string;
  title: string;
  dek: string | null;
  category: string;
  why_it_matters: string | null;
  read_minutes: number | null;
  cover_image_url?: string | null;
};

export type NewsletterRankItem = {
  name: string;
  maker: string | null;
  position: number;
  previous: number | null;
  score: number | null;
};

export type NewsletterProps = {
  editionLabel: string;
  siteUrl: string;
  articles: NewsletterArticle[];
  recipientName?: string | null;
  unsubscribeUrl?: string | null;
  ranking?: NewsletterRankItem[];
};

const C = {
  ink: "#0D1117",
  ink2: "#3B4350",
  ink3: "#687180",
  rule: "#E1E5EA",
  soft: "#F4F6F9",
  paper: "#FFFFFF",
  blue: "#0066FF",
  blueInk: "#0050C8",
  blueSoft: "#EEF4FF",
  up: "#0E8A4F",
  down: "#C2410C",
};
const SANS = "Roboto, 'Helvetica Neue', Helvetica, Arial, sans-serif";
const SERIF = "Georgia, 'Times New Roman', Times, serif";

const catLabel = (c: string) => CATEGORY_SEO[c]?.label ?? c;
const utm = (siteUrl: string, path: string, content: string) =>
  `${siteUrl}${path}${path.includes("?") ? "&" : "?"}utm_source=newsletter&utm_medium=email&utm_campaign=diaria&utm_content=${content}`;

const kick = { fontFamily: SANS, fontSize: "11px", fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase" as const, color: C.blueInk, margin: "0 0 8px" };
const sectionLabel = { ...kick, color: C.ink3, margin: "0 0 14px" };

function Rule({ m = "28px 0" }: { m?: string }) {
  return <div style={{ borderTop: `1px solid ${C.rule}`, margin: m, lineHeight: 0, fontSize: 0 }}>&nbsp;</div>;
}

function Move({ pos, prev }: { pos: number; prev: number | null }) {
  if (prev == null || prev === pos) return <span style={{ color: C.ink3 }}>=</span>;
  return prev > pos ? <span style={{ color: C.up }}>▲ {prev - pos}</span> : <span style={{ color: C.down }}>▼ {pos - prev}</span>;
}

export function DailyNewsletter({ editionLabel, siteUrl, articles, recipientName, unsubscribeUrl, ranking = [] }: NewsletterProps) {
  const [lead, ...rest] = articles;
  const minutes = Math.max(3, articles.reduce((s, a) => s + (a.read_minutes ?? 2), 0));
  const preview = lead
    ? `${lead.title}${articles.length > 1 ? ` · e mais ${articles.length - 1} de ontem` : ""}`
    : "As notícias de IA de ontem";

  return (
    <Html lang="pt-BR" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: C.soft, margin: 0, padding: "24px 0", fontFamily: SANS }}>
        <Container style={{ maxWidth: "640px", width: "100%", margin: "0 auto", backgroundColor: C.paper, borderRadius: "14px", overflow: "hidden", border: `1px solid ${C.rule}` }}>
          {/* Cabeçalho de jornal */}
          <Section style={{ padding: "26px 32px 0", textAlign: "center" as const }}>
            <Text style={{ fontFamily: SANS, fontSize: "11px", letterSpacing: "1.4px", textTransform: "uppercase" as const, color: C.ink3, margin: "0 0 16px" }}>
              {editionLabel} · {minutes} min de leitura ·{" "}
              <Link href={utm(siteUrl, "/edicao", "navegador")} style={{ color: C.ink3, textDecoration: "underline" }}>
                Ver no navegador
              </Link>
            </Text>
            <Link href={utm(siteUrl, "/", "logo")}>
              <Img src={`${siteUrl}/email/ianews-logo.png`} width="168" height="34" alt="IANews" style={{ margin: "0 auto", display: "block" }} />
            </Link>
            <Text style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "15px", color: C.ink2, margin: "12px 0 0" }}>
              A corrida da IA, explicada para quem decide.
            </Text>
            <div style={{ borderTop: `3px solid ${C.ink}`, borderBottom: `1px solid ${C.ink}`, height: "3px", margin: "20px 0 0", lineHeight: 0, fontSize: 0 }}>&nbsp;</div>
          </Section>

          <Section style={{ padding: "26px 32px 4px" }}>
            {/* Abertura */}
            <Text style={{ fontFamily: SERIF, fontSize: "19px", lineHeight: "1.5", color: C.ink, margin: "0 0 18px" }}>
              {recipientName ? `Bom dia, ${recipientName}.` : "Bom dia."}{" "}
              {articles.length === 1
                ? "Esta é a notícia de inteligência artificial que saiu ontem na IANews."
                : `Estas são as ${articles.length} notícias de inteligência artificial que saíram ontem na IANews.`}
            </Text>

            {/* Em 30 segundos */}
            {articles.length > 1 ? (
              <Section style={{ backgroundColor: C.soft, borderRadius: "10px", padding: "18px 20px", margin: "0 0 28px" }}>
                <Text style={{ ...kick, color: C.ink, margin: "0 0 10px" }}>Em 30 segundos</Text>
                {articles.map((a, i) => (
                  <table key={a.slug} width="100%" cellPadding={0} cellSpacing={0} role="presentation" style={{ marginBottom: i < articles.length - 1 ? "8px" : 0 }}>
                    <tbody>
                      <tr>
                        <td valign="top" width="22" style={{ fontFamily: SANS, fontSize: "14px", fontWeight: 700, color: C.blue, paddingTop: "1px" }}>
                          {i + 1}
                        </td>
                        <td valign="top">
                          <Link href={utm(siteUrl, `/materia/${a.slug}`, `resumo-${i + 1}`)} style={{ fontFamily: SANS, fontSize: "14.5px", lineHeight: "1.45", color: C.ink, textDecoration: "none" }}>
                            {a.title}
                          </Link>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ))}
              </Section>
            ) : null}

            {/* Matéria principal */}
            {lead ? (
              <Section>
                <Text style={sectionLabel}>Destaque</Text>
                {lead.cover_image_url ? (
                  <Link href={utm(siteUrl, `/materia/${lead.slug}`, "destaque-img")}>
                    <Img
                      src={lead.cover_image_url}
                      width="576"
                      alt=""
                      style={{ width: "100%", maxWidth: "576px", height: "auto", borderRadius: "10px", display: "block", margin: "0 0 18px" }}
                    />
                  </Link>
                ) : null}
                <Text style={kick}>{catLabel(lead.category)}</Text>
                <Link href={utm(siteUrl, `/materia/${lead.slug}`, "destaque-titulo")} style={{ textDecoration: "none" }}>
                  <Text style={{ fontFamily: SERIF, fontSize: "28px", lineHeight: "1.22", fontWeight: 700, color: C.ink, margin: "0 0 12px" }}>{lead.title}</Text>
                </Link>
                {lead.dek ? (
                  <Text style={{ fontFamily: SANS, fontSize: "16px", lineHeight: "1.6", color: C.ink2, margin: "0 0 16px" }}>{lead.dek}</Text>
                ) : null}
                {lead.why_it_matters ? (
                  <Section style={{ borderLeft: `3px solid ${C.blue}`, padding: "2px 0 2px 16px", margin: "0 0 20px" }}>
                    <Text style={{ ...kick, margin: "0 0 4px" }}>Por que importa</Text>
                    <Text style={{ fontFamily: SERIF, fontSize: "16px", lineHeight: "1.55", color: C.ink, margin: 0 }}>{lead.why_it_matters}</Text>
                  </Section>
                ) : null}
                <Link
                  href={utm(siteUrl, `/materia/${lead.slug}`, "destaque-botao")}
                  style={{ display: "inline-block", backgroundColor: C.ink, color: "#fff", fontFamily: SANS, fontSize: "14px", fontWeight: 700, textDecoration: "none", padding: "12px 20px", borderRadius: "8px" }}
                >
                  Ler a matéria completa →
                </Link>
              </Section>
            ) : null}

            {/* Mais de ontem */}
            {rest.length ? (
              <>
                <Rule m="32px 0 24px" />
                <Text style={sectionLabel}>Mais de ontem</Text>
                {rest.map((a, i) => (
                  <Section key={a.slug} style={{ paddingBottom: "18px", marginBottom: "18px", borderBottom: i < rest.length - 1 ? `1px solid ${C.rule}` : "none" }}>
                    <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
                      <tbody>
                        <tr>
                          <td valign="top">
                            <Text style={kick}>{catLabel(a.category)}</Text>
                            <Link href={utm(siteUrl, `/materia/${a.slug}`, `item-${i + 2}`)} style={{ textDecoration: "none" }}>
                              <Text style={{ fontFamily: SERIF, fontSize: "19px", lineHeight: "1.3", fontWeight: 700, color: C.ink, margin: "0 0 6px" }}>{a.title}</Text>
                            </Link>
                            {a.dek ? (
                              <Text style={{ fontFamily: SANS, fontSize: "14px", lineHeight: "1.55", color: C.ink2, margin: "0 0 8px" }}>{a.dek}</Text>
                            ) : null}
                            <Link href={utm(siteUrl, `/materia/${a.slug}`, `item-${i + 2}-ler`)} style={{ fontFamily: SANS, fontSize: "13.5px", fontWeight: 700, color: C.blueInk, textDecoration: "none" }}>
                              Ler →
                            </Link>
                          </td>
                          {a.cover_image_url ? (
                            <td valign="top" width="120" style={{ paddingLeft: "18px" }}>
                              <Link href={utm(siteUrl, `/materia/${a.slug}`, `item-${i + 2}-img`)}>
                                <Img src={a.cover_image_url} width="120" height="120" alt="" style={{ borderRadius: "8px", objectFit: "cover" as const, display: "block" }} />
                              </Link>
                            </td>
                          ) : null}
                        </tr>
                      </tbody>
                    </table>
                  </Section>
                ))}
              </>
            ) : null}
          </Section>

          {/* Ranking IA */}
          {ranking.length ? (
            <Section style={{ backgroundColor: C.ink, padding: "26px 32px", margin: "12px 0 0" }}>
              <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
                <tbody>
                  <tr>
                    <td>
                      <Text style={{ ...kick, color: "#7FB0FF", margin: "0 0 4px" }}>Ranking IA de hoje</Text>
                      <Text style={{ fontFamily: SERIF, fontSize: "20px", fontWeight: 700, color: "#fff", margin: "0 0 14px" }}>Quem lidera a corrida</Text>
                    </td>
                  </tr>
                  {ranking.slice(0, 3).map((r) => (
                    <tr key={r.position}>
                      <td style={{ borderTop: "1px solid rgba(255,255,255,.12)", padding: "11px 0" }}>
                        <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
                          <tbody>
                            <tr>
                              <td width="34" style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 700, color: "#7FB0FF" }}>{r.position}</td>
                              <td style={{ fontFamily: SANS, fontSize: "15px", color: "#fff", fontWeight: 700 }}>
                                {r.name}
                                {r.maker ? <span style={{ fontWeight: 400, color: "#AEB6C2" }}> · {r.maker}</span> : null}
                              </td>
                              <td align="right" style={{ fontFamily: SANS, fontSize: "12.5px", fontWeight: 700, whiteSpace: "nowrap" as const }}>
                                <Move pos={r.position} prev={r.previous} />
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ paddingTop: "8px" }}>
                      <Link href={utm(siteUrl, "/ranking", "ranking")} style={{ fontFamily: SANS, fontSize: "14px", fontWeight: 700, color: "#7FB0FF", textDecoration: "none" }}>
                        Ver o Ranking IA completo →
                      </Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          ) : null}

          {/* Participe */}
          <Section style={{ padding: "26px 32px 8px" }}>
            <Text style={sectionLabel}>Participe</Text>
            <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
              <tbody>
                <tr>
                  <td valign="top" style={{ paddingBottom: "14px" }}>
                    <Link href={utm(siteUrl, "/gente#indicar", "indicar")} style={{ fontFamily: SANS, fontSize: "15px", fontWeight: 700, color: C.ink, textDecoration: "none" }}>
                      Quem deve ser a próxima capa? →
                    </Link>
                    <Text style={{ fontFamily: SANS, fontSize: "13.5px", lineHeight: "1.5", color: C.ink3, margin: "4px 0 0" }}>
                      Indique um brasileiro que está fazendo a IA acontecer.
                    </Text>
                  </td>
                </tr>
                <tr>
                  <td valign="top" style={{ paddingBottom: "14px" }}>
                    <Text style={{ fontFamily: SANS, fontSize: "15px", fontWeight: 700, color: C.ink, margin: 0 }}>Responda este e-mail</Text>
                    <Text style={{ fontFamily: SANS, fontSize: "13.5px", lineHeight: "1.5", color: C.ink3, margin: "4px 0 0" }}>
                      Uma pauta, uma dúvida ou um caso de IA na sua empresa. A redação lê todas as respostas.
                    </Text>
                  </td>
                </tr>
                <tr>
                  <td valign="top">
                    <Text style={{ fontFamily: SANS, fontSize: "15px", fontWeight: 700, color: C.ink, margin: 0 }}>Encaminhe para um colega</Text>
                    <Text style={{ fontFamily: SANS, fontSize: "13.5px", lineHeight: "1.5", color: C.ink3, margin: "4px 0 0" }}>
                      Recebeu de alguém? Assine grátis em{" "}
                      <Link href={utm(siteUrl, "/newsletter", "indicacao")} style={{ color: C.blueInk }}>
                        ianewsbr.com/newsletter
                      </Link>
                      .
                    </Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* Rodapé */}
          <Section style={{ padding: "18px 32px 26px", borderTop: `1px solid ${C.rule}`, marginTop: "18px", textAlign: "center" as const }}>
            <Text style={{ fontFamily: SANS, fontSize: "12px", lineHeight: "1.7", color: C.ink3, margin: 0 }}>
              <Link href={utm(siteUrl, "/", "rodape")} style={{ color: C.ink3 }}>ianewsbr.com</Link> ·{" "}
              <Link href="https://www.instagram.com/ianews.co/" style={{ color: C.ink3 }}>Instagram</Link> ·{" "}
              <Link href={`${siteUrl}/termos`} style={{ color: C.ink3 }}>Privacidade</Link>
              <br />
              Você recebe este e-mail porque assinou a newsletter da IANews.
              {unsubscribeUrl ? (
                <>
                  {" "}
                  <Link href={unsubscribeUrl} style={{ color: C.ink3, textDecoration: "underline" }}>Cancelar inscrição</Link>
                </>
              ) : null}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default DailyNewsletter;
