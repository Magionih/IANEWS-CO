import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { CrmContexto, CrmEtapa, CrmFunilId } from "@/lib/crm/types";

/* Contexto do CRM nas telas: equipe, funis e etapas (carregados uma vez pelo layout). */

type Valor = CrmContexto & {
  etapa: (id?: string | null) => CrmEtapa | undefined;
  etapasDo: (funil: CrmFunilId) => CrmEtapa[];
  funilNome: (id?: string | null) => string;
  membro: (id?: string | null) => string;
  /** Recarrega todas as telas do CRM depois de uma alteração. */
  atualizar: () => Promise<void>;
};

const Ctx = createContext<Valor | null>(null);

export function CrmProvider({ valor, children }: { valor: CrmContexto; children: ReactNode }) {
  const queryClient = useQueryClient();
  const atualizar = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["crm"] }),
    [queryClient],
  );
  const v = useMemo<Valor>(() => {
    const etapas = new Map(valor.etapas.map((e) => [e.id, e]));
    const equipe = new Map(valor.equipe.map((m) => [m.user_id, m]));
    return {
      ...valor,
      etapa: (id) => (id ? etapas.get(id) : undefined),
      etapasDo: (funil) =>
        valor.etapas
          .filter((e) => e.funil_id === funil && e.ativo)
          .sort((a, b) => a.ordem - b.ordem),
      funilNome: (id) => valor.funis.find((f) => f.id === id)?.nome ?? id ?? "—",
      membro: (id) => (id ? (equipe.get(id)?.nome ?? "—") : "Sem responsável"),
      atualizar,
    };
  }, [valor, atualizar]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useCrm() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCrm fora do CrmProvider");
  return v;
}
