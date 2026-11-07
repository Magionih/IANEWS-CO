// Somente servidor. Renderiza as telas do destaque (1080x1350, 4:5) em PNG com satori + resvg,
// na identidade da IA News (navy, azul, Oswald na capa, Fraunces nos títulos, Inter Tight no corpo).

const SITE = process.env.NEWSLETTER_SITE_URL?.trim() || "https://ianewsbr.com";
const W = 1080;
const H = 1350;
const NAVY = "#070B18";
const BLUE = "#1B6DFF";
const SKY = "#8FBAFF";
const CREAM = "#F2EFE6";
const MUTED = "#B9BFCF";

export type Tela =
  | {
      tipo: "capa";
      kicker: string;
      titulo: string;
      destaque: string | null;
      subtitulo: string | null;
      foto: string | null;
      credito: string | null;
    }
  | { tipo: "texto"; eyebrow: string; titulo: string; paragrafos: string[]; foto: string | null }
  | {
      tipo: "numeros";
      eyebrow: string;
      titulo: string;
      numeros: { valor: string; rotulo: string }[];
    }
  | { tipo: "frase"; frase: string; quem: string; cargo: string | null; foto: string | null }
  | { tipo: "final"; titulo: string; texto: string; collabs: string[] };

type Font = { name: string; data: ArrayBuffer; weight: 400 | 500 | 600 | 700; style: "normal" };
let fontsCache: Font[] | null = null;

async function fonts(): Promise<Font[]> {
  if (fontsCache) return fontsCache;
  const load = async (file: string, name: string, weight: Font["weight"]): Promise<Font> => {
    // Localmente, lê do disco; em produção, busca no próprio site (public/fonts).
    try {
      const { readFile } = await import("node:fs/promises");
      const buf = await readFile(`${process.cwd()}/public/fonts/${file}`);
      return {
        name,
        data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
        weight,
        style: "normal",
      };
    } catch {
      /* sem arquivo local */
    }
    const res = await fetch(`${SITE}/fonts/${file}`);
    if (!res.ok) throw new Error(`Fonte ${file}: ${res.status}`);
    return { name, data: await res.arrayBuffer(), weight, style: "normal" };
  };
  fontsCache = await Promise.all([
    load("oswald-700.woff", "Oswald", 700),
    load("fraunces-600.woff", "Fraunces", 600),
    load("fraunces-700.woff", "Fraunces", 700),
    load("inter-tight-500.woff", "Inter Tight", 500),
    load("inter-tight-700.woff", "Inter Tight", 700),
  ]);
  return fontsCache;
}

// Árvore no formato que o satori aceita (objetos {type, props}), sem JSX para ficar fora do React.
type Node = {
  type: string;
  props: Record<string, unknown> & { children?: Node | Node[] | string | null };
};
const el = (
  type: string,
  props: Record<string, unknown>,
  ...children: (Node | string | null | false)[]
): Node => ({
  type,
  props: {
    ...props,
    children:
      children.filter(Boolean).length <= 1
        ? ((children.filter(Boolean)[0] as Node | string) ?? null)
        : (children.filter(Boolean) as Node[]),
  },
});
const col = (style: Record<string, unknown>, ...children: (Node | string | null | false)[]) =>
  el("div", { style: { display: "flex", flexDirection: "column", ...style } }, ...children);
const row = (style: Record<string, unknown>, ...children: (Node | string | null | false)[]) =>
  el("div", { style: { display: "flex", flexDirection: "row", ...style } }, ...children);
const txt = (s: string, style: Record<string, unknown>) =>
  el("div", { style: { display: "flex", ...style } }, s);

function logo(h = 44) {
  return el("img", {
    src: `${SITE}/email/ianews-logo-white.png`,
    style: { height: h, width: h * 5, objectFit: "contain" },
  });
}

function rodape(direita: string) {
  return row(
    {
      position: "absolute",
      left: 64,
      right: 64,
      bottom: 56,
      justifyContent: "space-between",
      alignItems: "center",
    },
    logo(40),
    txt(direita, {
      fontFamily: "Inter Tight",
      fontWeight: 700,
      fontSize: 22,
      letterSpacing: 2,
      color: "#AEB6C9",
      textTransform: "uppercase",
    }),
  );
}

function tamanhoTitulo(t: string, base: number, min: number) {
  const n = t.length;
  if (n <= 40) return base;
  if (n <= 70) return Math.max(min, base - 10);
  if (n <= 100) return Math.max(min, base - 20);
  return min;
}

function arvore(tela: Tela): Node {
  const base = {
    width: W,
    height: H,
    display: "flex",
    backgroundColor: NAVY,
    color: "#fff",
    position: "relative",
  };
  switch (tela.tipo) {
    case "capa": {
      const fs = tamanhoTitulo(tela.titulo, 88, 60);
      return col(
        base,
        tela.foto
          ? el("img", {
              src: tela.foto,
              style: {
                position: "absolute",
                top: 0,
                left: 0,
                width: W,
                height: H,
                objectFit: "cover",
                objectPosition: "50% 20%",
              },
            })
          : null,
        el("div", {
          style: {
            position: "absolute",
            top: 0,
            left: 0,
            width: W,
            height: H,
            display: "flex",
            backgroundImage:
              "linear-gradient(180deg, rgba(7,11,24,0.05) 25%, rgba(7,11,24,0.86) 62%, #070B18 92%)",
          },
        }),
        col(
          { position: "absolute", left: 64, right: 64, bottom: 150 },
          txt(tela.kicker, {
            fontFamily: "Inter Tight",
            fontWeight: 700,
            fontSize: 23,
            letterSpacing: 5,
            color: SKY,
            textTransform: "uppercase",
            marginBottom: 26,
          }),
          el(
            "div",
            {
              style: {
                display: "flex",
                flexWrap: "wrap",
                fontFamily: "Oswald",
                fontWeight: 700,
                fontSize: fs,
                lineHeight: 1.06,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              },
            },
            ...tela.titulo.split(" ").map((w) =>
              txt(w + " ", {
                color:
                  tela.destaque &&
                  tela.destaque
                    .toLowerCase()
                    .split(" ")
                    .includes(w.toLowerCase().replace(/[,.:]/g, ""))
                    ? "#4D9FFF"
                    : "#fff",
                marginRight: 14,
              }),
            ),
          ),
          tela.subtitulo
            ? txt(tela.subtitulo, {
                marginTop: 28,
                fontFamily: "Inter Tight",
                fontWeight: 500,
                fontSize: 32,
                lineHeight: 1.4,
                color: "#C6CCDC",
                maxWidth: 860,
              })
            : null,
        ),
        rodape(tela.credito ?? "ianewsbr.com"),
      );
    }
    case "texto": {
      const fs = tamanhoTitulo(tela.titulo, 62, 44);
      return col(
        base,
        tela.foto
          ? el("img", {
              src: tela.foto,
              style: { width: W, height: 420, objectFit: "cover", objectPosition: "50% 25%" },
            })
          : el("div", { style: { display: "flex", width: W, height: 120 } }),
        col(
          { paddingLeft: 64, paddingRight: 64, paddingTop: 48, flexGrow: 1 },
          txt(tela.eyebrow, {
            fontFamily: "Inter Tight",
            fontWeight: 700,
            fontSize: 23,
            letterSpacing: 4,
            color: BLUE,
            textTransform: "uppercase",
            marginBottom: 24,
          }),
          txt(tela.titulo, {
            fontFamily: "Fraunces",
            fontWeight: 600,
            fontSize: fs,
            lineHeight: 1.16,
            color: CREAM,
            marginBottom: 30,
          }),
          ...tela.paragrafos.slice(0, 3).map((p) =>
            txt(p, {
              fontFamily: "Inter Tight",
              fontWeight: 500,
              fontSize: tela.paragrafos.join("").length > 420 ? 30 : 34,
              lineHeight: 1.45,
              color: MUTED,
              marginBottom: 22,
            }),
          ),
        ),
        rodape("ianewsbr.com"),
      );
    }
    case "numeros":
      return col(
        base,
        col(
          { paddingLeft: 64, paddingRight: 64, paddingTop: 110, flexGrow: 1 },
          txt(tela.eyebrow, {
            fontFamily: "Inter Tight",
            fontWeight: 700,
            fontSize: 23,
            letterSpacing: 4,
            color: BLUE,
            textTransform: "uppercase",
            marginBottom: 24,
          }),
          txt(tela.titulo, {
            fontFamily: "Fraunces",
            fontWeight: 600,
            fontSize: 56,
            lineHeight: 1.16,
            color: CREAM,
            marginBottom: 54,
          }),
          ...tela.numeros.slice(0, 3).map((n) =>
            col(
              {
                paddingTop: 34,
                paddingBottom: 34,
                borderTop: "1px solid rgba(143,186,255,0.25)",
              },
              txt(n.valor, {
                fontFamily: "Fraunces",
                fontWeight: 700,
                fontSize: n.valor.length > 8 ? 96 : 128,
                lineHeight: 1,
                letterSpacing: -3,
                color: BLUE,
              }),
              txt(n.rotulo, {
                fontFamily: "Inter Tight",
                fontWeight: 700,
                fontSize: 34,
                lineHeight: 1.3,
                color: CREAM,
                marginTop: 14,
              }),
            ),
          ),
        ),
        rodape("ianewsbr.com"),
      );
    case "frase":
      return col(
        base,
        tela.foto
          ? el("img", {
              src: tela.foto,
              style: { width: W, height: 460, objectFit: "cover", objectPosition: "50% 25%" },
            })
          : el("div", { style: { display: "flex", width: W, height: 140 } }),
        col(
          { paddingLeft: 64, paddingRight: 64, paddingTop: 70, flexGrow: 1 },
          txt("“", {
            fontFamily: "Fraunces",
            fontWeight: 700,
            fontSize: 200,
            lineHeight: 0.6,
            color: BLUE,
            marginBottom: 10,
          }),
          txt(tela.frase, {
            fontFamily: "Fraunces",
            fontWeight: 600,
            fontSize: tamanhoTitulo(tela.frase, 60, 42),
            lineHeight: 1.28,
            color: CREAM,
          }),
          txt(tela.quem, {
            fontFamily: "Inter Tight",
            fontWeight: 700,
            fontSize: 30,
            color: "#fff",
            marginTop: 40,
          }),
          tela.cargo
            ? txt(tela.cargo, {
                fontFamily: "Inter Tight",
                fontWeight: 500,
                fontSize: 27,
                color: "#9AA1B5",
                marginTop: 6,
              })
            : null,
        ),
        rodape("ianewsbr.com"),
      );
    case "final":
      return col(
        base,
        col(
          { paddingLeft: 64, paddingRight: 64, paddingTop: 160, flexGrow: 1 },
          txt("MATÉRIA COMPLETA", {
            fontFamily: "Inter Tight",
            fontWeight: 700,
            fontSize: 23,
            letterSpacing: 5,
            color: SKY,
            textTransform: "uppercase",
            marginBottom: 28,
          }),
          txt(tela.titulo, {
            fontFamily: "Fraunces",
            fontWeight: 600,
            fontSize: 64,
            lineHeight: 1.14,
            color: CREAM,
            marginBottom: 36,
          }),
          txt(tela.texto, {
            fontFamily: "Inter Tight",
            fontWeight: 500,
            fontSize: 34,
            lineHeight: 1.45,
            color: MUTED,
            marginBottom: 50,
          }),
          txt("ianewsbr.com", {
            fontFamily: "Oswald",
            fontWeight: 700,
            fontSize: 72,
            color: "#fff",
            textTransform: "uppercase",
            letterSpacing: 1,
          }),
          tela.collabs.length
            ? txt(
                "Em collab com " + tela.collabs.map((c) => "@" + c.replace(/^@/, "")).join(" e "),
                {
                  fontFamily: "Inter Tight",
                  fontWeight: 700,
                  fontSize: 28,
                  color: SKY,
                  marginTop: 40,
                },
              )
            : null,
        ),
        rodape("toda manhã, IA e negócios no Brasil"),
      );
  }
}

export async function renderTelaPng(tela: Tela): Promise<Buffer> {
  const [{ default: satori }, { Resvg }] = await Promise.all([
    import("satori"),
    import("@resvg/resvg-js"),
  ]);
  const svg = await satori(arvore(tela) as never, {
    width: W,
    height: H,
    fonts: (await fonts()) as never,
  });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
  return Buffer.from(png);
}
