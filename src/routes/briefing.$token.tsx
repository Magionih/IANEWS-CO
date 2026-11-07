import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { supabase } from "@/integrations/supabase/client";

/* Briefing da matéria por link (enviado pela equipe comercial). Sem login: o link é a chave.
   O progresso salva sozinho; a pessoa pode voltar depois pelo mesmo link. Quando a prévia
   fica pronta, a aprovação (ou o pedido de ajuste) acontece nesta mesma página. */

export const Route = createFileRoute("/briefing/$token")({
  head: () => ({
    meta: [
      { title: "Briefing da matéria | IA News" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: BriefingPage,
});

type Dados = Record<string, string | boolean>;
type Briefing = {
  status: "aberto" | "enviado" | "em_producao" | "previa" | "aprovado" | "ajuste";
  tipo: "pago" | "cortesia";
  dados: Dados;
  fotos: { path: string; url: string }[];
  previa_url: string | null;
  pessoa: string | null;
  empresa: string | null;
};

const CAMPOS: {
  k: string;
  rotulo: string;
  dica?: string;
  area?: boolean;
  obrigatorio?: boolean;
  full?: boolean;
}[] = [
  { k: "nome", rotulo: "Nome completo", obrigatorio: true },
  { k: "cargo", rotulo: "Cargo", obrigatorio: true },
  { k: "empresa", rotulo: "Empresa", obrigatorio: true },
  {
    k: "como_aparecer",
    rotulo: "Como o seu nome deve aparecer na matéria",
    dica: "Ex.: Ana Souza, CEO da Exemplo",
  },
  {
    k: "trajetoria",
    rotulo: "Sua trajetória",
    dica: "Como você começou, o que a empresa faz e os momentos que marcaram o caminho.",
    area: true,
    obrigatorio: true,
    full: true,
  },
  {
    k: "ia_entrou",
    rotulo: "Quando e como a IA entrou na história",
    area: true,
    full: true,
  },
  {
    k: "resultados",
    rotulo: "2 ou 3 resultados",
    dica: "Com números sempre que possível: clientes, faturamento, tempo economizado, rodada, equipe.",
    area: true,
    obrigatorio: true,
    full: true,
  },
  {
    k: "frase",
    rotulo: "Uma frase sua sobre IA",
    dica: "Ela pode virar destaque na matéria.",
    full: true,
  },
  { k: "instagram", rotulo: "Seu Instagram" },
  { k: "instagram_empresa", rotulo: "Instagram da empresa" },
  { k: "linkedin", rotulo: "Seu LinkedIn" },
  { k: "site", rotulo: "Site da empresa" },
  { k: "observacoes", rotulo: "Algo mais que a redação deva saber?", area: true, full: true },
];

async function api<T = any>(
  token: string,
  acao: string,
  extra: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch("/api/public/briefing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, acao, ...extra }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.ok === false)
    throw new Error(json.error ?? json.erro ?? "Não foi possível concluir.");
  return json as T;
}

function BriefingPage() {
  const { token } = Route.useParams();
  const [b, setB] = useState<Briefing | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<Dados>({});
  const [salvo, setSalvo] = useState<"salvo" | "salvando" | "pendente" | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [subindo, setSubindo] = useState(0);
  const [ajuste, setAjuste] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await api<{ briefing: Briefing }>(token, "ler");
      setB(r.briefing);
      setDados(r.briefing.dados ?? {});
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Link inválido.");
    }
  }, [token]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const editavel = b ? ["aberto", "enviado", "ajuste"].includes(b.status) : false;

  function mudar(k: string, v: string | boolean) {
    setDados((d) => {
      const novo = { ...d, [k]: v };
      setSalvo("pendente");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        setSalvo("salvando");
        try {
          await api(token, "salvar", { dados: novo });
          setSalvo("salvo");
        } catch {
          setSalvo("pendente");
        }
      }, 1200);
      return novo;
    });
  }

  async function enviarFotos(files: FileList | null) {
    if (!files?.length) return;
    setAviso(null);
    for (const f of Array.from(files).slice(0, 10)) {
      if (f.size > 10 * 1024 * 1024) {
        setAviso(`${f.name} passa de 10 MB.`);
        continue;
      }
      setSubindo((n) => n + 1);
      try {
        const up = await api<{ path: string; token: string }>(token, "upload", {
          nome: f.name,
          tipo: f.type,
        });
        const { error } = await supabase.storage
          .from("briefings")
          .uploadToSignedUrl(up.path, up.token, f, {
            contentType: f.type,
          });
        if (error) throw new Error(error.message);
        await api(token, "foto", { path: up.path });
      } catch (e) {
        setAviso(e instanceof Error ? e.message : "Não foi possível enviar a foto.");
      } finally {
        setSubindo((n) => n - 1);
      }
    }
    await carregar();
  }

  async function remover(path: string) {
    try {
      await api(token, "remover", { path });
      await carregar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível remover.");
    }
  }

  async function enviar() {
    setEnviando(true);
    setAviso(null);
    try {
      if (timer.current) clearTimeout(timer.current);
      await api(token, "enviar", { dados });
      await carregar();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível enviar.");
    } finally {
      setEnviando(false);
    }
  }

  async function decidir(aprovar: boolean) {
    setEnviando(true);
    setAviso(null);
    try {
      await api(token, aprovar ? "aprovar" : "ajuste", { ajuste });
      await carregar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "Não foi possível registrar.");
    } finally {
      setEnviando(false);
    }
  }

  const primeiroNome = (b?.pessoa ?? String(dados.nome ?? "")).split(" ")[0];

  return (
    <>
      <SiteHeader />
      <main id="main" className="page pt bf">
        <section className="pt-hero">
          <div className="wrap">
            <p className="kick">Briefing da matéria</p>
            <h1>
              {primeiroNome
                ? `${primeiroNome}, vamos contar a sua história.`
                : "Vamos contar a sua história."}
            </h1>
            <p className="sub">
              Leva uns 10 minutos. O progresso fica salvo e você pode voltar por este mesmo link.
              Antes de publicar, você recebe a prévia completa para aprovar.
            </p>
          </div>
        </section>

        <div className="wrap bf-corpo">
          {erro ? (
            <p className="bf-aviso" role="alert">
              {erro}
            </p>
          ) : !b ? (
            <p className="bf-status">Carregando…</p>
          ) : (
            <>
              {b.status === "enviado" ? (
                <p className="bf-ok" role="status">
                  Recebemos o seu briefing. A redação já está trabalhando na matéria e você recebe a
                  prévia para aprovar. Se quiser, ainda pode ajustar alguma informação abaixo.
                </p>
              ) : null}
              {b.status === "em_producao" ? (
                <p className="bf-ok">
                  A matéria está em produção. Em breve você recebe a prévia por aqui.
                </p>
              ) : null}
              {b.status === "aprovado" ? (
                <p className="bf-ok">
                  Prévia aprovada. Obrigado! A equipe confirma com você a data de publicação.
                </p>
              ) : null}

              {b.status === "previa" ? (
                <section className="pt-card bf-previa">
                  <h2>A prévia está pronta</h2>
                  <p>Confira a matéria e as artes antes de publicarmos.</p>
                  {b.previa_url ? (
                    <a
                      className="btn blue"
                      href={b.previa_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Abrir a prévia
                    </a>
                  ) : null}
                  <div className="bf-acoes">
                    <button
                      className="btn blue"
                      type="button"
                      disabled={enviando}
                      onClick={() => decidir(true)}
                    >
                      Aprovar
                    </button>
                  </div>
                  <label className="f full" htmlFor="bf-ajuste">
                    <span>Prefere ajustar algo? Descreva aqui (uma rodada de ajustes)</span>
                    <textarea
                      id="bf-ajuste"
                      className="field"
                      rows={4}
                      value={ajuste}
                      onChange={(e) => setAjuste(e.target.value)}
                    />
                  </label>
                  <button
                    className="btn"
                    type="button"
                    disabled={enviando || ajuste.trim().length < 5}
                    onClick={() => decidir(false)}
                  >
                    Pedir ajuste
                  </button>
                </section>
              ) : null}

              {editavel ? (
                <form
                  className="pt-card bf-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void enviar();
                  }}
                >
                  <div className="bf-grade">
                    {CAMPOS.map((c) => (
                      <label
                        key={c.k}
                        className={"f" + (c.full ? " full" : "")}
                        htmlFor={`bf-${c.k}`}
                      >
                        <span>
                          {c.rotulo}{" "}
                          {c.obrigatorio ? null : <small className="pt-opt">opcional</small>}
                        </span>
                        {c.area ? (
                          <textarea
                            id={`bf-${c.k}`}
                            className="field"
                            rows={5}
                            value={String(dados[c.k] ?? "")}
                            onChange={(e) => mudar(c.k, e.target.value)}
                          />
                        ) : (
                          <input
                            id={`bf-${c.k}`}
                            className="field"
                            value={String(dados[c.k] ?? "")}
                            onChange={(e) => mudar(c.k, e.target.value)}
                          />
                        )}
                        {c.dica ? <small className="bf-dica">{c.dica}</small> : null}
                      </label>
                    ))}
                  </div>

                  <div className="bf-fotos">
                    <h3>Fotos e logo</h3>
                    <p className="bf-dica">
                      3 a 5 fotos em boa resolução (pelo menos 1 na vertical) e o logo da empresa.
                      JPG, PNG, WebP ou SVG, até 10 MB cada.
                    </p>
                    <ul>
                      {b.fotos.map((f) => (
                        <li key={f.path}>
                          <img src={f.url} alt="" />
                          <button
                            type="button"
                            onClick={() => remover(f.path)}
                            aria-label="Remover foto"
                          >
                            Remover
                          </button>
                        </li>
                      ))}
                    </ul>
                    <label className="btn bf-up">
                      {subindo > 0 ? `Enviando ${subindo}…` : "Adicionar fotos"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/svg+xml"
                        multiple
                        hidden
                        onChange={(e) => {
                          void enviarFotos(e.target.files);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <label className="bf-check">
                    <input
                      type="checkbox"
                      checked={dados.autorizacao === true}
                      onChange={(e) => mudar("autorizacao", e.target.checked)}
                    />
                    <span>
                      Autorizo a IA News a usar estas informações e imagens na matéria e nos posts
                      sobre mim e minha empresa. Eu aprovo a prévia antes de qualquer publicação.
                    </span>
                  </label>

                  {aviso ? (
                    <p className="bf-aviso" role="alert">
                      {aviso}
                    </p>
                  ) : null}
                  <div className="bf-acoes">
                    <button className="btn blue" type="submit" disabled={enviando || subindo > 0}>
                      {b.status === "aberto" ? "Enviar briefing" : "Atualizar briefing"}
                    </button>
                    <span className="bf-status" aria-live="polite">
                      {salvo === "salvando"
                        ? "Salvando…"
                        : salvo === "salvo"
                          ? "Progresso salvo"
                          : ""}
                    </span>
                  </div>
                </form>
              ) : null}
              {!editavel && aviso ? (
                <p className="bf-aviso" role="alert">
                  {aviso}
                </p>
              ) : null}
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
