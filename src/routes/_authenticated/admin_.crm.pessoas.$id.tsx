import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ExternalLink,
  Flame,
  MessageCircle,
  NotebookPen,
  Pencil,
  Plus,
} from "lucide-react";

import { useCrm } from "@/components/crm/context";
import {
  AtividadeDialog,
  MensagemDialog,
  PessoaDialog,
  TarefaDialog,
} from "@/components/crm/dialogs";
import { NegocioDialog, NegocioPainel } from "@/components/crm/negocio";
import { LinhaDoTempo } from "@/components/crm/timeline";
import {
  Carregando,
  Erro,
  Etiqueta,
  GrupoBadge,
  LinkExterno,
  Secao,
  Vazio,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { getPessoa } from "@/lib/crm/pessoas.functions";
import {
  atrasado,
  fmtDataHora,
  fmtDia,
  fmtMoeda,
  fmtNum,
  linkInstagram,
  linkLinkedIn,
  linkMateria,
  linkWhatsApp,
  prazoRelativo,
} from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin_/crm/pessoas/$id")({
  component: FichaPessoaPage,
});

function FichaPessoaPage() {
  const { id } = Route.useParams();
  const { membro, funilNome } = useCrm();
  const fetchPessoa = useServerFn(getPessoa);
  const [editar, setEditar] = useState(false);
  const [mensagem, setMensagem] = useState(false);
  const [atividade, setAtividade] = useState(false);
  const [tarefa, setTarefa] = useState(false);
  const [novoNegocio, setNovoNegocio] = useState(false);
  const [negocioAberto, setNegocioAberto] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "pessoa", id],
    queryFn: () => fetchPessoa({ data: { id } }),
  });

  if (isLoading) return <Carregando />;
  if (error || !data) return <Erro erro={error} />;
  const { pessoa: p, empresas, mencoes, negocios, atividades, tarefas, newsletter } = data;
  const principal = empresas.find((e) => e.decisor) ?? empresas[0];
  const negocioAtivo = negocios.find((n) => n.etapa_tipo === "aberta" && n.ativo);
  const ultimaMateria = mencoes.find((m) => m.article)?.article;
  const ultimoPost = mencoes.find((m) => m.conteudo?.url)?.conteudo;
  const tarefasAbertas = tarefas.filter((t) => !t.feita);
  const aquecido =
    !!p.aquecido_em && Date.now() - new Date(p.aquecido_em).getTime() <= 30 * 86_400_000;
  const wa = linkWhatsApp(p.whatsapp);

  return (
    <div className="space-y-5">
      <Link
        to="/admin/crm/pessoas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Pessoas
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{p.nome}</h1>
            {p.consentimento ? (
              <Etiqueta tom="ok">
                consentiu {p.consentimento_em ? `em ${fmtDia(p.consentimento_em)}` : ""}
              </Etiqueta>
            ) : (
              <Etiqueta>sem consentimento</Etiqueta>
            )}
            {newsletter ? (
              <Etiqueta tom="azul">assinante {newsletter.is_active ? "ativo" : "inativo"}</Etiqueta>
            ) : null}
            {aquecido ? (
              <Etiqueta tom="alerta">
                <Flame className="h-3 w-3" /> lead aquecido
              </Etiqueta>
            ) : null}
            {mencoes.length ? (
              <Etiqueta tom="alerta">já apareceu {mencoes.length}x</Etiqueta>
            ) : null}
            {!p.ativo ? <Etiqueta>inativa</Etiqueta> : null}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {empresas.map((e) => (
              <span key={e.id}>
                <Link
                  to="/admin/crm/empresas/$id"
                  params={{ id: e.id }}
                  className="font-semibold text-primary hover:underline"
                >
                  {e.nome}
                </Link>
                <span className="text-muted-foreground">
                  {e.cargo ? ` · ${e.cargo}` : ""}
                  {e.decisor ? " · decisor" : ""}
                </span>{" "}
                <GrupoBadge grupo={e.grupo} />
              </span>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-sm">
            {p.email ? <LinkExterno href={`mailto:${p.email}`}>{p.email}</LinkExterno> : null}
            {p.whatsapp ? <LinkExterno href={wa}>{p.whatsapp}</LinkExterno> : null}
            <LinkExterno href={linkInstagram(p.instagram)}>@{p.instagram}</LinkExterno>
            <LinkExterno href={linkLinkedIn(p.linkedin)}>LinkedIn</LinkExterno>
            {p.seguidores_instagram != null ? (
              <span className="text-muted-foreground">
                {fmtNum(p.seguidores_instagram)} seguidores
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button size="sm" className="h-9" onClick={() => setMensagem(true)}>
            <MessageCircle className="mr-1.5 h-4 w-4" /> Copiar mensagem
          </Button>
          {wa ? (
            <Button size="sm" variant="outline" className="h-9" asChild>
              <a href={wa} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir WhatsApp
              </a>
            </Button>
          ) : null}
          <Button size="sm" variant="outline" className="h-9" onClick={() => setAtividade(true)}>
            <NotebookPen className="mr-1.5 h-4 w-4" /> Registrar conversa
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={() => setNovoNegocio(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Negócio
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={() => setTarefa(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Tarefa
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={() => setEditar(true)}>
            <Pencil className="mr-1.5 h-4 w-4" /> Editar
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <Secao titulo="Dados e LGPD">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Origem</dt>
              <dd>{p.origem ?? "—"}</dd>
              <dt className="text-muted-foreground">Dono</dt>
              <dd>{membro(p.dono_id)}</dd>
              <dt className="text-muted-foreground">Consentimento</dt>
              <dd>
                {p.consentimento ? `sim (${fmtDataHora(p.consentimento_em)})` : "não registrado"}
              </dd>
              <dt className="text-muted-foreground">Newsletter</dt>
              <dd>
                {newsletter
                  ? `${newsletter.is_active ? "ativo" : "inativo"}${newsletter.confirmed_at ? ", confirmado" : ""} · desde ${fmtDia(newsletter.created_at)}`
                  : "não assina"}
              </dd>
              <dt className="text-muted-foreground">Cadastrada</dt>
              <dd>{fmtDia(p.created_at)}</dd>
            </dl>
            {p.notas ? (
              <p className="mt-3 whitespace-pre-wrap border-t pt-3 text-sm">{p.notas}</p>
            ) : null}
          </Secao>

          <Secao titulo="Menções" contagem={mencoes.length}>
            {mencoes.length ? (
              <ul className="space-y-2 text-sm">
                {mencoes.map((m) => (
                  <li key={m.id}>
                    {m.article ? (
                      <a
                        href={linkMateria(m.article.slug)!}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-primary hover:underline"
                      >
                        {m.article.title}
                      </a>
                    ) : (
                      <LinkExterno href={m.conteudo?.url ?? null}>
                        {m.conteudo?.titulo ?? m.conteudo?.canal ?? "post"}
                      </LinkExterno>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {m.papel} ·{" "}
                      {fmtDia(m.article?.published_at ?? m.conteudo?.publicado_em ?? m.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Ainda não apareceu em conteúdo.</Vazio>
            )}
          </Secao>

          <Secao titulo="Tarefas abertas" contagem={tarefasAbertas.length}>
            {tarefasAbertas.length ? (
              <ul className="space-y-1.5 text-sm">
                {tarefasAbertas.map((t) => (
                  <li key={t.id}>
                    <span className={cn(atrasado(t.vence_em) && "font-semibold text-destructive")}>
                      {t.titulo}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {prazoRelativo(t.vence_em)} · {membro(t.responsavel_id)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Nenhuma tarefa aberta.</Vazio>
            )}
          </Secao>
        </div>

        <div className="space-y-5">
          <Secao titulo="Negócios" contagem={negocios.length}>
            {negocios.length ? (
              <ul className="divide-y">
                {negocios.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => setNegocioAberto(n.id)}
                      className="flex w-full items-start justify-between gap-2 py-2 text-left hover:text-primary"
                    >
                      <span>
                        <span className="block text-sm font-semibold">{n.titulo}</span>
                        <span className="block text-xs text-muted-foreground">
                          {funilNome(n.funil_id)} · {n.etapa_nome}
                        </span>
                      </span>
                      {n.valor ? <Etiqueta tom="azul">{fmtMoeda(n.valor)}</Etiqueta> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Nenhum negócio.</Vazio>
            )}
          </Secao>
          <Secao titulo="Linha do tempo" contagem={atividades.length}>
            <LinhaDoTempo atividades={atividades} />
          </Secao>
        </div>
      </div>

      <PessoaDialog aberto={editar} onClose={() => setEditar(false)} pessoa={p} />
      <MensagemDialog
        aberto={mensagem}
        onClose={() => setMensagem(false)}
        dados={{
          nome: p.nome,
          empresa: principal?.nome,
          whatsapp: p.whatsapp,
          article_slug: negocioAtivo?.article_slug ?? ultimaMateria?.slug,
          link_post: negocioAtivo?.post_url ?? ultimoPost?.url,
          valor: negocioAtivo?.valor,
          etapa_id: negocioAtivo?.etapa_id,
          pessoa_id: p.id,
          empresa_id: principal?.id,
          negocio_id: negocioAtivo?.id,
        }}
      />
      <AtividadeDialog
        aberto={atividade}
        onClose={() => setAtividade(false)}
        alvo={{
          pessoa_id: p.id,
          empresa_id: principal?.id ?? null,
          negocio_id: negocioAtivo?.id ?? null,
        }}
        tipoInicial="mensagem_recebida"
      />
      <TarefaDialog
        aberto={tarefa}
        onClose={() => setTarefa(false)}
        vinculo={{ pessoa_id: p.id, empresa_id: principal?.id ?? null }}
      />
      <NegocioDialog
        aberto={novoNegocio}
        onClose={() => setNovoNegocio(false)}
        inicial={{
          pessoa_id: p.id,
          empresa_id: principal?.id ?? null,
          titulo: principal?.nome ?? p.nome,
        }}
        onSalvo={setNegocioAberto}
      />
      <NegocioPainel id={negocioAberto} onClose={() => setNegocioAberto(null)} />
    </div>
  );
}
