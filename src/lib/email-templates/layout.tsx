import React from "react";
import { Body, Container, Head, Html, Img, Link, Preview, Section, Text } from "@react-email/components";

/* Moldura comum dos e-mails da IANews, no visual do portal (cabeçalho escuro, azul #0066FF). */

export const SITE = "https://ianewsbr.com";
export const C = {
  ink: "#0D1117",
  ink2: "#3B4350",
  ink3: "#687180",
  rule: "#E1E5EA",
  soft: "#F4F6F9",
  blue: "#0066FF",
  blueInk: "#0050C8",
  blueSoft: "#EEF4FF",
};
export const FONT = "Roboto, 'Helvetica Neue', Arial, sans-serif";
export const SERIF = "'Source Serif 4', Georgia, 'Times New Roman', serif";

export const s = {
  kick: {
    fontFamily: FONT,
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "1.2px",
    textTransform: "uppercase" as const,
    color: C.blueInk,
    margin: "0 0 6px",
  },
  h1: { fontFamily: FONT, fontSize: "26px", lineHeight: "1.2", fontWeight: 800, color: C.ink, margin: "0 0 10px", letterSpacing: "-0.3px" },
  h2: { fontFamily: FONT, fontSize: "18px", lineHeight: "1.3", fontWeight: 700, color: C.ink, margin: "0 0 6px" },
  p: { fontFamily: SERIF, fontSize: "16px", lineHeight: "1.6", color: C.ink2, margin: "0 0 14px" },
  small: { fontFamily: FONT, fontSize: "12px", lineHeight: "1.6", color: C.ink3, margin: "0 0 8px" },
  button: {
    display: "inline-block",
    backgroundColor: C.blue,
    color: "#ffffff",
    fontFamily: FONT,
    fontSize: "15px",
    fontWeight: 700,
    textDecoration: "none",
    padding: "13px 22px",
    borderRadius: "8px",
  },
  link: { color: C.blueInk, fontFamily: FONT, fontWeight: 700, textDecoration: "none" },
};

export function Shell({
  preview,
  topRight,
  children,
  footer,
}: {
  preview: string;
  topRight?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Html lang="pt-BR" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: C.soft, margin: 0, padding: "24px 0", fontFamily: FONT }}>
        <Container style={{ maxWidth: "620px", width: "100%", margin: "0 auto" }}>
          <Section style={{ backgroundColor: C.ink, borderRadius: "12px 12px 0 0", padding: "18px 28px" }}>
            <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
              <tbody>
                <tr>
                  <td>
                    <Link href={SITE}>
                      <Img src={`${SITE}/email/ianews-logo-white.png`} width="120" height="24" alt="IANews" />
                    </Link>
                  </td>
                  {topRight ? (
                    <td align="right" style={{ fontFamily: FONT, fontSize: "12px", color: "#AEB6C2" }}>
                      {topRight}
                    </td>
                  ) : null}
                </tr>
              </tbody>
            </table>
          </Section>
          <Section style={{ backgroundColor: "#ffffff", padding: "30px 28px 8px", borderRadius: "0 0 12px 12px" }}>
            {children}
          </Section>
          <Section style={{ padding: "20px 28px" }}>
            {footer}
            <Text style={{ ...s.small, textAlign: "center" as const }}>
              <Link href={SITE} style={{ color: C.ink3 }}>
                ianewsbr.com
              </Link>{" "}
              ·{" "}
              <Link href="https://www.instagram.com/ianews.co/" style={{ color: C.ink3 }}>
                Instagram @ianews.co
              </Link>{" "}
              ·{" "}
              <Link href={`${SITE}/termos`} style={{ color: C.ink3 }}>
                Privacidade
              </Link>
            </Text>
            <Text style={{ ...s.small, textAlign: "center" as const }}>IANews · A corrida da IA, explicada para quem decide.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function CtaButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Section style={{ margin: "6px 0 22px" }}>
      <Link href={href} style={s.button}>
        {children}
      </Link>
    </Section>
  );
}
