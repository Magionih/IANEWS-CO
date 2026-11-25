import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";

import { hasStoredSession, loadSupabase } from "@/integrations/supabase/lazy";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Leitor sem login: nada a carregar.
    if (!hasStoredSession()) {
      setLoading(false);
      return;
    }
    let unsub: (() => void) | undefined;
    let alive = true;
    loadSupabase().then((supabase) => {
      if (!alive) return;
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, next) => {
        setSession(next);
        setLoading(false);
      });
      unsub = () => subscription.unsubscribe();
      supabase.auth.getSession().then(({ data }) => {
        if (!alive) return;
        setSession(data.session);
        setLoading(false);
      });
    });
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  const user: User | null = session?.user ?? null;
  return { session, user, loading, isAuthenticated: !!user };
}
