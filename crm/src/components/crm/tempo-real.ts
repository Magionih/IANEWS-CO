import { useEffect, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/* Tempo real: o CRM escuta as mudanças do banco (vendas, negócios, tarefas, produção, avisos...)
   e recarrega só a tela aberta, uma vez a cada rajada de mudanças. O Realtime respeita a RLS:
   cada pessoa só recebe o que já pode ler. Ao voltar para o app ou reconectar, também recarrega. */

const TABELAS = [
  "crm_negocios",
  "crm_tarefas",
  "crm_atividades",
  "crm_lancamentos",
  "crm_notificacoes",
  "auto_briefings",
  "auto_lista_diaria",
  "auto_fila",
  "pauta_leads",
  "contact_messages",
  "leads",
  "articles",
];

/** Consultas que não mudam com o movimento do dia (não precisam recarregar). */
const FIXAS = new Set(["contexto", "busca", "push-config"]);

type Estado = { conectado: boolean; ultima: number | null };
let estado: Estado = { conectado: false, ultima: null };
const ouvintes = new Set<() => void>();
const avisar = (novo: Partial<Estado>) => {
  estado = { ...estado, ...novo };
  ouvintes.forEach((f) => f());
};

export function useEstadoTempoReal() {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => estado,
    () => estado,
  );
}

export function useTempoReal() {
  const qc = useQueryClient();
  useEffect(() => {
    let timer: number | undefined;
    const recarregar = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void qc.invalidateQueries({
          queryKey: ["crm"],
          predicate: (q) => !FIXAS.has(String(q.queryKey[1])),
          refetchType: "active",
        });
        avisar({ ultima: Date.now() });
      }, 1200);
    };

    const canal = supabase.channel("crm-tempo-real");
    for (const table of TABELAS) {
      canal.on("postgres_changes", { event: "*", schema: "public", table }, recarregar);
    }
    // Se o tempo real falhar seguidas vezes (ex.: tabela fora da publicação), desliga o canal
    // para não ficar tentando sem parar; a reserva abaixo mantém a tela atualizada.
    let erros = 0;
    let parado = false;
    canal.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        erros = 0;
        avisar({ conectado: true });
        return;
      }
      avisar({ conectado: false });
      if ((status === "CHANNEL_ERROR" || status === "TIMED_OUT") && ++erros >= 3 && !parado) {
        parado = true;
        void supabase.removeChannel(canal);
      }
    });

    // Reserva: sem tempo real, recarrega a tela aberta a cada minuto (só com o app na tela).
    const reserva = window.setInterval(() => {
      if (!estado.conectado && document.visibilityState === "visible") recarregar();
    }, 60_000);

    const aoVoltar = () => {
      if (document.visibilityState === "visible") recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("online", recarregar);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(reserva);
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("online", recarregar);
      void supabase.removeChannel(canal);
      avisar({ conectado: false });
    };
  }, [qc]);
}
