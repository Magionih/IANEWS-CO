import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/* Proteção da sessão no navegador:
   - sai sozinho depois de 4h sem uso (vale para todas as abas abertas);
   - se a sessão acabar (saiu em outra aba, senha trocada, token revogado), limpa os dados
     do CRM da memória e volta para o login. */

const LIMITE_INATIVO_MS = 4 * 60 * 60_000;
const CHAVE = "crm:ultima-atividade";

function lerUltima(): number {
  try {
    return Number(localStorage.getItem(CHAVE)) || Date.now();
  } catch {
    return Date.now();
  }
}

function marcar() {
  try {
    localStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    // Sem localStorage (aba privada): a sessão continua valendo normalmente.
  }
}

export function useSessaoSegura() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    let ultimaMarca = 0;
    const atividade = () => {
      const agora = Date.now();
      if (agora - ultimaMarca > 30_000) {
        ultimaMarca = agora;
        marcar();
      }
    };
    marcar();

    const sair = async () => {
      queryClient.clear();
      await supabase.auth.signOut();
      navigate({ to: "/login", replace: true });
    };

    const verificar = () => {
      if (Date.now() - lerUltima() > LIMITE_INATIVO_MS) void sair();
    };

    const eventos = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    eventos.forEach((e) => window.addEventListener(e, atividade, { passive: true }));
    const timer = window.setInterval(verificar, 60_000);
    const aoVoltar = () => document.visibilityState === "visible" && verificar();
    document.addEventListener("visibilitychange", aoVoltar);

    const { data: sub } = supabase.auth.onAuthStateChange((evento) => {
      if (evento === "SIGNED_OUT") {
        queryClient.clear();
        navigate({ to: "/login", replace: true });
      }
    });

    return () => {
      eventos.forEach((e) => window.removeEventListener(e, atividade));
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltar);
      sub.subscription.unsubscribe();
    };
  }, [navigate, queryClient]);
}
