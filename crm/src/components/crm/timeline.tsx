import {
  ArrowRight,
  Bot,
  Mail,
  MessageCircle,
  MessageSquare,
  NotebookPen,
  Phone,
  Receipt,
  Users,
} from "lucide-react";
import type { ComponentType } from "react";

import type { CrmAtividade, CrmAtividadeTipo } from "@/lib/crm/types";
import { ATIVIDADE_LABEL, CANAIS, fmtDataHora, labelDe } from "@/lib/crm/utils";
import { cn } from "@/lib/utils";

import { useCrm } from "./context";
import { Vazio } from "./ui";

/* Linha do tempo: mensagens enviadas e recebidas, ligações, notas e mudanças de etapa. */

const ICONE: Record<CrmAtividadeTipo, ComponentType<{ className?: string }>> = {
  mensagem_enviada: MessageCircle,
  mensagem_recebida: MessageSquare,
  ligacao: Phone,
  reuniao: Users,
  nota: NotebookPen,
  mudanca_etapa: ArrowRight,
  email: Mail,
  proposta: Receipt,
  pagamento: Receipt,
  sistema: Bot,
};

export function LinhaDoTempo({
  atividades,
  limite,
}: {
  atividades: CrmAtividade[];
  limite?: number;
}) {
  const { membro } = useCrm();
  const lista = limite ? atividades.slice(0, limite) : atividades;
  if (!lista.length) return <Vazio>Nenhuma atividade registrada ainda.</Vazio>;
  return (
    <ol className="relative space-y-4 border-l pl-5">
      {lista.map((a) => {
        const Icone = ICONE[a.tipo] ?? NotebookPen;
        const recebida = a.tipo === "mensagem_recebida";
        return (
          <li key={a.id} className="relative">
            <span
              className={cn(
                "absolute -left-[29px] flex h-6 w-6 items-center justify-center rounded-full border bg-card",
                recebida && "border-primary bg-primary text-primary-foreground",
                a.tipo === "mudanca_etapa" && "border-primary/50 text-primary",
              )}
            >
              <Icone className="h-3.5 w-3.5" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {ATIVIDADE_LABEL[a.tipo] ?? a.tipo}
              </span>
              {a.canal ? <span>· {labelDe(CANAIS, a.canal)}</span> : null}
              <span>· {fmtDataHora(a.created_at)}</span>
              <span>· {a.autor_id ? membro(a.autor_id) : "automático"}</span>
            </div>
            {a.texto ? (
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">{a.texto}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
