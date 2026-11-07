import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";

/* Prévia do destaque por link (mesmo token do briefing). O lead vê as telas do post, a matéria e a
   legenda, e aprova ou pede uma rodada de ajuste. A aprovação agenda a publicação sozinha. */

export const Route = createFileRoute("/previa/$token")({
  head: () => ({
    meta: [
      { title: "Prévia do seu destaque | IA News" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PreviaPage,
});

type Previa = {
  status: "aberto" | "enviado" | "em_producao" | "previa" | "aprovado" | "ajuste";
  tipo: "pago" | "cortesia";
  ajuste_pedido: string | null;
  pessoa: string | null;
  empresa: string | null;
  producao: {
    status: string;
    versao: number;
    conteudo: { titulo?: string; dek?: string; body_markdown?: string; legenda?: string };
    telas: string[];
    capa: string | null;
    collabs: string[];
    data_publicacao: string | null;
    slug: string | null;
    social_url: string | null;
  } | null;
};

async function api<T = any>(token: string, acao: string, extra: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch("/api/public/briefing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, acao, ...extra }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false) throw new Error(json.error ?? json.erro ?? "Não foi possível concluir.");
  return json as T;
}

function quando(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function PreviaPage() {
  const { token } = Route.useParams();
  const [p, setP] = useState<Previa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [tela, setTela] = useState(0);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await api<{ previa: Previa | null }>(token, "previa");
      if (!r.previa) throw new Error("Este link não existe ou expirou.");
      setP(r.previa);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Link inválido.");
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function decidir(aprovar: boolean) {
    setEnviando(true);
    setAviso(null);
    try {
      await api(token, aprovar ? "aprovar" : "ajuste", { ajuste });
      await carregar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível registrar.");
    } finally {
      setEnviando(false);
    }
  }

  const pr = p?.producao ?? null;
  const c = pr?.conteudo ?? {};
  const primeiro = (p?.pessoa ?? "").split(" ")[0];
  const telas = pr?.telas ?? [];

  return (
    <>
      <SiteHeader />
      <main id="main" className="page pt bf">
        <section className="pt-hero">
          <div className="wrap">
            <p className="kick">Prévia do destaque</p>
            <h1>{primeiro ? `${primeiro}, assim vai sair o seu destaque.` : "Assim vai sair o seu destaque."}</h1>
            <p className="sub">
              Veja as telas do post, a matéria e a legenda. Se estiver tudo certo, aprove; se quiser mudar algo, peça o ajuste aqui mesmo.
            </p>
          </div>
        </section>

        <div className="wrap bf-corpo pv">
          {erro ? (
            <p className="bf-aviso" role="alert">{erro}</p>
          ) : !p ? (
            <p className="bf-status">Carregando…</p>
          ) : !pr || !["previa", "aprovado", "agendado", "publicado", "ajuste"].includes(pr.status) ? (
            <p className="bf-ok">A prévia ainda está em produção. Você recebe o aviso assim que ficar pronta.</p>
          ) : (
            <>
              {p.status === "aprovado" && pr.data_publicacao ? (
                <p className="bf-ok" role="status">
                  Aprovado! Publicação marcada para <strong>{quando(pr.data_publicacao)}</strong> (horário de Brasília) no Instagram, no site, no Facebook, no LinkedIn e no Threads, e na newsletter da manhã seguinte.
                  {pr.collabs.length ? ` Vai chegar um convite de colaboração no Instagram @${pr.collabs[0]}: é só aceitar.` : ""}
                </p>
              ) : p.status === "aprovado" ? (
                <p className="bf-ok" role="status">Aprovado! A equipe confirma com você a data de publicação.</p>
              ) : null}
              {pr.status === "publicado" && pr.slug ? (
                <p className="bf-ok">
                  No ar: <a href={`https://ianewsbr.com/materia/${pr.slug}`}>ianewsbr.com/materia/{pr.slug}</a>
                  {pr.social_url ? <> · <a href={pr.social_url}>post no Instagram</a></> : null}
                </p>
              ) : null}
              {p.status === "ajuste" ? (
                <p className="bf-ok">Pedido de ajuste recebido: “{p.ajuste_pedido}”. A nova versão chega em breve por este mesmo link.</p>
              ) : null}

              <section className="pt-card pv-telas">
                <h2>O post no Instagram</h2>
                <p className="bf-dica">Carrossel com {telas.length} telas, em collab {pr.collabs.length ? pr.collabs.map((x) => "@" + x).join(" e ") : "com o seu perfil"}.</p>
                {telas.length ? (
                  <div className="pv-carrossel">
                    <img src={telas[tela]} alt={`Tela ${tela + 1} de ${telas.length}`} />
                    <div className="pv-nav">
                      <button className="btn" type="button" disabled={tela === 0} onClick={() => setTela((t) => t - 1)}>Anterior</button>
                      <span className="bf-status">{tela + 1} / {telas.length}</span>
                      <button className="btn" type="button" disabled={tela >= telas.length - 1} onClick={() => setTela((t) => t + 1)}>Próxima</button>
                    </div>
                    <div className="pv-thumbs">
                      {telas.map((t, i) => (
                        <button key={t} type="button" className={i === tela ? "on" : ""} onClick={() => setTela(i)} aria-label={`Ver tela ${i + 1}`}>
                          <img src={t} alt="" />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </section>

              {c.legenda ? (
                <section className="pt-card">
                  <h2>Legenda</h2>
                  <pre className="pv-legenda">{c.legenda}</pre>
                  <button
                    className="btn"
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(c.legenda ?? "");
                        setCopiado(true);
                        setTimeout(() => setCopiado(false), 2000);
                      } catch {
                        /* sem clipboard */
                      }
                    }}
                  >
                    {copiado ? "Copiada" : "Copiar legenda"}
                  </button>
                </section>
              ) : null}

              <section className="pt-card pv-materia">
                <p className="kick">Matéria em ianewsbr.com</p>
                <h2>{c.titulo}</h2>
                {c.dek ? <p className="pv-dek">{c.dek}</p> : null}
                {pr.capa ? <img className="pv-capa" src={pr.capa} alt="" /> : null}
                <div className="pv-corpo">
                  <ReactMarkdown>{c.body_markdown ?? ""}</ReactMarkdown>
                </div>
              </section>

              {p.status === "previa" ? (
                <section className="pt-card bf-previa">
                  <h2>Está tudo certo?</h2>
                  <p>Ao aprovar, a publicação é marcada na primeira vaga do nosso calendário e você recebe a data na hora.</p>
                  {aviso ? <p className="bf-aviso" role="alert">{aviso}</p> : null}
                  <div className="bf-acoes">
                    <button className="btn blue" type="button" disabled={enviando} onClick={() => decidir(true)}>
                      Aprovar e publicar
                    </button>
                  </div>
                  <label className="f full" htmlFor="pv-ajuste">
                    <span>Prefere ajustar algo? Descreva aqui (uma rodada de ajustes)</span>
                    <textarea id="pv-ajuste" className="field" rows={4} value={ajuste} onChange={(e) => setAjuste(e.target.value)} />
                  </label>
                  <button className="btn" type="button" disabled={enviando || ajuste.trim().length < 5} onClick={() => decidir(false)}>
                    Pedir ajuste
                  </button>
                </section>
              ) : null}
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
