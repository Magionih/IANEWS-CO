import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  MessageCircle,
  NotebookPen,
  Pencil,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { NegocioCompleto } from "@/lib/crm/carregar";
import {
  getNegocio,
  moverNegocio,
  saveNegocio,
  type NegocioInput,
} from "@/lib/crm/negocios.functions";
import { concluirTarefa } from "@/lib/crm/tarefas.functions";
import type { CrmFunilId, CrmStatusPagamento } from "@/lib/crm/types";
import {
  atrasado,
  CANAIS,
  fmtDia,
  fmtMoeda,
  labelDe,
  linkMateria,
  ORIGENS,
  PAGAMENTO_LABEL,
  prazoRelativo,
  sugestaoTipoNegocio,
  TIPOS_NEGOCIO,
} from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

import { useCrm } from "./context";
import { AtividadeDialog, MensagemDialog, TarefaDialog } from "./dialogs";
import { EmpresaPicker, MembroSelect, PessoaPicker } from "./pickers";
import { useAcao, useEmpresas } from "./queries";
import { LinhaDoTempo } from "./timeline";
import { Campo, Carregando, Erro, Etiqueta, GrupoBadge, Secao, Vazio } from "./ui";

/* Negócio: formulário, painel de detalhe e mudança de etapa (com motivo quando é perda). */

// ---------------- Mudar etapa ----------------

export function useMoverEtapa() {
  const { etapa } = useCrm();
  const mover = useServerFn(moverNegocio);
  const { executar } = useAcao();
  const [pendente, setPendente] = useState<{ id: string; etapa_id: string; titulo: string } | null>(
    null,
  );

  async function moverPara(
    n: Pick<NegocioCompleto, "id" | "titulo" | "etapa_id">,
    etapaId: string,
  ) {
    if (n.etapa_id === etapaId) return;
    const destino = etapa(etapaId);
    if (destino?.tipo === "perdida") {
      setPendente({ id: n.id, etapa_id: etapaId, titulo: n.titulo });
      return;
    }
    await executar(
      () => mover({ data: { id: n.id, etapa_id: etapaId } }),
      `Movido para "${destino?.nome ?? "etapa"}".`,
    );
  }

  const dialogo = (
    <MotivoPerdaDialog
      aberto={!!pendente}
      titulo={pendente?.titulo ?? ""}
      onClose={() => setPendente(null)}
      onConfirmar={async (motivo) => {
        if (!pendente) return;
        const ok = await executar(
          () =>
            mover({ data: { id: pendente.id, etapa_id: pendente.etapa_id, motivo_perda: motivo } }),
          "Negócio marcado como perdido.",
        );
        if (ok) setPendente(null);
      }}
    />
  );
  return { moverPara, dialogo };
}

const MOTIVOS_RAPIDOS = [
  "Sem orçamento",
  "Sem interesse",
  "Não respondeu",
  "Preço",
  "Fora do perfil",
  "Já fechou com outro",
];

function MotivoPerdaDialog({
  aberto,
  titulo,
  onClose,
  onConfirmar,
}: {
  aberto: boolean;
  titulo: string;
  onClose: () => void;
  onConfirmar: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (aberto) setMotivo("");
  }, [aberto]);
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Por que perdemos?</DialogTitle>
          <DialogDescription>{titulo}. O motivo entra nos relatórios.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {MOTIVOS_RAPIDOS.map((m) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={motivo === m ? "default" : "outline"}
              onClick={() => setMotivo(m)}
            >
              {m}
            </Button>
          ))}
        </div>
        <Textarea
          rows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo da perda"
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            disabled={!motivo.trim() || enviando}
            onClick={async () => {
              setEnviando(true);
              await onConfirmar(motivo.trim());
              setEnviando(false);
            }}
          >
            {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Marcar como
            perdido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Formulário ----------------

export type NovoNegocio = Partial<NegocioInput> & { funil_id?: CrmFunilId };

export function NegocioDialog({
  aberto,
  onClose,
  negocio,
  inicial,
  onSalvo,
}: {
  aberto: boolean;
  onClose: () => void;
  negocio?: NegocioCompleto | null;
  inicial?: NovoNegocio;
  onSalvo?: (id: string) => void;
}) {
  const { etapasDo, funis, userId } = useCrm();
  const salvar = useServerFn(saveNegocio);
  const { executar, ocupado } = useAcao();
  const { data: empresas } = useEmpresas(aberto);
  const [f, setF] = useState<NegocioInput>({});

  useEffect(() => {
    if (!aberto) return;
    if (negocio) {
      setF({
        id: negocio.id,
        titulo: negocio.titulo,
        funil_id: negocio.funil_id,
        etapa_id: negocio.etapa_id,
        empresa_id: negocio.empresa_id,
        pessoa_id: negocio.pessoa_id,
        tipo: negocio.tipo,
        valor: negocio.valor ?? "",
        status_pagamento: negocio.status_pagamento,
        origem: negocio.origem,
        canal_origem: negocio.canal_origem,
        dono_id: negocio.dono_id,
        proxima_acao: negocio.proxima_acao ?? "",
        proxima_acao_em: negocio.proxima_acao_em ?? "",
      });
    } else {
      const funil = inicial?.funil_id ?? "materia";
      setF({
        titulo: "",
        funil_id: funil,
        etapa_id: etapasDo(funil)[0]?.id ?? null,
        status_pagamento: "pendente",
        origem: "prospeccao",
        canal_origem: "instagram",
        dono_id: userId,
        ...inicial,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reinicia ao abrir
  }, [aberto, negocio?.id]);

  const set = <K extends keyof NegocioInput>(k: K, v: NegocioInput[K]) =>
    setF((x) => ({ ...x, [k]: v }));
  const etapas = etapasDo((f.funil_id ?? "materia") as CrmFunilId);
  const empresa = empresas?.find((e) => e.id === f.empresa_id);
  const sugestao =
    f.funil_id === "materia" ? sugestaoTipoNegocio(empresa?.seguidores_instagram) : null;
  const tipos = TIPOS_NEGOCIO.filter((t) => !t.funil || t.funil === f.funil_id);

  async function enviar() {
    const payload: NegocioInput = { ...f };
    if (!payload.titulo?.trim()) payload.titulo = empresa ? `${empresa.nome}` : "";
    if (negocio) {
      // A etapa muda pelo kanban ou pelo seletor do painel (registra o histórico).
      delete payload.etapa_id;
      delete payload.funil_id;
    }
    const r = await executar(
      () => salvar({ data: payload }),
      negocio ? "Negócio atualizado." : "Negócio criado.",
    );
    if (r) {
      onSalvo?.(r.id);
      onClose();
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{negocio ? "Editar negócio" : "Novo negócio"}</DialogTitle>
          <DialogDescription>
            Cada negócio tem empresa, pessoa, etapa, dono e próxima ação com data.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Empresa">
            <EmpresaPicker valor={f.empresa_id ?? null} onChange={(v) => set("empresa_id", v)} />
          </Campo>
          <Campo rotulo="Pessoa">
            <PessoaPicker
              valor={f.pessoa_id ?? null}
              empresaId={f.empresa_id}
              onChange={(v) => set("pessoa_id", v)}
            />
          </Campo>
          <Campo
            rotulo="Título"
            className="sm:col-span-2"
            dica="Se ficar vazio, usa o nome da empresa."
          >
            <Input
              value={f.titulo ?? ""}
              onChange={(e) => set("titulo", e.target.value)}
              placeholder="Destaque · Empresa"
            />
          </Campo>
          {!negocio ? (
            <>
              <Campo rotulo="Funil">
                <Select
                  value={f.funil_id}
                  onValueChange={(v) =>
                    setF((x) => ({
                      ...x,
                      funil_id: v as CrmFunilId,
                      etapa_id: etapasDo(v as CrmFunilId)[0]?.id ?? null,
                      tipo: null,
                    }))
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {funis.map((fu) => (
                      <SelectItem key={fu.id} value={fu.id}>
                        {fu.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo rotulo="Etapa">
                <Select value={f.etapa_id ?? undefined} onValueChange={(v) => set("etapa_id", v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {etapas
                      .filter((e) => e.tipo !== "perdida")
                      .map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.ordem < 90 ? `${e.ordem}. ` : ""}
                          {e.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Campo>
            </>
          ) : null}
          <Campo
            rotulo="Tipo do negócio"
            dica={
              sugestao ? (
                <button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => set("tipo", sugestao.tipo)}
                >
                  Sugestão: {labelDe(TIPOS_NEGOCIO, sugestao.tipo)} ({sugestao.motivo}). A decisão
                  final é do admin.
                </button>
              ) : undefined
            }
          >
            <Select
              value={f.tipo ?? "nenhum"}
              onValueChange={(v) => set("tipo", v === "nenhum" ? null : v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">A definir</SelectItem>
                {tipos.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo
            rotulo="Valor (R$)"
            dica="No funil Matéria, o valor só vai para o lead na 3ª mensagem."
          >
            <Input
              inputMode="decimal"
              value={f.valor ?? ""}
              onChange={(e) => set("valor", e.target.value)}
              placeholder="280,00"
            />
          </Campo>
          <Campo rotulo="Pagamento">
            <Select
              value={f.status_pagamento ?? "pendente"}
              onValueChange={(v) => set("status_pagamento", v as CrmStatusPagamento)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAGAMENTO_LABEL).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Dono">
            <MembroSelect valor={f.dono_id ?? null} onChange={(v) => set("dono_id", v)} />
          </Campo>
          <Campo rotulo="Origem">
            <Select value={f.origem ?? "outro"} onValueChange={(v) => set("origem", v)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ORIGENS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          <Campo rotulo="Canal de origem">
            <Select value={f.canal_origem ?? "site"} onValueChange={(v) => set("canal_origem", v)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[{ value: "instagram", label: "Instagram" }, ...CANAIS].map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Campo>
          {negocio ? (
            <>
              <Campo rotulo="Próxima ação">
                <Input
                  value={f.proxima_acao ?? ""}
                  onChange={(e) => set("proxima_acao", e.target.value)}
                />
              </Campo>
              <Campo rotulo="Data da próxima ação">
                <Input
                  type="date"
                  value={f.proxima_acao_em ?? ""}
                  onChange={(e) => set("proxima_acao_em", e.target.value)}
                />
              </Campo>
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={ocupado || (!f.titulo?.trim() && !empresa)}>
            {ocupado ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Cartão do kanban ----------------

export function NegocioCartao({
  n,
  onAbrir,
  arrastavel,
}: {
  n: NegocioCompleto;
  onAbrir: () => void;
  arrastavel?: boolean;
}) {
  const { membro } = useCrm();
  const vermelho = n.etapa_tipo === "aberta" && (atrasado(n.proxima_acao_em) || !n.proxima_acao_em);
  return (
    <button
      type="button"
      draggable={arrastavel}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/negocio", n.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onAbrir}
      className={cn(
        "w-full rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-primary/60 hover:shadow",
        vermelho && "border-destructive/60 bg-destructive/5",
        arrastavel && "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold">{n.empresa_nome ?? n.titulo}</p>
        <GrupoBadge grupo={n.empresa_grupo} />
      </div>
      {n.empresa_nome && n.titulo !== n.empresa_nome ? (
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{n.titulo}</p>
      ) : null}
      {n.pessoa_nome ? <p className="mt-1 text-xs">{n.pessoa_nome}</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {n.valor ? <Etiqueta tom="azul">{fmtMoeda(n.valor)}</Etiqueta> : null}
        {n.tipo ? <Etiqueta>{labelDe(TIPOS_NEGOCIO, n.tipo)}</Etiqueta> : null}
        {n.status_pagamento !== "pendente" ? (
          <Etiqueta tom={n.status_pagamento === "pago" ? "ok" : "neutro"}>
            {PAGAMENTO_LABEL[n.status_pagamento]}
          </Etiqueta>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-2 flex items-center gap-1 text-[11px]",
          vermelho ? "font-semibold text-destructive" : "text-muted-foreground",
        )}
      >
        <CalendarClock className="h-3 w-3" />
        {n.proxima_acao
          ? `${n.proxima_acao} · ${prazoRelativo(n.proxima_acao_em)}`
          : "Sem próxima ação"}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{membro(n.dono_id)}</p>
    </button>
  );
}

// ---------------- Painel de detalhe ----------------

export function NegocioPainel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { etapasDo, funilNome, membro } = useCrm();
  const fetchNegocio = useServerFn(getNegocio);
  const concluir = useServerFn(concluirTarefa);
  const { executar } = useAcao();
  const { moverPara, dialogo } = useMoverEtapa();
  const [editar, setEditar] = useState(false);
  const [mensagem, setMensagem] = useState(false);
  const [atividade, setAtividade] = useState(false);
  const [tarefa, setTarefa] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["crm", "negocio", id],
    queryFn: () => fetchNegocio({ data: { id: id! } }),
    enabled: !!id,
  });
  const n = data?.negocio;
  const etapas = useMemo(() => (n ? etapasDo(n.funil_id) : []), [n, etapasDo]);
  const tarefasAbertas = data?.tarefas.filter((t) => !t.feita) ?? [];

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {isLoading || !n ? (
          error ? (
            <Erro erro={error} />
          ) : (
            <Carregando />
          )
        ) : (
          <>
            <SheetHeader className="text-left">
              <p className="font-mono-eyebrow text-primary">{funilNome(n.funil_id)}</p>
              <SheetTitle className="text-xl">{n.titulo}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {n.empresa_id ? (
                    <Link
                      to="/empresas/$id"
                      params={{ id: n.empresa_id }}
                      className="font-semibold text-primary hover:underline"
                    >
                      {n.empresa_nome}
                    </Link>
                  ) : null}
                  {n.pessoa_id ? (
                    <Link
                      to="/pessoas/$id"
                      params={{ id: n.pessoa_id }}
                      className="hover:underline"
                    >
                      {n.pessoa_nome}
                    </Link>
                  ) : null}
                  <GrupoBadge grupo={n.empresa_grupo} />
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 grid gap-3">
              <Campo rotulo="Etapa">
                <Select value={n.etapa_id} onValueChange={(v) => moverPara(n, v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {etapas.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.ordem < 90 ? `${e.ordem}. ` : ""}
                        {e.nome}
                        {e.acao_padrao ? ` — ${e.acao_padrao}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>

              <div
                className={cn(
                  "rounded-lg border p-3 text-sm",
                  n.etapa_tipo === "aberta" &&
                    (atrasado(n.proxima_acao_em) || !n.proxima_acao_em) &&
                    "border-destructive/50 bg-destructive/5",
                )}
              >
                <p className="font-mono-eyebrow text-muted-foreground">Próxima ação</p>
                <p className="mt-1 font-semibold">
                  {n.proxima_acao ?? "Sem próxima ação definida"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {n.proxima_acao_em
                    ? `${fmtDia(n.proxima_acao_em)} (${prazoRelativo(n.proxima_acao_em)})`
                    : "Defina uma data em Editar."}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Valor</dt>
                <dd className="font-semibold">{fmtMoeda(n.valor)}</dd>
                <dt className="text-muted-foreground">Pagamento</dt>
                <dd>{PAGAMENTO_LABEL[n.status_pagamento]}</dd>
                <dt className="text-muted-foreground">Tipo</dt>
                <dd>{labelDe(TIPOS_NEGOCIO, n.tipo)}</dd>
                <dt className="text-muted-foreground">Origem</dt>
                <dd>
                  {labelDe(ORIGENS, n.origem)}
                  {n.canal_origem ? ` · ${n.canal_origem}` : ""}
                </dd>
                <dt className="text-muted-foreground">Dono</dt>
                <dd>{membro(n.dono_id)}</dd>
                <dt className="text-muted-foreground">Na etapa desde</dt>
                <dd>{fmtDia(n.etapa_desde)}</dd>
                {n.article_slug ? (
                  <>
                    <dt className="text-muted-foreground">Matéria</dt>
                    <dd className="truncate">
                      <a
                        href={linkMateria(n.article_slug)!}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {n.article_title}
                      </a>
                    </dd>
                  </>
                ) : null}
                {n.motivo_perda ? (
                  <>
                    <dt className="text-muted-foreground">Motivo da perda</dt>
                    <dd>{n.motivo_perda}</dd>
                  </>
                ) : null}
              </dl>

              <div className="grid grid-cols-2 gap-2">
                <Button onClick={() => setMensagem(true)}>
                  <MessageCircle className="mr-2 h-4 w-4" /> Mensagem
                </Button>
                <Button variant="outline" onClick={() => setAtividade(true)}>
                  <NotebookPen className="mr-2 h-4 w-4" /> Registrar
                </Button>
                <Button variant="outline" onClick={() => setTarefa(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Tarefa
                </Button>
                <Button variant="outline" onClick={() => setEditar(true)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar
                </Button>
              </div>

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
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(atrasado(t.vence_em) && "font-semibold text-destructive")}
                          >
                            {t.titulo}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {prazoRelativo(t.vence_em)} · {membro(t.responsavel_id)}
                            {t.automatica ? " · automática" : ""}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Vazio>Nenhuma tarefa aberta.</Vazio>
                )}
              </Secao>

              <Secao titulo="Linha do tempo">
                <LinhaDoTempo atividades={data.atividades} />
              </Secao>
            </div>

            <NegocioDialog aberto={editar} onClose={() => setEditar(false)} negocio={n} />
            <MensagemDialog
              aberto={mensagem}
              onClose={() => setMensagem(false)}
              dados={{
                nome: n.pessoa_nome,
                empresa: n.empresa_nome,
                whatsapp: n.pessoa_whatsapp,
                article_slug: n.article_slug,
                link_post: n.post_url,
                valor: n.valor,
                etapa_id: n.etapa_id,
                negocio_id: n.id,
                empresa_id: n.empresa_id,
                pessoa_id: n.pessoa_id,
              }}
            />
            <AtividadeDialog
              aberto={atividade}
              onClose={() => setAtividade(false)}
              alvo={{ negocio_id: n.id }}
            />
            <TarefaDialog
              aberto={tarefa}
              onClose={() => setTarefa(false)}
              vinculo={{ negocio_id: n.id, empresa_id: n.empresa_id, pessoa_id: n.pessoa_id }}
              tarefa={{ responsavel_id: n.dono_id }}
            />
            {dialogo}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
