import React from "react";
import { Body, Container, Head, Html, Img, Link, Preview, Section, Text } from "@react-email/components";

import { CATEGORY_SEO } from "@/lib/categories";

/* Newsletter diária IANews — edição editorial (v2).
   Estrutura: cabeçalho de jornal → abertura → destaque da semana → ontem na IANews
   → Ranking IA do dia (com logos) → "Em 30 segundos" da semana → participe → rodapé. Tudo em tabelas/estilos inline (compatível com Gmail/Outlook). */

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
  /** Comentário curto da curadoria (ex.: "lidera em texto e código"). */
  note?: string | null;
};

/** Destaque do dia escolhido pela curadoria (matéria da semana, nunca repetida). */
export type NewsletterFeature = {
  title: string;
  dek?: string | null;
  why_it_matters?: string | null;
  category?: string | null;
  image_url?: string | null;
  image_credit?: string | null;
  /** Link absoluto: matéria no site ou fonte original. */
  url: string;
  source_name?: string | null;
};

/** Item do "Em 30 segundos": notícia relevante da semana. */
export type NewsletterBrief = { title: string; summary?: string | null; source_name?: string | null; url?: string | null };

/** Análise do Ranking IA feita pela curadoria (com fonte). */
export type NewsletterRankingAnalysis = {
  analysis: string;
  source_name?: string | null;
  source_url?: string | null;
  as_of?: string | null;
};

export type NewsletterProps = {
  editionLabel: string;
  siteUrl: string;
  /** Matérias publicadas ontem nos canais da IANews ("Mais de ontem"). */
  articles: NewsletterArticle[];
  recipientName?: string | null;
  unsubscribeUrl?: string | null;
  ranking?: NewsletterRankItem[];
  feature?: NewsletterFeature | null;
  briefs?: NewsletterBrief[];
  rankingAnalysis?: NewsletterRankingAnalysis | null;
  /** "ontem" (padrão) ou "recentes" quando não houve matéria no dia anterior. */
  articlesWindow?: "ontem" | "recentes";
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

/** Logo da empresa (arquivos em /public/email/logos). Sem logo conhecido, mostra a inicial. */
const LOGOS: [RegExp, string][] = [
  [/anthropic|claude/i, "anthropic"],
  [/\bmeta\b|muse|llama/i, "meta"],
  [/google|gemini|deepmind/i, "google"],
  [/\bxai\b|grok/i, "xai"],
  [/deepseek/i, "deepseek"],
  [/mistral/i, "mistral"],
  [/alibaba|qwen/i, "alibaba"],
  [/moonshot|kimi/i, "moonshot"],
  [/nvidia|nemotron/i, "nvidia"],
  [/perplexity/i, "perplexity"],
];
const makerLogo = (maker: string | null, name: string) => LOGOS.find(([re]) => re.test(`${maker ?? ""} ${name}`))?.[1] ?? null;

/** Converte uma matéria do site no formato de destaque. */
const articleAsFeature = (a: NewsletterArticle, siteUrl: string): NewsletterFeature => ({
  title: a.title,
  dek: a.dek,
  why_it_matters: a.why_it_matters,
  category: a.category,
  image_url: a.cover_image_url ?? null,
  url: utm(siteUrl, `/materia/${a.slug}`, "destaque"),
});

const withUtm = (url: string, siteUrl: string, content: string) =>
  url.startsWith(siteUrl) ? utm(siteUrl, url.slice(siteUrl.length) || "/", content) : url;

export function DailyNewsletter({
  editionLabel,
  siteUrl,
  articles,
  recipientName,
  unsubscribeUrl,
  ranking = [],
  feature: featureProp = null,
  briefs = [],
  rankingAnalysis = null,
  articlesWindow = "ontem",
}: NewsletterProps) {
  // Sem curadoria do dia, o destaque é a primeira matéria de ontem.
  const lead = featureProp ? null : articles[0] ?? null;
  const feature = featureProp ?? (lead ? articleAsFeature(lead, siteUrl) : null);
  const rest = lead ? articles.slice(1) : articles;
  // Tempo de leitura do e-mail (não das matérias completas).
  const minutes = Math.max(2, Math.round(1 + (feature ? 1.5 : 0) + briefs.length * 0.4 + rest.length * 0.5));
  const preview = feature
    ? `${feature.title}${rest.length ? ` · e mais ${rest.length} de ontem` : ""}`
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
              {briefs.length || featureProp
                ? articlesWindow === "recentes" || !articles.length
                  ? "O que mais importou em inteligência artificial nesta semana, escolhido pela redação da IANews."
                  : "O que mais importou em inteligência artificial nesta semana e tudo o que saiu ontem na IANews."
                : articles.length === 1
                  ? "Esta é a notícia de inteligência artificial que saiu ontem na IANews."
                  : `Estas são as ${articles.length} notícias de inteligência artificial que saíram ontem na IANews.`}
            </Text>

            {/* Destaque */}
            {feature ? (
              <Section>
                <Text style={sectionLabel}>{featureProp ? "Destaque da semana" : "Destaque"}</Text>
                {feature.image_url ? (
                  <Link href={withUtm(feature.url, siteUrl, "destaque-img")}>
                    <Img
                      src={feature.image_url}
                      width="576"
                      alt=""
                      style={{ width: "100%", maxWidth: "576px", height: "auto", borderRadius: "10px", display: "block", margin: "0 0 6px" }}
                    />
                  </Link>
                ) : null}
                {feature.image_url && feature.image_credit ? (
                  <Text style={{ fontFamily: SANS, fontSize: "11px", color: C.ink3, margin: "0 0 14px" }}>{feature.image_credit}</Text>
                ) : feature.image_url ? (
                  <div style={{ height: "12px" }}>&nbsp;</div>
                ) : null}
                {feature.category ? <Text style={kick}>{catLabel(feature.category)}</Text> : null}
                <Link href={withUtm(feature.url, siteUrl, "destaque-titulo")} style={{ textDecoration: "none" }}>
                  <Text style={{ fontFamily: SERIF, fontSize: "28px", lineHeight: "1.22", fontWeight: 700, color: C.ink, margin: "0 0 12px" }}>{feature.title}</Text>
                </Link>
                {feature.dek ? (
                  <Text style={{ fontFamily: SANS, fontSize: "16px", lineHeight: "1.6", color: C.ink2, margin: "0 0 16px" }}>{feature.dek}</Text>
                ) : null}
                {feature.why_it_matters ? (
                  <Section style={{ borderLeft: `3px solid ${C.blue}`, padding: "2px 0 2px 16px", margin: "0 0 20px" }}>
                    <Text style={{ ...kick, margin: "0 0 4px" }}>Por que importa</Text>
                    <Text style={{ fontFamily: SERIF, fontSize: "16px", lineHeight: "1.55", color: C.ink, margin: 0 }}>{feature.why_it_matters}</Text>
                  </Section>
                ) : null}
                <Link
                  href={withUtm(feature.url, siteUrl, "destaque-botao")}
                  style={{ display: "inline-block", backgroundColor: C.ink, color: "#fff", fontFamily: SANS, fontSize: "14px", fontWeight: 700, textDecoration: "none", padding: "12px 20px", borderRadius: "8px" }}
                >
                  Ler a matéria completa →
                </Link>
                {feature.source_name && !feature.url.startsWith(siteUrl) ? (
                  <Text style={{ fontFamily: SANS, fontSize: "12px", color: C.ink3, margin: "10px 0 0" }}>Fonte: {feature.source_name}</Text>
                ) : null}
              </Section>
            ) : null}

            {/* Mais de ontem */}
            {rest.length ? (
              <>
                <Rule m="32px 0 24px" />
                <Text style={sectionLabel}>
                  {articlesWindow === "recentes" ? "Recentes na IANews" : featureProp ? "Ontem na IANews" : "Mais de ontem"}
                </Text>
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

          {/* Ranking IA: quem lidera a corrida, com a marca de cada empresa */}
          {ranking.length ? (
            <Section style={{ backgroundColor: C.ink, padding: "28px 32px 26px", margin: "12px 0 0" }}>
              <Text style={{ ...kick, color: "#7FB0FF", margin: "0 0 4px" }}>Ranking IA de hoje</Text>
              <Text style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 700, color: "#fff", margin: "0 0 8px" }}>Quem lidera a corrida</Text>
              {rankingAnalysis?.analysis ? (
                <Text style={{ fontFamily: SANS, fontSize: "14px", lineHeight: "1.55", color: "#D5DAE3", margin: "0 0 18px" }}>{rankingAnalysis.analysis}</Text>
              ) : null}
              {ranking.slice(0, 3).map((r, i) => {
                const logo = makerLogo(r.maker, r.name);
                const first = i === 0;
                return (
                  <table
                    key={r.position}
                    width="100%"
                    cellPadding={0}
                    cellSpacing={0}
                    role="presentation"
                    style={{
                      backgroundColor: first ? "#16233A" : "#161B23",
                      border: `1px solid ${first ? "#2B4C80" : "#232A35"}`,
                      borderRadius: "12px",
                      marginBottom: "10px",
                    }}
                  >
                    <tbody>
                      <tr>
                        <td width="44" align="center" valign="middle" style={{ padding: "14px 0 14px 14px", fontFamily: SERIF, fontSize: first ? "30px" : "24px", fontWeight: 700, color: first ? "#7FB0FF" : "#8A93A2" }}>
                          {r.position}º
                        </td>
                        <td width="64" align="center" valign="middle" style={{ padding: "14px 6px" }}>
                          {logo ? (
                            <Img src={`${siteUrl}/email/logos/${logo}.png`} width={first ? "48" : "42"} height={first ? "48" : "42"} alt={r.maker ?? r.name} style={{ display: "block", borderRadius: "11px" }} />
                          ) : (
                            <div style={{ width: "42px", height: "42px", lineHeight: "42px", borderRadius: "11px", backgroundColor: "#fff", color: C.ink, fontFamily: SANS, fontSize: "18px", fontWeight: 700, textAlign: "center" as const }}>
                              {(r.maker ?? r.name).slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </td>
                        <td valign="middle" style={{ padding: "14px 6px" }}>
                          <Text style={{ fontFamily: SANS, fontSize: first ? "17px" : "15.5px", fontWeight: 700, color: "#fff", margin: 0, lineHeight: "1.3" }}>{r.name}</Text>
                          <Text style={{ fontFamily: SANS, fontSize: "12.5px", color: "#AEB6C2", margin: "2px 0 0", lineHeight: "1.4" }}>
                            {[r.maker, r.note].filter(Boolean).join(" · ")}
                          </Text>
                        </td>
                        <td align="right" valign="middle" style={{ padding: "14px 16px 14px 6px", fontFamily: SANS, fontSize: "12.5px", fontWeight: 700, whiteSpace: "nowrap" as const }}>
                          {first ? (
                            <span style={{ display: "inline-block", backgroundColor: C.blue, color: "#fff", borderRadius: "999px", padding: "4px 10px", fontSize: "11px", letterSpacing: "0.6px", textTransform: "uppercase" as const }}>
                              Líder
                            </span>
                          ) : r.previous != null ? (
                            <Move pos={r.position} prev={r.previous} />
                          ) : null}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                );
              })}
              <Link href={utm(siteUrl, "/ranking", "ranking")} style={{ display: "inline-block", marginTop: "8px", fontFamily: SANS, fontSize: "14px", fontWeight: 700, color: "#7FB0FF", textDecoration: "none" }}>
                Ver o Ranking IA completo →
              </Link>
              {rankingAnalysis?.source_name ? (
                <Text style={{ fontFamily: SANS, fontSize: "11.5px", color: "#8A93A2", margin: "10px 0 0" }}>
                  Fonte: {rankingAnalysis.source_url ? (
                    <Link href={rankingAnalysis.source_url} style={{ color: "#8A93A2", textDecoration: "underline" }}>{rankingAnalysis.source_name}</Link>
                  ) : (
                    rankingAnalysis.source_name
                  )}
                  {rankingAnalysis.as_of ? `, ${rankingAnalysis.as_of}` : ""}
                </Text>
              ) : null}
            </Section>
          ) : null}

          {/* Em 30 segundos: as notícias da semana (curadoria), no fim da edição */}
          {briefs.length ? (
            <Section style={{ padding: "30px 32px 6px" }}>
              <Text style={{ ...kick, margin: "0 0 4px" }}>Em 30 segundos</Text>
              <Text style={{ fontFamily: SERIF, fontSize: "22px", fontWeight: 700, color: C.ink, margin: "0 0 16px" }}>A semana da IA</Text>
              {briefs.map((b, i) => (
                <table
                  key={i}
                  width="100%"
                  cellPadding={0}
                  cellSpacing={0}
                  role="presentation"
                  style={{ borderTop: `1px solid ${C.rule}`, ...(i === briefs.length - 1 ? { borderBottom: `1px solid ${C.rule}` } : {}) }}
                >
                  <tbody>
                    <tr>
                      <td valign="top" width="40" style={{ padding: "14px 0" }}>
                        <div style={{ width: "28px", height: "28px", lineHeight: "28px", borderRadius: "14px", backgroundColor: C.blueSoft, color: C.blueInk, fontFamily: SANS, fontSize: "13px", fontWeight: 700, textAlign: "center" as const }}>
                          {i + 1}
                        </div>
                      </td>
                      <td valign="top" style={{ padding: "14px 0" }}>
                        {b.url ? (
                          <Link href={withUtm(b.url, siteUrl, `semana-${i + 1}`)} style={{ textDecoration: "none" }}>
                            <Text style={{ fontFamily: SANS, fontSize: "15.5px", lineHeight: "1.4", fontWeight: 700, color: C.ink, margin: 0 }}>{b.title}</Text>
                          </Link>
                        ) : (
                          <Text style={{ fontFamily: SANS, fontSize: "15.5px", lineHeight: "1.4", fontWeight: 700, color: C.ink, margin: 0 }}>{b.title}</Text>
                        )}
                        {b.summary ? (
                          <Text style={{ fontFamily: SANS, fontSize: "14px", lineHeight: "1.55", color: C.ink2, margin: "4px 0 0" }}>{b.summary}</Text>
                        ) : null}
                        {b.source_name ? (
                          <Text style={{ fontFamily: SANS, fontSize: "11.5px", letterSpacing: "0.3px", color: C.ink3, margin: "6px 0 0" }}>
                            {b.url ? (
                              <Link href={withUtm(b.url, siteUrl, `semana-${i + 1}-fonte`)} style={{ color: C.ink3, textDecoration: "underline" }}>
                                {b.source_name}
                              </Link>
                            ) : (
                              b.source_name
                            )}
                          </Text>
                        ) : null}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ))}
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
                    <Link href={utm(siteUrl, "/pauta", "pauta")} style={{ fontFamily: SANS, fontSize: "15px", fontWeight: 700, color: C.ink, textDecoration: "none" }}>
                      Sua empresa usa IA? Envie sua pauta →
                    </Link>
                    <Text style={{ fontFamily: SANS, fontSize: "13.5px", lineHeight: "1.5", color: C.ink3, margin: "4px 0 0" }}>
                      Conte o que vocês fazem com IA. A redação avalia e responde em até 2 dias úteis.
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
              <Link href={utm(siteUrl, "/pauta", "pauta-rodape")} style={{ color: C.ink3 }}>Envie sua pauta</Link> ·{" "}
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
