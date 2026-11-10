import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Plus, UserCheck } from "lucide-react";

import { useCrm } from "@/components/crm/context";
import { useAcao } from "@/components/crm/queries";
import { CabecalhoPagina, Carregando, Erro, Numero, Secao, Vazio } from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FLUXOS, liberarRobo, painelDirect, salvarPalavra, type PalavraDirect } from "@/lib/crm/direct.functions";
import { fmtDataHora } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/direct")({
  component: DirectPage,
});

const NOME_FLUXO: Record<string, string> = {
  noticias: "Notícias às 7h",
  radar: "Radar do setor",
  lista: "Lista 100",
  aula: "Aula ao vivo",
  palco: "Palco Online 16/12",
  conselho: "Conselho",
  projeto: "Balcão de Projetos",
  anunciar: "Publicidade",
  pauta: "Pauta",
  menu: "Menu",
  humano: "Atendimento humano",
  sair: "Saiu",
};

function DirectPage() {
  const { isAdmin } = useCrm();
  const fetchPainel = useServerFn(painelDirect);
  const salvar = useServerFn(salvarPalavra);
  const liberar = useServerFn(liberarRobo);
  const { executar, ocupado } = useAcao();
  const q = useQuery({ queryKey: ["crm", "direct"], queryFn: () => fetchPainel() });
  const [nova, setNova] = useState({ palavra: "", fluxo: "noticias", media_id: "" });

  if (q.isLoading) return <Carregando texto="Carregando o Direct..." />;
  if (q.error) return <Erro erro={q.error} />;
  const { conversas, eventos, palavras, resumo } = q.data!;
  const porFluxo = palavras.reduce<Record<string, PalavraDirect[]>>((acc, p) => {
    (acc[p.fluxo] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <CabecalhoPagina
        titulo="Direct · mini chat da Renata"
        descricao="Quem comenta uma palavra-chave, responde a um story ou escreve no Direct da @ianews.co recebe a conversa automática, deixa um contato e entra no CRM no funil certo. Perguntas soltas e quem já está em negociação vão para a Renata."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Numero rotulo="Conversas" valor={resumo.conversas} detalhe="pessoas que falaram com o robô" destaque="azul" />
        <Numero rotulo="Eventos em 7 dias" valor={resumo.semana} detalhe="comentários e mensagens" />
        <Numero rotulo="Com contato" valor={resumo.com_contato} detalhe="deixaram e-mail ou WhatsApp" />
        <Numero rotulo="Com a Renata" valor={resumo.humano} detalhe="robô em pausa por 24 h" />
        <Numero rotulo="Erros em 7 dias" valor={resumo.erros} detalhe="envios que falharam" />
      </div>

      <Secao titulo="Conversas" contagem={conversas.length}>
        {conversas.length === 0 ? (
          <Vazio>Nenhuma conversa ainda. Elas aparecem aqui quando alguém comentar uma palavra-chave ou escrever no Direct.</Vazio>
        ) : (
          <ul className="divide-y">
            {conversas.map((c) => {
              const humano = c.humano_ate && Date.parse(c.humano_ate) > Date.now();
              const d = c.dados;
              return (
                <li key={c.igsid} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {c.nome ?? (c.username ? `@${c.username}` : "Contato do Instagram")}
                      {c.username && c.nome ? <span className="font-normal text-muted-foreground"> · @{c.username}</span> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {humano ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-amber-900">com a Renata</span>
                      ) : c.passo ? (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
                          {NOME_FLUXO[c.fluxo ?? ""] ?? c.fluxo} · aguardando resposta
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-1.5 py-0.5">{NOME_FLUXO[c.fluxo ?? ""] ?? "concluída"}</span>
                      )}{" "}
                      {c.pontos} pontos · {[d.email, d.whatsapp, d.setor].filter(Boolean).join(" · ") || "sem contato ainda"}
                      {c.optout ? " · pediu para sair" : ""}
                      {c.segue === false ? " · não segue" : ""}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">{fmtDataHora(c.updated_at)}</span>
                  {c.username ? (
                    <a className="text-xs text-primary underline" href={`https://instagram.com/${c.username}`} target="_blank" rel="noopener noreferrer">
                      perfil <ExternalLink className="inline h-3 w-3" />
                    </a>
                  ) : null}
                  {humano ? (
                    <Button variant="outline" size="sm" disabled={ocupado} onClick={() => executar(() => liberar({ data: { igsid: c.igsid } }), "O robô volta a responder essa pessoa.")}>
                      <UserCheck className="h-4 w-4" /> Atendimento concluído
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      <Secao titulo="Palavras-chave" contagem={palavras.filter((p) => p.ativo).length}>
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(porFluxo).map(([fluxo, lista]) => (
            <div key={fluxo} className="rounded-lg border p-3">
              <p className="text-sm font-semibold">{NOME_FLUXO[fluxo] ?? fluxo}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {lista.map((p) => (
                  <button
                    key={p.palavra}
                    type="button"
                    disabled={!isAdmin || ocupado}
                    title={isAdmin ? (p.ativo ? "Clique para desligar" : "Clique para ligar") : undefined}
                    onClick={() => executar(() => salvar({ data: { ...p, ativo: !p.ativo } }), p.ativo ? `${p.palavra} desligada.` : `${p.palavra} ligada.`)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 font-mono text-xs",
                      p.ativo ? "border-primary/40 bg-primary/10 text-primary" : "text-muted-foreground line-through",
                    )}
                  >
                    {p.palavra}
                    {p.media_id ? <span className="ml-1 text-[10px] opacity-70">só no post {p.media_id.slice(-6)}</span> : null}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {isAdmin ? (
          <div className="mt-4 flex flex-wrap items-end gap-2">
            <Input className="h-9 w-40" placeholder="Nova palavra" value={nova.palavra} onChange={(e) => setNova({ ...nova, palavra: e.target.value })} />
            <select className="h-9 rounded-md border bg-background px-2 text-sm" value={nova.fluxo} onChange={(e) => setNova({ ...nova, fluxo: e.target.value })}>
              {FLUXOS.map((f) => (
                <option key={f} value={f}>
                  {NOME_FLUXO[f]}
                </option>
              ))}
            </select>
            <Input className="h-9 w-56" placeholder="ID do post (opcional)" value={nova.media_id} onChange={(e) => setNova({ ...nova, media_id: e.target.value })} />
            <Button
              variant="outline"
              disabled={ocupado || !nova.palavra.trim()}
              onClick={() =>
                executar(
                  () => salvar({ data: { palavra: nova.palavra, fluxo: nova.fluxo, media_id: nova.media_id || null } }),
                  "Palavra salva. Já vale para os próximos comentários e mensagens.",
                ).then(() => setNova({ palavra: "", fluxo: nova.fluxo, media_id: "" }))
              }
            >
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">
          Em comentários, a palavra vale em qualquer posição. No Direct, só quando é a mensagem inteira (ou até 3 palavras). Com o ID do post, a palavra vale só naquele post.
        </p>
      </Secao>

      <Secao titulo="Registro" contagem={eventos.length}>
        {eventos.length === 0 ? (
          <Vazio>Sem eventos ainda.</Vazio>
        ) : (
          <ul className="divide-y text-sm">
            {eventos.map((e) => (
              <li key={e.id} className={cn("flex flex-wrap gap-3 py-2", e.erro && "text-destructive")}>
                <span className="w-32 shrink-0 text-xs text-muted-foreground">{fmtDataHora(e.created_at)}</span>
                <span className="w-24 shrink-0 text-xs">{e.tipo}</span>
                <span className="min-w-0 flex-1 truncate">{e.texto}</span>
                <span className="text-xs text-muted-foreground">{e.erro ?? `${NOME_FLUXO[e.fluxo ?? ""] ?? e.fluxo ?? ""} ${e.resultado ?? ""}`}</span>
              </li>
            ))}
          </ul>
        )}
      </Secao>
    </div>
  );
}
