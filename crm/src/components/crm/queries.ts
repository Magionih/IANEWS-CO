import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { listModelos } from "@/lib/crm/atividades.functions";
import { listEmpresas } from "@/lib/crm/empresas.functions";
import { listPessoas } from "@/lib/crm/pessoas.functions";

import { useCrm } from "./context";

/* Consultas usadas em várias telas (cache compartilhado do react-query) e um ajudante para ações. */

export function useEmpresas(enabled = true) {
  const fn = useServerFn(listEmpresas);
  return useQuery({
    queryKey: ["crm", "empresas"],
    queryFn: () => fn(),
    enabled,
    staleTime: 30_000,
  });
}

export function usePessoas(enabled = true) {
  const fn = useServerFn(listPessoas);
  return useQuery({
    queryKey: ["crm", "pessoas"],
    queryFn: () => fn(),
    enabled,
    staleTime: 30_000,
  });
}

export function useModelos() {
  const fn = useServerFn(listModelos);
  return useQuery({ queryKey: ["crm", "modelos"], queryFn: () => fn(), staleTime: 60_000 });
}

/** Executa uma ação, mostra o aviso e recarrega as telas do CRM. */
export function useAcao() {
  const { atualizar } = useCrm();
  const [ocupado, setOcupado] = useState(false);
  async function executar<T>(
    acao: () => Promise<T>,
    sucesso?: string | ((r: T) => string | null),
  ): Promise<T | null> {
    setOcupado(true);
    try {
      const r = await acao();
      const msg = typeof sucesso === "function" ? sucesso(r) : sucesso;
      if (msg) toast.success(msg);
      await atualizar();
      return r;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível concluir.");
      return null;
    } finally {
      setOcupado(false);
    }
  }
  return { executar, ocupado };
}
