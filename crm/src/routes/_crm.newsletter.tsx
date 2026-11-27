import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search } from "lucide-react";

import {
  AoVivo,
  BotaoCsv,
  CabecalhoPagina,
  Cartao,
  Carregando,
  Erro,
  Etiqueta,
  FaixaNumeros,
  FiltroSelect,
  Paginacao,
  Variacao,
  Vazio,
} from "@/components/crm/ui";
import { Input } from "@/components/ui/input";
import { getLeadsNewsletter, type LeadNewsletter } from "@/lib/crm/inicio.functions";
import { fmtDataHora, fmtNum, hojeBR, linkMateria, linkWhatsApp, somarDias } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/newsletter")({
  component: NewsletterPage,
});

/* Leads da newsletter: um painel de números, as assinaturas por semana, por onde chegam,
   o perfil declarado e a lista (filtro por situação, busca e CSV). */

type Filtro = "todos" | "ativos" | "pendentes" | "saiu" | "whatsapp";

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

const PERFIL: Record<string, string> = {
  empresario: "Dono(a) de empresa",
  executivo: "Executivo(a) ou gestor(a)",
  profissional: "Profissional que usa IA",
  fornecedor: "Vende ou implementa IA",
  investidor: "Investidor(a)",
  estudante: "Estudante",
};

function origemDe(l: LeadNewsletter): string {
  if (l.utm_source) return `${l.utm_source}${l.utm_campaign ? ` · ${l.utm_campaign}` : ""}`;
  if (l.cta_placement) return ORIGEM_LEGIVEL[l.cta_placement] ?? l.cta_placement;
  if (l.source) return ORIGEM_LEGIVEL[l.source] ?? l.source;
  return l.landing_path ?? "site";
}

/** Origem agrupada (sem a campanha), para o ranking. */
function canalDe(l: LeadNewsletter): string {
  if (l.utm_source) return l.utm_source.charAt(0).toUpperCase() + l.utm_source.slice(1);
  if (l.cta_placement) return ORIGEM_LEGIVEL[l.cta_placement] ?? l.cta_placement;
  if (l.source) return ORIGEM_LEGIVEL[l.source] ?? l.source;
  return "Site";
}

function situacao(l: LeadNewsletter): Exclude<Filtro, "todos" | "whatsapp"> {
  if (!l.is_active || l.unsubscribed_at) return "saiu";
  if (!l.confirmed_at) return "pendentes";
  return "ativos";
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const POR_PAGINA = 50;

function NewsletterPage() {
  const fetchLeads = useServerFn(getLeadsNewsletter);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [pagina, setPagina] = useState(0);
  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "newsletter-leads"],
    queryFn: () => fetchLeads(),
  });

  const leads = useMemo(() => data?.leads ?? [], [data]);
  const c = useMemo(() => {
    const r = { ativos: 0, pendentes: 0, saiu: 0, semana: 0, semanaAntes: 0, whatsapp: 0 };
    const agora = Date.now();
    for (const l of leads) {
      r[situacao(l)] += 1;
      const t = new Date(l.created_at).getTime();
      if (t >= agora - 7 * 86_400_000) r.semana += 1;
      else if (t >= agora - 14 * 86_400_000) r.semanaAntes += 1;
      if (l.phone) r.whatsapp += 1;
    }
    return r;
  }, [leads]);

  const visiveis = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (filtro === "todos" || (filtro === "whatsapp" ? !!l.phone : situacao(l) === filtro)) &&
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

  const total = leads.length;
  const pagina0 = Math.min(pagina, Math.max(0, Math.ceil(visiveis.length / POR_PAGINA) - 1));

  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <h1 className="font-display truncate text-[22px] font-bold leading-tight tracking-[-0.02em] sm:text-[28px]">
            Leads da newsletter
          </h1>
          <AoVivo className="hidden sm:inline-flex" />
        </div>
        <BotaoCsv
          nome="leads-newsletter"
          linhas={visiveis}
          colunas={[
            { titulo: "Nome", valor: (l) => l.full_name ?? "" },
            { titulo: "E-mail", valor: (l) => l.email },
            { titulo: "WhatsApp", valor: (l) => l.phone ?? "" },
            { titulo: "Situação", valor: (l) => situacao(l) },
            { titulo: "Perfil", valor: (l) => (l.perfil ? (PERFIL[l.perfil] ?? l.perfil) : "") },
            { titulo: "Origem", valor: (l) => origemDe(l) },
            { titulo: "Matéria", valor: (l) => linkMateria(l.article_slug) ?? "" },
            { titulo: "Assinou em", valor: (l) => l.created_at },
          ]}
        />
      </header>

      <FaixaNumeros
        itens={[
          {
            rotulo: "Assinantes ativos",
            valor: fmtNum(c.ativos),
            detalhe: `${pct(c.ativos, total)} de ${fmtNum(total)} cadastros`,
          },
          {
            rotulo: "Novos em 7 dias",
            valor: fmtNum(c.semana),
            detalhe: (
              <Variacao atual={c.semana} anterior={c.semanaAntes} rotulo="vs. 7 dias antes" />
            ),
          },
          {
            rotulo: "Sem confirmar",
            valor: fmtNum(c.pendentes),
            detalhe: "não clicaram no e-mail",
            tom: c.pendentes ? "alerta" : undefined,
          },
          {
            rotulo: "Saíram",
            valor: fmtNum(c.saiu),
            detalhe: `${pct(c.saiu, total)} dos cadastros`,
          },
          {
            rotulo: "Com WhatsApp",
            valor: fmtNum(c.whatsapp),
            detalhe: "prontos para contato",
            tom: c.whatsapp ? "azul" : undefined,
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <PorSemana leads={leads} />
        <Canais leads={leads} />
      </div>

      <Cartao
        titulo="Assinantes"
        sub={`${fmtNum(visiveis.length)} ${visiveis.length === 1 ? "pessoa" : "pessoas"}`}
        colado
      >
        <div className="flex flex-col gap-2 px-4 pb-3 sm:flex-row sm:items-center sm:px-5">
          <label className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setPagina(0);
              }}
              placeholder="Buscar nome, e-mail ou telefone"
              className="h-10 w-full pl-9 text-[14px] sm:h-9 sm:text-[13px]"
            />
          </label>
          <FiltroSelect
            valor={filtro}
            onChange={(v) => {
              setFiltro(v);
              setPagina(0);
            }}
            rotulo="Situação"
            opcoes={[
              { valor: "todos", rotulo: `Todos · ${fmtNum(total)}` },
              { valor: "ativos", rotulo: `Ativos · ${fmtNum(c.ativos)}` },
              { valor: "pendentes", rotulo: `Sem confirmar · ${fmtNum(c.pendentes)}` },
              { valor: "saiu", rotulo: `Saíram · ${fmtNum(c.saiu)}` },
              { valor: "whatsapp", rotulo: `Com WhatsApp · ${fmtNum(c.whatsapp)}` },
            ]}
          />
        </div>
        {visiveis.length ? (
          <>
            <ul className="divide-y border-t">
              {visiveis.slice(pagina0 * POR_PAGINA, (pagina0 + 1) * POR_PAGINA).map((l) => (
                <Linha key={l.id} l={l} />
              ))}
            </ul>
            <Paginacao
              pagina={pagina0}
              total={visiveis.length}
              porPagina={POR_PAGINA}
              onMudar={setPagina}
            />
          </>
        ) : (
          <div className="px-4 pb-4 sm:px-5">
            <Vazio>Nenhum assinante encontrado.</Vazio>
          </div>
        )}
      </Cartao>
    </div>
  );
}

function Linha({ l }: { l: LeadNewsletter }) {
  const s = situacao(l);
  const wpp = linkWhatsApp(l.phone);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_130px_104px] sm:px-5">
      <span className="min-w-0">
        <span className="block truncate text-[13.5px] font-semibold">
          {l.full_name || l.email.split("@")[0]}
        </span>
        <a
          href={`mailto:${l.email}`}
          className="block truncate text-[12px] text-muted-foreground hover:text-primary"
        >
          {l.email}
        </a>
      </span>
      <span className="order-3 col-span-2 min-w-0 text-[12px] text-muted-foreground sm:order-none sm:col-span-1">
        <span className="block truncate">
          {origemDe(l)}
          {l.perfil ? ` · ${PERFIL[l.perfil] ?? l.perfil}` : ""}
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
      <span className="hidden text-[12px] text-muted-foreground sm:block">
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
}

/** Assinaturas por semana (últimas 12), com a parte que confirmou o e-mail. */
function PorSemana({ leads }: { leads: LeadNewsletter[] }) {
  const semanas = useMemo(() => {
    const hoje = hojeBR();
    const lista = Array.from({ length: 12 }, (_, i) => {
      const fim = somarDias(hoje, -7 * (11 - i));
      return { inicio: somarDias(fim, -6), fim, novos: 0, confirmados: 0 };
    });
    for (const l of leads) {
      const dia = new Date(l.created_at).toLocaleDateString("en-CA", {
        timeZone: "America/Sao_Paulo",
      });
      const s = lista.find((x) => dia >= x.inicio && dia <= x.fim);
      if (!s) continue;
      s.novos += 1;
      if (l.confirmed_at) s.confirmados += 1;
    }
    return lista;
  }, [leads]);
  const [foco, setFoco] = useState<number | null>(null);
  const maior = Math.max(1, ...semanas.map((s) => s.novos));
  const total = semanas.reduce((s, x) => s + x.novos, 0);
  const atual = foco != null ? semanas[foco] : semanas[semanas.length - 1];
  const curto = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  return (
    <Cartao
      titulo="Assinaturas por semana"
      sub={`${fmtNum(total)} nas últimas 12 semanas · média ${fmtNum(Math.round(total / 12))} por semana`}
    >
      <p className="tabular mb-2 text-[12px] text-muted-foreground">
        {foco != null ? "Semana" : "Esta semana"} {curto(atual.inicio)} a {curto(atual.fim)}:{" "}
        <b className="font-semibold text-foreground">{fmtNum(atual.novos)}</b> novos ·{" "}
        {fmtNum(atual.confirmados)} confirmaram
      </p>
      <div className="flex h-40 items-end gap-1.5 border-b" onMouseLeave={() => setFoco(null)}>
        {semanas.map((s, i) => (
          <button
            key={s.inicio}
            type="button"
            aria-label={`Semana de ${curto(s.inicio)}: ${s.novos} novos`}
            onMouseEnter={() => setFoco(i)}
            onFocus={() => setFoco(i)}
            onClick={() => setFoco(foco === i ? null : i)}
            className="relative flex h-full min-w-0 flex-1 flex-col justify-end outline-none"
          >
            <span
              className={cn(
                "relative block w-full rounded-t-[4px] transition-colors",
                foco === i || (foco == null && i === semanas.length - 1)
                  ? "bg-[#9DB6FF]"
                  : "bg-[#DCE5FF]",
              )}
              style={{ height: `${(s.novos / maior) * 100}%` }}
            >
              <span
                className="absolute inset-x-0 bottom-0 rounded-t-[4px] bg-primary"
                style={{ height: s.novos ? `${(s.confirmados / s.novos) * 100}%` : 0 }}
              />
            </span>
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{curto(semanas[0].inicio)}</span>
        <span>hoje</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-[3px] bg-primary" /> confirmaram
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 rounded-[3px] bg-[#DCE5FF]" /> ainda não confirmaram
        </span>
      </div>
    </Cartao>
  );
}

/** Por onde chegam (canal) e quem são (perfil declarado), num cartão só. */
function Canais({ leads }: { leads: LeadNewsletter[] }) {
  const [ver, setVer] = useState<"canal" | "perfil">("canal");
  const itens = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of leads) {
      const k = ver === "canal" ? canalDe(l) : l.perfil ? (PERFIL[l.perfil] ?? l.perfil) : null;
      if (!k) continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([rotulo, total]) => ({ rotulo, total }))
      .sort((a, b) => b.total - a.total);
  }, [leads, ver]);
  const soma = itens.reduce((s, x) => s + x.total, 0);
  const maior = Math.max(1, ...itens.map((x) => x.total));
  return (
    <Cartao
      titulo={ver === "canal" ? "Por onde chegam" : "Quem são"}
      sub={
        ver === "canal"
          ? "Onde a pessoa assinou"
          : `${fmtNum(soma)} de ${fmtNum(leads.length)} responderam o perfil`
      }
      extra={
        <FiltroSelect
          valor={ver}
          onChange={setVer}
          titulo="Ver por"
          opcoes={[
            { valor: "canal", rotulo: "Canal" },
            { valor: "perfil", rotulo: "Perfil" },
          ]}
        />
      }
    >
      {itens.length ? (
        <ul className="space-y-3">
          {itens.slice(0, 7).map((o) => (
            <li key={o.rotulo}>
              <div className="flex items-baseline justify-between gap-3 text-[13.5px]">
                <span className="truncate">{o.rotulo}</span>
                <span className="tabular shrink-0">
                  <b className="font-semibold">{fmtNum(o.total)}</b>
                  <span className="ml-1.5 text-[12px] text-muted-foreground">
                    {pct(o.total, soma)}
                  </span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#EEF1F5]">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${(o.total / maior) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <Vazio>
          {ver === "perfil"
            ? "Ninguém respondeu o perfil ainda. A pergunta aparece logo depois de assinar."
            : "Sem dados de origem."}
        </Vazio>
      )}
    </Cartao>
  );
}
