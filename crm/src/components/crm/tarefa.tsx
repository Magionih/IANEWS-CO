import type { ReactNode } from "react";
import { Bot, Building2, Check, KanbanSquare, XCircle } from "lucide-react";

import type { CrmTarefaItem } from "@/lib/crm/types";
import { atrasado, fmtDiaCurto, prazoRelativo } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

import { useCrm } from "./context";
import { Avatar } from "./ui";

/* Linha de tarefa usada em Hoje e em Tarefas: círculo para concluir, título,
   prazo em destaque, empresa e negócio, responsável à direita. */

export function TarefaLinha({
  t,
  hoje,
  onConcluir,
  onAbrir,
  onNegocio,
  onDescartar,
}: {
  t: CrmTarefaItem;
  hoje?: string;
  onConcluir: () => void;
  onAbrir?: () => void;
  onNegocio?: () => void;
  onDescartar?: () => void;
}) {
  const { membro } = useCrm();
  const vencida = !t.feita && atrasado(t.vence_em, hoje);
  const eHoje = !t.feita && !!t.vence_em && t.vence_em === hoje;
  return (
    <li className="group flex items-start gap-3 px-4 py-3 transition hover:bg-[#f8faff] sm:px-5">
      <button
        type="button"
        aria-label={t.feita ? "Reabrir tarefa" : "Concluir tarefa"}
        onClick={onConcluir}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] transition",
          t.feita
            ? "border-primary bg-primary text-white"
            : "border-muted-foreground/40 text-transparent hover:border-primary hover:text-primary",
        )}
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={onAbrir}
          className={cn(
            "text-left text-[14px] font-medium leading-snug hover:text-primary",
            t.feita && "text-muted-foreground line-through",
          )}
        >
          {t.titulo}
        </button>
        {t.descricao ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t.descricao}</p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Pilula tom={vencida ? "alerta" : eHoje ? "azul" : "neutro"}>
            {t.vence_em
              ? `${prazoRelativo(t.vence_em, hoje)} · ${fmtDiaCurto(t.vence_em)}`
              : "Sem data"}
          </Pilula>
          {t.empresa_nome ? (
            <Pilula>
              <Building2 className="h-3 w-3" />
              {t.empresa_nome}
            </Pilula>
          ) : null}
          {t.negocio_titulo && onNegocio ? (
            <button type="button" onClick={onNegocio} className="max-w-full">
              <Pilula tom="link">
                <KanbanSquare className="h-3 w-3" />
                <span className="truncate">{t.negocio_titulo}</span>
              </Pilula>
            </button>
          ) : null}
          {t.automatica ? (
            <span title="Criada pela cadência" className="text-muted-foreground">
              <Bot className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onDescartar && !t.feita ? (
          <button
            type="button"
            title="Descartar tarefa (não apaga, só tira da lista)"
            aria-label="Descartar tarefa"
            onClick={onDescartar}
            className="rounded-md p-1 text-muted-foreground/60 transition hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
          >
            <XCircle className="h-4 w-4" />
          </button>
        ) : null}
        <Avatar nome={membro(t.responsavel_id)} />
      </div>
    </li>
  );
}

function Pilula({
  children,
  tom = "neutro",
}: {
  children: ReactNode;
  tom?: "neutro" | "alerta" | "azul" | "link";
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium",
        tom === "neutro" && "bg-muted text-muted-foreground",
        tom === "alerta" && "bg-destructive/[0.08] text-destructive",
        tom === "azul" && "bg-primary/[0.08] text-primary",
        tom === "link" && "text-primary hover:bg-primary/[0.06]",
      )}
    >
      {children}
    </span>
  );
}
