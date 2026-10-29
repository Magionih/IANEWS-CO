import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MessageCircle,
  NotebookPen,
  Pencil,
  Plus,
  UserPlus,
} from "lucide-react";

import { useCrm } from "@/components/crm/context";
import {
  AtividadeDialog,
  EmpresaDialog,
  MensagemDialog,
  PessoaDialog,
  TarefaDialog,
  type DadosMensagem,
} from "@/components/crm/dialogs";
import { NegocioDialog, NegocioPainel } from "@/components/crm/negocio";
import { PessoaPicker } from "@/components/crm/pickers";
import { useAcao } from "@/components/crm/queries";
import { LinhaDoTempo } from "@/components/crm/timeline";
import {
  Campo,
  Carregando,
  Erro,
  Etiqueta,
  GrupoBadge,
  LinkExterno,
  Secao,
  Vazio,
} from "@/components/crm/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getEmpresa,
  saveEmpresa,
  vincularPessoa,
  type PessoaNaEmpresaInput,
} from "@/lib/crm/empresas.functions";
import { criarLeadDeEmpresa } from "@/lib/crm/negocios.functions";
import { concluirTarefa } from "@/lib/crm/tarefas.functions";
import {
  atrasado,
  explicarPontuacao,
  fmtDia,
  fmtMoeda,
  fmtNum,
  GRUPO_DESCRICAO,
  labelDe,
  linkInstagram,
  linkLinkedIn,
  linkMateria,
  linkSite,
  linkWhatsApp,
  ORIGENS,
  PORTES,
  prazoRelativo,
} from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_crm/empresas/$id")({
  component: FichaEmpresaPage,
});

function FichaEmpresaPage() {
  const { id } = Route.useParams();
  const { membro, funilNome } = useCrm();
  const fetchEmpresa = useServerFn(getEmpresa);
  const salvar = useServerFn(saveEmpresa);
  const concluir = useServerFn(concluirTarefa);
  const criarLead = useServerFn(criarLeadDeEmpresa);
  const { executar } = useAcao();
  const [editar, setEditar] = useState(false);
  const [novaPessoa, setNovaPessoa] = useState(false);
  const [vincular, setVincular] = useState(false);
  const [novoNegocio, setNovoNegocio] = useState(false);
  const [atividade, setAtividade] = useState(false);
  const [tarefa, setTarefa] = useState(false);
  const [mensagem, setMensagem] = useState<DadosMensagem | null>(null);
  const [negocioAberto, setNegocioAberto] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "empresa", id],
    queryFn: () => fetchEmpresa({ data: { id } }),
  });

  if (isLoading) return <Carregando />;
  if (error || !data) return <Erro erro={error} />;
  const { empresa: e, pessoas, mencoes, negocios, atividades, tarefas } = data;
  const abertos = negocios.filter((n) => n.etapa_tipo === "aberta" && n.ativo);
  const tarefasAbertas = tarefas.filter((t) => !t.feita);
  const decisor = pessoas.find((p) => p.decisor) ?? pessoas[0];
  const ultimaMateria = mencoes.find((m) => m.article)?.article ?? null;
  const ultimoPost = mencoes.find((m) => m.conteudo?.url)?.conteudo ?? null;
  const criterios = explicarPontuacao({
    brasileira: e.brasileira,
    origem: e.origem,
    interagiu: e.interagiu,
    noticia_recente_em: e.noticia_recente_em,
    pessoas,
    mencoes: mencoes.length,
    recebeuMensagem: atividades.some((a) => a.tipo === "mensagem_recebida"),
    collabAceito: mencoes.some((m) => m.conteudo?.collab_aceito),
  });

  return (
    <div className="space-y-5">
      <Link
        to="/empresas"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Empresas
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{e.nome}</h1>
            <GrupoBadge grupo={e.grupo} manual={e.grupo_manual} pontuacao={e.pontuacao} />
            {e.e_cliente ? <Etiqueta tom="ok">cliente</Etiqueta> : null}
            {e.e_anunciante ? <Etiqueta tom="azul">anunciante</Etiqueta> : null}
            {!e.ativo ? <Etiqueta tom="alerta">inativa</Etiqueta> : null}
            {mencoes.length ? (
              <Etiqueta tom="alerta">já apareceu {mencoes.length}x</Etiqueta>
            ) : (
              <Etiqueta>nunca apareceu</Etiqueta>
            )}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {[
              e.setor,
              labelDe(PORTES, e.porte) !== "—" ? labelDe(PORTES, e.porte) : null,
              [e.cidade, e.pais].filter(Boolean).join(", "),
            ]
              .filter(Boolean)
              .join(" · ")}
            <LinkExterno href={linkSite(e.site)}>{e.dominio ?? e.site}</LinkExterno>
            <LinkExterno href={linkInstagram(e.instagram)}>@{e.instagram}</LinkExterno>
            <LinkExterno href={linkLinkedIn(e.linkedin)}>LinkedIn</LinkExterno>
          </p>
          {e.descricao ? <p className="mt-2 max-w-3xl text-sm">{e.descricao}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button size="sm" className="h-9" onClick={() => setNovoNegocio(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Criar negócio
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9"
            onClick={() =>
              setMensagem({
                nome: decisor?.nome,
                empresa: e.nome,
                whatsapp: decisor?.whatsapp,
                article_slug: ultimaMateria?.slug,
                link_post: ultimoPost?.url,
                empresa_id: e.id,
                pessoa_id: decisor?.id,
                negocio_id: abertos[0]?.id,
                etapa_id: abertos[0]?.etapa_id,
              })
            }
          >
            <MessageCircle className="mr-1.5 h-4 w-4" /> Mensagem
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={() => setAtividade(true)}>
            <NotebookPen className="mr-1.5 h-4 w-4" /> Registrar conversa
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={() => setTarefa(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Tarefa
          </Button>
          <Button
            size="sm"
            variant={e.e_cliente ? "secondary" : "outline"}
            className="h-9"
            onClick={() =>
              executar(
                () => salvar({ data: { id: e.id, e_cliente: !e.e_cliente } }),
                e.e_cliente ? "Desmarcada como cliente." : "Marcada como cliente.",
              )
            }
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" />{" "}
            {e.e_cliente ? "É cliente" : "Marcar como cliente"}
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={() => setEditar(true)}>
            <Pencil className="mr-1.5 h-4 w-4" /> Editar
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <Secao titulo={`Pontuação ${e.pontuacao} · grupo ${e.grupo ?? "—"}`}>
            <p className="mb-2 text-xs text-muted-foreground">
              {e.grupo ? GRUPO_DESCRICAO[e.grupo] : ""}
              {e.grupo_manual ? ` · grupo definido à mão: ${e.motivo_grupo ?? ""}` : ""}
            </p>
            <ul className="space-y-1 text-sm">
              {criterios.map((c) => (
                <li
                  key={c.criterio}
                  className={cn(
                    "flex items-center justify-between gap-2",
                    !c.ok && "text-muted-foreground line-through decoration-muted-foreground/40",
                  )}
                >
                  <span>{c.criterio}</span>
                  <span
                    className={cn(
                      "font-semibold",
                      c.ok && (c.pontos > 0 ? "text-primary" : "text-destructive"),
                    )}
                  >
                    {c.pontos > 0 ? `+${c.pontos}` : c.pontos}
                  </span>
                </li>
              ))}
            </ul>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t pt-3 text-xs">
              <dt className="text-muted-foreground">Origem</dt>
              <dd>{labelDe(ORIGENS, e.origem)}</dd>
              <dt className="text-muted-foreground">Dono</dt>
              <dd>{membro(e.dono_id)}</dd>
              <dt className="text-muted-foreground">Seguidores</dt>
              <dd>{e.seguidores_instagram != null ? fmtNum(e.seguidores_instagram) : "—"}</dd>
              <dt className="text-muted-foreground">Cadastrada</dt>
              <dd>{fmtDia(e.created_at)}</dd>
            </dl>
          </Secao>

          <Secao
            titulo="Pessoas"
            contagem={pessoas.length}
            acoes={
              <>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setVincular(true)}>
                  <UserPlus className="mr-1 h-4 w-4" /> Vincular
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => setNovaPessoa(true)}
                >
                  <Plus className="mr-1 h-4 w-4" /> Nova
                </Button>
              </>
            }
          >
            {pessoas.length ? (
              <ul className="divide-y">
                {pessoas.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <Link
                        to="/pessoas/$id"
                        params={{ id: p.id }}
                        className="font-semibold hover:text-primary"
                      >
                        {p.nome}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {p.cargo ?? "cargo não informado"}
                        {p.decisor ? " · decisor" : ""}
                        {p.consentimento ? " · consentiu" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <LinkExterno href={linkWhatsApp(p.whatsapp)}>WhatsApp</LinkExterno>
                      <LinkExterno href={p.email ? `mailto:${p.email}` : null}>E-mail</LinkExterno>
                      <LinkExterno href={linkInstagram(p.instagram)}>Instagram</LinkExterno>
                      <LinkExterno href={linkLinkedIn(p.linkedin)}>LinkedIn</LinkExterno>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Nenhuma pessoa ligada. Cadastre o fundador ou executivo.</Vazio>
            )}
          </Secao>

          <Secao titulo="Menções (matérias e posts)" contagem={mencoes.length}>
            {mencoes.length ? (
              <ul className="space-y-2 text-sm">
                {mencoes.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {m.article ? (
                        <a
                          href={linkMateria(m.article.slug)!}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium text-primary hover:underline"
                        >
                          {m.article.title}
                        </a>
                      ) : m.conteudo ? (
                        <LinkExterno href={m.conteudo.url}>
                          {m.conteudo.titulo ??
                            `${m.conteudo.canal} · ${m.conteudo.formato ?? "post"}`}
                        </LinkExterno>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
                        {m.papel} ·{" "}
                        {fmtDia(
                          m.article?.published_at ?? m.conteudo?.publicado_em ?? m.created_at,
                        )}
                        {m.conteudo?.collab_aceito
                          ? " · collab aceito"
                          : m.conteudo?.collab_aceito === false
                            ? " · collab recusado"
                            : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Ainda não apareceu em conteúdo da IANews.</Vazio>
            )}
            {mencoes.length && !abertos.length ? (
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={async () => {
                  const r = await executar(
                    () => criarLead({ data: { empresa_id: e.id, article_id: ultimaMateria?.id } }),
                    "Lead criado.",
                  );
                  if (r) setNegocioAberto(r.id);
                }}
              >
                Criar lead a partir da matéria
              </Button>
            ) : null}
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
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{n.titulo}</span>
                        <span className="block text-xs text-muted-foreground">
                          {funilNome(n.funil_id)} · {n.etapa_nome} · {membro(n.dono_id)}
                          {n.etapa_tipo === "aberta" && n.proxima_acao
                            ? ` · ${n.proxima_acao} ${prazoRelativo(n.proxima_acao_em)}`
                            : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {n.valor ? <Etiqueta tom="azul">{fmtMoeda(n.valor)}</Etiqueta> : null}
                        {n.etapa_tipo === "ganha" ? (
                          <Etiqueta tom="ok">ganho</Etiqueta>
                        ) : n.etapa_tipo === "perdida" ? (
                          <Etiqueta>perdido</Etiqueta>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Nenhum negócio ainda.</Vazio>
            )}
          </Secao>

          <Secao titulo="Tarefas abertas" contagem={tarefasAbertas.length}>
            {tarefasAbertas.length ? (
              <ul className="space-y-2">
                {tarefasAbertas.map((t) => (
                  <li key={t.id} className="flex items-start gap-2 text-sm">
                    <button
                      type="button"
                      aria-label="Concluir tarefa"
                      className="mt-0.5 text-muted-foreground hover:text-primary"
                      onClick={() =>
                        executar(
                          () => concluir({ data: { id: t.id, feita: true } }),
                          "Tarefa concluída.",
                        )
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <span>
                      <span
                        className={cn(atrasado(t.vence_em) && "font-semibold text-destructive")}
                      >
                        {t.titulo}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {prazoRelativo(t.vence_em)} · {membro(t.responsavel_id)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio>Nenhuma tarefa aberta.</Vazio>
            )}
          </Secao>

          <Secao titulo="Linha do tempo" contagem={atividades.length}>
            <LinhaDoTempo atividades={atividades} />
          </Secao>
        </div>
      </div>

      <EmpresaDialog aberto={editar} onClose={() => setEditar(false)} empresa={e} />
      <PessoaDialog aberto={novaPessoa} onClose={() => setNovaPessoa(false)} empresaId={e.id} />
      <VincularPessoaDialog aberto={vincular} onClose={() => setVincular(false)} empresaId={e.id} />
      <NegocioDialog
        aberto={novoNegocio}
        onClose={() => setNovoNegocio(false)}
        inicial={{
          empresa_id: e.id,
          pessoa_id: decisor?.id ?? null,
          titulo: e.nome,
          article_id: ultimaMateria?.id ?? null,
          origem: e.origem ?? "prospeccao",
        }}
        onSalvo={setNegocioAberto}
      />
      <AtividadeDialog
        aberto={atividade}
        onClose={() => setAtividade(false)}
        alvo={{ empresa_id: e.id, negocio_id: abertos[0]?.id ?? null }}
        tipoInicial="mensagem_recebida"
      />
      <TarefaDialog
        aberto={tarefa}
        onClose={() => setTarefa(false)}
        vinculo={{ empresa_id: e.id }}
      />
      <MensagemDialog
        aberto={!!mensagem}
        onClose={() => setMensagem(null)}
        dados={mensagem ?? {}}
      />
      <NegocioPainel id={negocioAberto} onClose={() => setNegocioAberto(null)} />
    </div>
  );
}

function VincularPessoaDialog({
  aberto,
  onClose,
  empresaId,
}: {
  aberto: boolean;
  onClose: () => void;
  empresaId: string;
}) {
  const vincular = useServerFn(vincularPessoa);
  const { executar, ocupado } = useAcao();
  const [f, setF] = useState<PessoaNaEmpresaInput>({ empresa_id: empresaId });
  const set = <K extends keyof PessoaNaEmpresaInput>(k: K, v: PessoaNaEmpresaInput[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  useEffect(() => {
    if (aberto) setF({ empresa_id: empresaId });
  }, [aberto, empresaId]);

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular pessoa</DialogTitle>
          <DialogDescription>
            Escolha alguém já cadastrado ou digite o nome para criar. Uma pessoa pode estar em mais
            de uma empresa.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Campo rotulo="Pessoa">
            <PessoaPicker
              valor={f.pessoa_id ?? null}
              onChange={(v) => setF((x) => ({ ...x, pessoa_id: v, nome: undefined }))}
              criar={(nome) => setF((x) => ({ ...x, pessoa_id: null, nome }))}
            />
          </Campo>
          {!f.pessoa_id && f.nome ? (
            <div className="grid gap-3 rounded-lg border border-dashed p-3">
              <p className="text-sm font-semibold">Nova pessoa: {f.nome}</p>
              <Input
                placeholder="E-mail"
                value={f.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
              />
              <Input
                placeholder="WhatsApp"
                value={f.whatsapp ?? ""}
                onChange={(e) => set("whatsapp", e.target.value)}
              />
              <Input
                placeholder="Instagram"
                value={f.instagram ?? ""}
                onChange={(e) => set("instagram", e.target.value)}
              />
              <Input
                placeholder="LinkedIn"
                value={f.linkedin ?? ""}
                onChange={(e) => set("linkedin", e.target.value)}
              />
            </div>
          ) : null}
          <Campo rotulo="Cargo">
            <Input
              value={f.cargo ?? ""}
              onChange={(e) => set("cargo", e.target.value)}
              placeholder="CEO e fundador"
            />
          </Campo>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={!!f.decisor} onCheckedChange={(v) => set("decisor", v === true)} /> É
            decisor (fundador ou executivo)
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={ocupado || (!f.pessoa_id && !f.nome)}
            onClick={async () => {
              const r = await executar(() => vincular({ data: f }), "Pessoa vinculada.");
              if (r) onClose();
            }}
          >
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Vincular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
