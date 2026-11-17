import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";

/* Selo "Destaque na IA News" para quem saiu em matéria colocar no próprio site, com link para a matéria.
   Gera o código pronto a partir do link da matéria. */

const PAGE_URL = "https://ianewsbr.com/selo";
const TITLE = "Selo Destaque na IA News: mostre que sua empresa saiu na imprensa";
const DESCRIPTION =
  "Sua empresa saiu na IA News? Coloque o selo Destaque na IA News no seu site, com link para a matéria. Código pronto, em versão escura e clara.";

export const Route = createFileRoute("/selo")({
  validateSearch: (s: Record<string, unknown>): { materia?: string } => ({
    materia: typeof s["materia"] === "string" && /^[a-z0-9-]{3,200}$/.test(s["materia"]) ? s["materia"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: `${TITLE} | IA News` },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:url", content: PAGE_URL },
    ],
    links: [{ rel: "canonical", href: PAGE_URL }],
  }),
  component: SeloPage,
});

function slugFrom(v: string) {
  const t = v.trim();
  const m = t.match(/materia\/([a-z0-9-]{3,200})/i);
  if (m) return m[1].toLowerCase();
  return /^[a-z0-9-]{3,200}$/i.test(t) ? t.toLowerCase() : "";
}

function SeloPage() {
  const { materia } = Route.useSearch();
  const [link, setLink] = useState(materia ? `https://ianewsbr.com/materia/${materia}` : "");
  const [tema, setTema] = useState<"escuro" | "claro">("escuro");
  const [copied, setCopied] = useState(false);

  const slug = slugFrom(link);
  const href = slug ? `https://ianewsbr.com/materia/${slug}` : "https://ianewsbr.com";
  const img = tema === "escuro" ? "selo-ianews.svg" : "selo-ianews-claro.svg";
  const code = useMemo(
    () =>
      `<a href="${href}" title="Destaque na IA News" target="_blank" rel="noopener"><img src="https://ianewsbr.com/${img}" alt="Destaque na IA News" width="180" height="64" loading="lazy"></a>`,
    [href, img],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="selo wrap">
        <p className="selo-kick">Para quem saiu na IA News</p>
        <h1>Mostre que sua empresa saiu na IA News</h1>
        <p className="selo-lead">
          Coloque o selo no rodapé do seu site, na página "Na mídia" ou na sua página de imprensa. Ele leva o visitante
          direto para a sua matéria.
        </p>

        <div className="selo-grid">
          <div className="selo-preview" data-tema={tema}>
            <img src={`/${img}`} alt="Destaque na IA News" width={180} height={64} />
          </div>

          <div className="selo-form">
            <label className="f" htmlFor="selo-link">
              <span>Link da sua matéria na IA News</span>
              <input
                id="selo-link"
                className="field"
                type="url"
                inputMode="url"
                placeholder="https://ianewsbr.com/materia/..."
                value={link}
                onChange={(e) => setLink(e.target.value)}
              />
            </label>
            <fieldset className="selo-tema">
              <legend>Versão</legend>
              <label>
                <input type="radio" name="tema" checked={tema === "escuro"} onChange={() => setTema("escuro")} /> Escura
              </label>
              <label>
                <input type="radio" name="tema" checked={tema === "claro"} onChange={() => setTema("claro")} /> Clara
              </label>
            </fieldset>
            <label className="f" htmlFor="selo-code">
              <span>Código para colar no site</span>
              <textarea id="selo-code" className="field" rows={4} readOnly value={code} />
            </label>
            <button className="btn blue" type="button" onClick={copy}>
              {copied ? "Código copiado" : "Copiar código"}
            </button>
            {!slug ? <p className="selo-hint">Cole o link da sua matéria para o selo apontar direto para ela.</p> : null}
          </div>
        </div>

        <section className="selo-how">
          <h2>Onde usar</h2>
          <ul>
            <li>No rodapé do site, ao lado de prêmios e certificações.</li>
            <li>Na página "Na mídia" ou "Imprensa".</li>
            <li>No LinkedIn da empresa: compartilhe o link da matéria e marque a IA News.</li>
            <li>Em propostas e apresentações comerciais.</li>
          </ul>
          <p>
            Ainda não saiu na IA News? <Link to="/pauta" search={{}}>Envie sua pauta</Link>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
