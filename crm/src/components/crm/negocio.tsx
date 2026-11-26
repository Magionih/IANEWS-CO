import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Clock3,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { EditorTags, TagsDoNegocio } from "./tags";
import { LinhaDoTempo } from "./timeline";
import { Avatar, Campo, Carregando, Erro, Etiqueta, GrupoBadge, Secao, Vazio } from "./ui";

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

/** "3h", "2d", "5min": tempo desde a última movimentação, como no cartão do quadro. */
export function haQuanto(iso?: string | null) {
  if (!iso) return "—";
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min}min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return d < 60 ? `${d}d` : `${Math.round(d / 30)}m`;
}

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
  const wpp = n.pessoa_whatsapp ? `https://wa.me/${n.pessoa_whatsapp.replace(/\D/g, "")}` : null;
  const nome = n.empresa_nome ?? n.titulo;
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={arrastavel}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/negocio", n.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onAbrir}
      onKeyDown={(e) => (e.key === "Enter" ? onAbrir() : undefined)}
      className={cn(
        "group relative w-full shrink-0 rounded-xl border border-transparent bg-card p-3 text-left shadow-[0_1px_2px_rgb(16_24_40/0.06)] outline-none transition hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/40",
        arrastavel && "cursor-grab active:cursor-grabbing",
      )}
    >
      {/* Tags no topo */}
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <TagsDoNegocio ids={n.tags} compacto />
          <p className="mt-1 line-clamp-1 text-[14px] font-semibold leading-snug">{nome}</p>
          {n.pessoa_nome || (n.empresa_nome && n.titulo !== n.empresa_nome) ? (
            <p className="line-clamp-1 text-[12px] text-muted-foreground">
              {[n.pessoa_nome, n.empresa_nome && n.titulo !== n.empresa_nome ? n.titulo : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
        <GrupoBadge grupo={n.empresa_grupo} />
      </div>

      {/* Próxima ação, no lugar da prévia da conversa */}
      <div
        className={cn(
          "mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px]",
          vermelho
            ? "bg-destructive/[0.07] text-destructive"
            : "bg-[#f3f5f9] text-muted-foreground",
        )}
        title={n.proxima_acao ?? undefined}
      >
        <CalendarClock className="h-3.5 w-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{n.proxima_acao ?? "Sem próxima ação"}</span>
        <span className="shrink-0 font-medium">
          {n.proxima_acao_em ? prazoRelativo(n.proxima_acao_em) : ""}
        </span>
      </div>

      {/* Rodapé: dono, atalhos, valor e tempo */}
      <div className="mt-2.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <Avatar nome={membro(n.dono_id)} />
        {wpp ? (
          <a
            href={wpp}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Abrir WhatsApp"
            className="rounded p-0.5 hover:bg-muted hover:text-emerald-600"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </a>
        ) : null}
        <span
          className={cn(
            "tabular font-medium",
            n.status_pagamento === "pago" ? "text-emerald-600" : "text-foreground/80",
          )}
          title={PAGAMENTO_LABEL[n.status_pagamento]}
        >
          {n.status_pagamento === "cortesia" ? "Cortesia" : fmtMoeda(n.valor ?? 0)}
        </span>
        <span className="ml-auto flex items-center gap-1" title="Última movimentação">
          <Clock3 className="h-3 w-3" />
          {haQuanto(n.ultima_atividade_em ?? n.etapa_desde)}
        </span>
      </div>
    </div>
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

  const caminho = etapas.filter((e) => e.tipo !== "perdida" && e.ordem < 90);
  const atual = n ? etapas.find((e) => e.id === n.etapa_id) : undefined;
  const perdida = etapas.find((e) => e.tipo === "perdida");
  const idxAtual = n ? caminho.findIndex((e) => e.id === n.etapa_id) : -1;
  const vermelho =
    !!n && n.etapa_tipo === "aberta" && (atrasado(n.proxima_acao_em) || !n.proxima_acao_em);
  const wpp = n?.pessoa_whatsapp ? `https://wa.me/${n.pessoa_whatsapp.replace(/\D/g, "")}` : null;

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-[880px]">
        {isLoading || !n ? (
          <div className="p-6">{error ? <Erro erro={error} /> : <Carregando />}</div>
        ) : (
          <>
            {/* Trilha */}
            <div className="flex items-center gap-1.5 border-b px-5 py-3 pr-12 text-[12.5px] text-muted-foreground">
              <span className="truncate">{funilNome(n.funil_id)}</span>
              <span>›</span>
              <span className="truncate font-semibold text-foreground">{n.titulo}</span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* Cabeçalho */}
              <SheetHeader className="space-y-0 border-b px-5 py-4 text-left">
                <div className="flex items-start gap-3">
                  <Avatar nome={n.empresa_nome ?? n.titulo} className="h-11 w-11 text-[14px]" />
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="flex items-center gap-2 text-[19px] leading-tight">
                      <span className="truncate">{n.empresa_nome ?? n.titulo}</span>
                      <GrupoBadge grupo={n.empresa_grupo} />
                      <button
                        type="button"
                        onClick={() => setEditar(true)}
                        title="Editar negócio"
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </SheetTitle>
                    <SheetDescription asChild>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[13px]">
                        {n.empresa_nome && n.titulo !== n.empresa_nome ? (
                          <span>{n.titulo}</span>
                        ) : null}
                        {n.pessoa_id ? (
                          <Link
                            to="/pessoas/$id"
                            params={{ id: n.pessoa_id }}
                            className="text-primary hover:underline"
                          >
                            {n.pessoa_nome}
                          </Link>
                        ) : null}
                      </div>
                    </SheetDescription>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[12px] font-semibold",
                        n.etapa_tipo === "ganha"
                          ? "bg-emerald-100 text-emerald-700"
                          : n.etapa_tipo === "perdida"
                            ? "bg-slate-200 text-slate-700"
                            : "bg-primary/10 text-primary",
                      )}
                    >
                      {n.etapa_tipo === "ganha"
                        ? "Ganho"
                        : n.etapa_tipo === "perdida"
                          ? "Perdido"
                          : "Em aberto"}
                    </span>
                    <span title={`Dono: ${membro(n.dono_id)}`}>
                      <Avatar nome={membro(n.dono_id)} />
                    </span>
                  </div>
                </div>

                {/* Atalhos */}
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  <Atalho titulo="Enviar mensagem" onClick={() => setMensagem(true)}>
                    <MessageCircle className="h-4 w-4" />
                  </Atalho>
                  {wpp ? (
                    <a
                      href={wpp}
                      target="_blank"
                      rel="noreferrer"
                      title="Abrir WhatsApp"
                      className="flex h-8 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-emerald-700 hover:bg-emerald-50"
                    >
                      WhatsApp
                    </a>
                  ) : null}
                  <Atalho titulo="Registrar atividade" onClick={() => setAtividade(true)}>
                    <NotebookPen className="h-4 w-4" />
                  </Atalho>
                  <Atalho titulo="Nova tarefa" onClick={() => setTarefa(true)}>
                    <CalendarClock className="h-4 w-4" />
                  </Atalho>
                  <Atalho titulo="Editar" onClick={() => setEditar(true)}>
                    <Pencil className="h-4 w-4" />
                  </Atalho>
                  <span className="mx-1 h-5 w-px bg-border" />
                  <div className="min-w-0 flex-1">
                    <EditorTags negocioId={n.id} ids={n.tags} />
                  </div>
                </div>
              </SheetHeader>

              {/* Etapas */}
              <div className="border-b px-5 py-4">
                <ol className="flex items-start overflow-x-auto pb-1">
                  {caminho.map((e, i) => {
                    const feito = idxAtual >= 0 && i < idxAtual;
                    const agora = e.id === n.etapa_id;
                    return (
                      <li key={e.id} className="flex min-w-[96px] flex-1 flex-col items-center">
                        <div className="flex w-full items-center">
                          <span
                            className={cn(
                              "h-[2px] flex-1",
                              i === 0
                                ? "bg-transparent"
                                : feito || agora
                                  ? "bg-primary"
                                  : "bg-border",
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => moverPara(n, e.id)}
                            title={`Mover para ${e.nome}`}
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition",
                              feito && "border-primary bg-primary text-white",
                              agora &&
                                "border-primary bg-primary text-white ring-4 ring-primary/15",
                              !feito &&
                                !agora &&
                                "border-border bg-card text-muted-foreground hover:border-primary/60",
                            )}
                          >
                            {feito ? <Check className="h-3.5 w-3.5" /> : i + 1}
                          </button>
                          <span
                            className={cn(
                              "h-[2px] flex-1",
                              i === caminho.length - 1
                                ? "bg-transparent"
                                : feito
                                  ? "bg-primary"
                                  : "bg-border",
                            )}
                          />
                        </div>
                        <span
                          className={cn(
                            "mt-1.5 px-1 text-center text-[11.5px] leading-tight",
                            agora ? "font-semibold text-primary" : "text-muted-foreground",
                          )}
                        >
                          {e.nome}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                {atual && idxAtual < 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Etapa atual: <b className="text-foreground">{atual.nome}</b>
                  </p>
                ) : null}
                {perdida && n.etapa_tipo !== "perdida" ? (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => moverPara(n, perdida.id)}
                      className="text-xs font-semibold text-destructive hover:underline"
                    >
                      Marcar como perdido
                    </button>
                  </div>
                ) : null}
              </div>

              {/* Abas */}
              <Tabs defaultValue="atividades" className="px-5 py-4">
                <TabsList className="mb-4 h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0">
                  {[
                    ["atividades", "Atividades"],
                    ["negocio", "Negócio"],
                    ["contato", "Contato e empresa"],
                    ["historico", "Histórico"],
                  ].map(([v, r]) => (
                    <TabsTrigger
                      key={v}
                      value={v}
                      className="rounded-none border-b-2 border-transparent px-3 pb-2.5 pt-1 text-[13px] data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none"
                    >
                      {r}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="atividades" className="space-y-4">
                  <div
                    className={cn(
                      "rounded-xl border p-4",
                      vermelho && "border-destructive/40 bg-destructive/[0.04]",
                    )}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Próxima ação
                    </p>
                    <p className="mt-1 text-[15px] font-semibold">
                      {n.proxima_acao ?? "Sem próxima ação definida"}
                    </p>
                    <p
                      className={cn(
                        "text-[13px]",
                        vermelho ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {n.proxima_acao_em
                        ? `${fmtDia(n.proxima_acao_em)} · ${prazoRelativo(n.proxima_acao_em)}`
                        : "Defina uma data em Editar."}
                    </p>
                  </div>
                  <Secao
                    titulo="Tarefas abertas"
                    contagem={tarefasAbertas.length}
                    acoes={
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => setTarefa(true)}
                      >
                        <Plus className="h-4 w-4" /> Nova tarefa
                      </Button>
                    }
                  >
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
                                className={cn(
                                  atrasado(t.vence_em) && "font-semibold text-destructive",
                                )}
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
                </TabsContent>

                <TabsContent value="negocio">
                  <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    <Dado rotulo="Valor">{fmtMoeda(n.valor)}</Dado>
                    <Dado rotulo="Pagamento">{PAGAMENTO_LABEL[n.status_pagamento]}</Dado>
                    <Dado rotulo="Tipo">{labelDe(TIPOS_NEGOCIO, n.tipo)}</Dado>
                    <Dado rotulo="Origem">
                      {labelDe(ORIGENS, n.origem)}
                      {n.canal_origem ? ` · ${n.canal_origem}` : ""}
                    </Dado>
                    <Dado rotulo="Dono">{membro(n.dono_id)}</Dado>
                    <Dado rotulo="Na etapa desde">{fmtDia(n.etapa_desde)}</Dado>
                    <Dado rotulo="Etapa">
                      <Select value={n.etapa_id} onValueChange={(v) => moverPara(n, v)}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {etapas.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.nome}
                              {e.acao_padrao ? ` — ${e.acao_padrao}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Dado>
                    {n.article_slug ? (
                      <Dado rotulo="Matéria">
                        <a
                          href={linkMateria(n.article_slug)!}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {n.article_title}
                        </a>
                      </Dado>
                    ) : null}
                    {n.motivo_perda ? <Dado rotulo="Motivo da perda">{n.motivo_perda}</Dado> : null}
                  </dl>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => setEditar(true)}
                  >
                    <Pencil className="h-4 w-4" /> Editar dados do negócio
                  </Button>
                </TabsContent>

                <TabsContent value="contato">
                  <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                    <Dado rotulo="Empresa">
                      {n.empresa_id ? (
                        <Link
                          to="/empresas/$id"
                          params={{ id: n.empresa_id }}
                          className="font-semibold text-primary hover:underline"
                        >
                          {n.empresa_nome}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Dado>
                    <Dado rotulo="Grupo">
                      {n.empresa_grupo ? <GrupoBadge grupo={n.empresa_grupo} /> : "—"}
                    </Dado>
                    <Dado rotulo="Pessoa">
                      {n.pessoa_id ? (
                        <Link
                          to="/pessoas/$id"
                          params={{ id: n.pessoa_id }}
                          className="font-semibold text-primary hover:underline"
                        >
                          {n.pessoa_nome}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Dado>
                    <Dado rotulo="WhatsApp">
                      {wpp ? (
                        <a
                          href={wpp}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {n.pessoa_whatsapp}
                        </a>
                      ) : (
                        "—"
                      )}
                    </Dado>
                    {n.post_url ? (
                      <Dado rotulo="Post">
                        <a
                          href={n.post_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          Abrir post
                        </a>
                      </Dado>
                    ) : null}
                  </dl>
                </TabsContent>

                <TabsContent value="historico">
                  <LinhaDoTempo atividades={data.atividades} />
                </TabsContent>
              </Tabs>
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

function Atalho({
  titulo,
  onClick,
  children,
}: {
  titulo: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-md text-primary transition hover:bg-primary/10"
    >
      {children}
    </button>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
