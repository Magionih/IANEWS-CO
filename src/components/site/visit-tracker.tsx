import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

function getSessionId() {
  try {
    const key = "ianews_sid";
    let sid = sessionStorage.getItem(key);
    if (!sid) {
      sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(key, sid);
    }
    return sid;
  } catch {
    return "";
  }
}

/** Registra um pageview por navegação, sem bloquear a renderização. */
export function VisitTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.searchStr });
  const last = useRef<string>("");

  useEffect(() => {
    const full = `${pathname}${search ?? ""}`;
    if (!full || last.current === full) return;
    last.current = full;

    const send = async () => {
      let userId: string | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        userId = data.session?.user.id ?? null;
      } catch {
        userId = null;
      }
      try {
        await fetch("/api/public/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: full,
            title: document.title,
            referrer: document.referrer || null,
            sessionId: getSessionId(),
            userId,
          }),
        });
      } catch {
        /* tracking nunca quebra a página */
      }
    };

    const t = window.setTimeout(() => void send(), 700);
    return () => window.clearTimeout(t);
  }, [pathname, search]);

  return null;
}
