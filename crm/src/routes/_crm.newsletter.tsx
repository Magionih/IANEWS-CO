import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Mail, Search, UserCheck, UserMinus, UserPlus } from "lucide-react";

import {
  Alternador,
  BotaoCsv,
  CabecalhoPagina,
  Carregando,
  Erro,
  Etiqueta,
  Numero,
  Secao,
  Vazio,
} from "@/components/crm/ui";
import { Input } from "@/components/ui/input";
import { getLeadsNewsletter, type LeadNewsletter } from "@/lib/crm/inicio.functions";
import { fmtDataHora, fmtNum, linkMateria, linkWhatsApp } from "@/lib/crm/utils";

export const Route = createFileRoute("/_crm/newsletter")({
  component: NewsletterPage,
});

/* Leads da newsletter: quem assinou, quando, de onde veio e se está ativo. */

type Filtro = "todos" | "ativos" | "pendentes" | "saiu";

const ORIGEM_LEGIVEL: Record<string, string> = {
  "home-hero": "Home",
  "materia-inline": "Meio da matéria",
  "materia-fim": "Fim da matéria",
  "slim-band": "Faixa da home",
  "links-bio": "Link da bio",
  popup: "Pop-up",
  footer: "Rodapé",
  topo: "Topo do site",
  "materia-meio": "Meio da matéria",
  "materia-final": "Fim da matéria",
  "form-contato": "Formulário de contato",
  "links-bio-hero": "Link da bio",
  home: "Home",
  newsletter: "Página da newsletter",
};

function origemDe(l: LeadNewsletter): string {
  if (l.utm_source) return `${l.utm_source}${l.utm_campaign ? ` · ${l.utm_campaign}` : ""}`;
  if (l.cta_placement) return ORIGEM_LEGIVEL[l.cta_placement] ?? l.cta_placement;
  if (l.source) return ORIGEM_LEGIVEL[l.source] ?? l.source;
  return l.landing_path ?? "site";
}

function situacao(l: LeadNewsletter): Filtro {
  if (!l.is_active || l.unsubscribed_at) return "saiu";
  if (!l.confirmed_at) return "pendentes";
  return "ativos";
}

function NewsletterPage() {
  const fetchLeads = useServerFn(getLeadsNewsletter);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "newsletter-leads"],
    queryFn: () => fetchLeads(),
  });

  const leads = data?.leads ?? [];
  const contagem = useMemo(() => {
    const c = { todos: leads.length, ativos: 0, pendentes: 0, saiu: 0, semana: 0 };
    const ha7 = Date.now() - 7 * 86_400_000;
    for (const l of leads) {
      c[situacao(l)] += 1;
      if (new Date(l.created_at).getTime() >= ha7) c.semana += 1;
    }
    return c;
  }, [leads]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (filtro === "todos" || situacao(l) === filtro) &&
        (!q ||
          l.email.toLowerCase().includes(q) ||
          (l.full_name ?? "").toLowerCase().includes(q) ||
          (l.phone ?? "").includes(q)),
    );
  }, [leads, busca, filtro]);

  if (isLoading) return <Carregando texto="Carregando os assinantes..." />;
  if (error || !data) return <Erro erro={error} />;
  if (!data.permitido)
    return (
      <div className="space-y-5">
        <CabecalhoPagina titulo="Leads da newsletter" />
        <Vazio>Só administradores podem ver a lista de assinantes.</Vazio>
      </div>
    );

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Leads da newsletter"
        descricao="Quem assinou a newsletter da IA News, quando e por onde chegou."
        acoes={
          <BotaoCsv
            nome="leads-newsletter"
            linhas={visiveis}
            colunas={[
              { titulo: "Nome", valor: (l) => l.full_name ?? "" },
              { titulo: "E-mail", valor: (l) => l.email },
              { titulo: "WhatsApp", valor: (l) => l.phone ?? "" },
              { titulo: "Situação", valor: (l) => situacao(l) },
              { titulo: "Origem", valor: (l) => origemDe(l) },
              { titulo: "Matéria", valor: (l) => linkMateria(l.article_slug) ?? "" },
              { titulo: "Assinou em", valor: (l) => l.created_at },
            ]}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Numero
          rotulo="Assinantes ativos"
          valor={fmtNum(contagem.ativos)}
          destaque="azul"
          icone={UserCheck}
        />
        <Numero rotulo="Novos em 7 dias" valor={fmtNum(contagem.semana)} icone={UserPlus} />
        <Numero
          rotulo="Sem confirmar"
          valor={fmtNum(contagem.pendentes)}
          detalhe="não clicaram no e-mail de confirmação"
          icone={Mail}
        />
        <Numero rotulo="Saíram" valor={fmtNum(contagem.saiu)} icone={UserMinus} />
      </div>

      <Secao
        titulo="Assinantes"
        contagem={visiveis.length}
        colado
        acoes={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Alternador
              valor={filtro}
              onChange={setFiltro}
              opcoes={[
                { valor: "todos", rotulo: "Todos" },
                { valor: "ativos", rotulo: "Ativos" },
                { valor: "pendentes", rotulo: "Sem confirmar" },
                { valor: "saiu", rotulo: "Saíram" },
              ]}
            />
            <label className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar nome ou e-mail"
                className="h-8 w-full pl-8 text-[13px] sm:w-56"
              />
            </label>
          </div>
        }
      >
        {visiveis.length ? (
          <ul className="divide-y">
            {visiveis.slice(0, 300).map((l) => {
              const s = situacao(l);
              const wpp = linkWhatsApp(l.phone);
              return (
                <li
                  key={l.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_120px_auto] sm:px-5"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold">
                      {l.full_name || l.email.split("@")[0]}
                    </span>
                    <a
                      href={`mailto:${l.email}`}
                      className="block truncate text-xs text-muted-foreground hover:text-primary"
                    >
                      {l.email}
                    </a>
                  </span>
                  <span className="order-3 col-span-2 min-w-0 text-xs text-muted-foreground sm:order-none sm:col-span-1">
                    <span className="block truncate">
                      {origemDe(l)}
                      <span className="sm:hidden"> · {fmtDataHora(l.created_at)}</span>
                    </span>
                    {l.article_slug ? (
                      <a
                        href={linkMateria(l.article_slug) ?? undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate text-primary hover:underline"
                      >
                        {l.article_slug}
                      </a>
                    ) : null}
                  </span>
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    {fmtDataHora(l.created_at)}
                    {wpp ? (
                      <a
                        href={wpp}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-primary hover:underline"
                      >
                        WhatsApp
                      </a>
                    ) : null}
                  </span>
                  <span className="justify-self-end">
                    {s === "ativos" ? (
                      <Etiqueta tom="ok">ativo</Etiqueta>
                    ) : s === "pendentes" ? (
                      <Etiqueta>sem confirmar</Etiqueta>
                    ) : (
                      <Etiqueta tom="alerta">saiu</Etiqueta>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="p-5">
            <Vazio>Nenhum assinante encontrado.</Vazio>
          </div>
        )}
        {visiveis.length > 300 ? (
          <p className="border-t px-5 py-3 text-xs text-muted-foreground">
            Mostrando 300 de {fmtNum(visiveis.length)}. Use a busca ou baixe o CSV.
          </p>
        ) : null}
      </Secao>
    </div>
  );
}
