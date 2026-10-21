import React from "react";
import { Hr, Img, Link, Section, Text } from "@react-email/components";

import { CATEGORY_SEO } from "@/lib/categories";
import { C, CtaButton, FONT, Shell, s } from "@/lib/email-templates/layout";

export type NewsletterArticle = {
  slug: string;
  title: string;
  dek: string | null;
  category: string;
  why_it_matters: string | null;
  read_minutes: number | null;
  cover_image_url?: string | null;
};

export type NewsletterProps = {
  editionLabel: string;
  siteUrl: string;
  articles: NewsletterArticle[];
  recipientName?: string | null;
  /** Link de descadastro do leitor (um clique). */
  unsubscribeUrl?: string | null;
};

const catLabel = (c: string) => CATEGORY_SEO[c]?.label ?? c;

function utm(siteUrl: string, path: string, content: string) {
  return `${siteUrl}${path}?utm_source=newsletter&utm_medium=email&utm_campaign=diaria&utm_content=${content}`;
}

export function DailyNewsletter({ editionLabel, siteUrl, articles, recipientName, unsubscribeUrl }: NewsletterProps) {
  const [lead, ...rest] = articles;
  const count = articles.length;
  const preview = lead ? `${lead.title} — e mais ${count - 1} notícias de IA de ontem` : "As notícias de IA de ontem";

  return (
    <Shell
      preview={preview}
      topRight={editionLabel}
      footer={
        <Text style={{ ...s.small, textAlign: "center" as const }}>
          Você recebe este e-mail porque assinou a newsletter da IANews.{" "}
          {unsubscribeUrl ? (
            <Link href={unsubscribeUrl} style={{ color: C.ink3, textDecoration: "underline" }}>
              Cancelar inscrição
            </Link>
          ) : null}
        </Text>
      }
    >
      <Text style={s.kick}>Newsletter diária</Text>
      <Text style={s.h1}>{recipientName ? `Bom dia, ${recipientName}.` : "Bom dia."}</Text>
      <Text style={s.p}>
        {count === 1
          ? "A notícia de inteligência artificial que saiu ontem na IANews, explicada para quem decide."
          : `As ${count} notícias de inteligência artificial que saíram ontem na IANews, explicadas para quem decide. Leitura de poucos minutos.`}
      </Text>

      {lead ? (
        <Section style={{ marginTop: "8px" }}>
          {lead.cover_image_url ? (
            <Link href={utm(siteUrl, `/materia/${lead.slug}`, "destaque-img")}>
              <Img
                src={lead.cover_image_url}
                width="564"
                alt=""
                style={{ width: "100%", maxWidth: "564px", height: "auto", borderRadius: "10px", display: "block", marginBottom: "16px" }}
              />
            </Link>
          ) : null}
          <Text style={s.kick}>{catLabel(lead.category)}</Text>
          <Link href={utm(siteUrl, `/materia/${lead.slug}`, "destaque-titulo")} style={{ textDecoration: "none" }}>
            <Text style={{ ...s.h1, fontSize: "24px" }}>{lead.title}</Text>
          </Link>
          {lead.dek ? <Text style={s.p}>{lead.dek}</Text> : null}
          {lead.why_it_matters ? (
            <Section style={{ backgroundColor: C.blueSoft, borderLeft: `3px solid ${C.blue}`, padding: "12px 16px", margin: "0 0 16px", borderRadius: "0 8px 8px 0" }}>
              <Text style={{ ...s.kick, margin: "0 0 4px" }}>Por que importa</Text>
              <Text style={{ fontFamily: FONT, fontSize: "14px", lineHeight: "1.55", color: C.ink2, margin: 0 }}>{lead.why_it_matters}</Text>
            </Section>
          ) : null}
          <CtaButton href={utm(siteUrl, `/materia/${lead.slug}`, "destaque-botao")}>Ler a matéria completa</CtaButton>
        </Section>
      ) : null}

      {rest.length ? (
        <>
          <Hr style={{ borderColor: C.rule, margin: "8px 0 22px" }} />
          <Text style={{ ...s.kick, color: C.ink3 }}>Também ontem na IANews</Text>
          {rest.map((a, i) => (
            <Section key={a.slug} style={{ padding: "14px 0", borderBottom: i < rest.length - 1 ? `1px solid ${C.rule}` : "none" }}>
              <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
                <tbody>
                  <tr>
                    <td valign="top">
                      <Text style={s.kick}>{catLabel(a.category)}</Text>
                      <Link href={utm(siteUrl, `/materia/${a.slug}`, `item-${i + 2}`)} style={{ textDecoration: "none" }}>
                        <Text style={s.h2}>{a.title}</Text>
                      </Link>
                      {a.dek ? (
                        <Text style={{ fontFamily: FONT, fontSize: "14px", lineHeight: "1.55", color: C.ink2, margin: "0 0 8px" }}>{a.dek}</Text>
                      ) : null}
                      <Link href={utm(siteUrl, `/materia/${a.slug}`, `item-${i + 2}-ler`)} style={{ ...s.link, fontSize: "14px" }}>
                        Ler →
                      </Link>
                    </td>
                    {a.cover_image_url ? (
                      <td valign="top" width="112" style={{ paddingLeft: "16px" }}>
                        <Link href={utm(siteUrl, `/materia/${a.slug}`, `item-${i + 2}-img`)}>
                          <Img src={a.cover_image_url} width="112" height="84" alt="" style={{ borderRadius: "8px", objectFit: "cover" as const, display: "block" }} />
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

      <Section style={{ backgroundColor: C.soft, borderRadius: "10px", padding: "18px 20px", margin: "24px 0 16px" }}>
        <Text style={{ ...s.h2, fontSize: "16px" }}>Qual IA está na frente hoje?</Text>
        <Text style={{ fontFamily: FONT, fontSize: "14px", lineHeight: "1.55", color: C.ink2, margin: "0 0 8px" }}>
          O Ranking IA compara as principais plataformas de inteligência artificial e é atualizado todo dia.
        </Text>
        <Link href={utm(siteUrl, "/ranking", "ranking")} style={{ ...s.link, fontSize: "14px" }}>
          Ver o Ranking IA →
        </Link>
      </Section>

      <Text style={{ ...s.small, margin: "0 0 22px" }}>
        Conhece alguém que precisa acompanhar a IA? Encaminhe este e-mail ou mande o link{" "}
        <Link href={utm(siteUrl, "/newsletter", "indicacao")} style={{ color: C.blueInk }}>
          ianewsbr.com/newsletter
        </Link>
        .
      </Text>
    </Shell>
  );
}

export default DailyNewsletter;
