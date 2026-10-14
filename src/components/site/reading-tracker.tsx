import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { recordReading } from "@/lib/reading.functions";

export function ReadingTracker({
  slug,
  title,
  category,
  minutes,
}: {
  slug: string;
  title: string;
  category: string;
  minutes: number;
}) {
  const track = useServerFn(recordReading);
  const seconds = useRef(0);
  const maxScroll = useRef(0);
  const started = useRef(false);
  const lastSent = useRef(-1);

  useEffect(() => {
    seconds.current = 0;
    maxScroll.current = 0;
    started.current = false;
    lastSent.current = -1;

    const device =
      typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop";

    const readScroll = () => {
      const doc = document.documentElement;
      const total = Math.max(1, doc.scrollHeight - window.innerHeight);
      const pct = Math.round((window.scrollY / total) * 100);
      maxScroll.current = Math.min(100, Math.max(maxScroll.current, pct));
    };

    const send = async (force = false) => {
      const s = seconds.current;
      // envia aos 15s, 60s e depois a cada 2 minutos de leitura ativa
      const shouldSend =
        force || s === 15 || s === 60 || (s > 60 && s % 120 === 0);
      if (!shouldSend || s < 10 || s === lastSent.current) return;
      const { data } = await supabase.auth.getSession();
      if (!data.session) return;
      lastSent.current = s;
      try {
        await track({
          data: {
            slug,
            title,
            category,
            minutes,
            seconds: s,
            scrollPct: maxScroll.current,
            completed: maxScroll.current >= 85,
            device,
          },
        });
      } catch (err) {
        console.error("[reading] track failed", err);
      }
    };

    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      seconds.current += 1;
      started.current = true;
      void send();
    }, 1000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") void send(true);
    };

    readScroll();
    window.addEventListener("scroll", readScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(tick);
      window.removeEventListener("scroll", readScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      if (started.current) void send(true);
    };
  }, [slug, title, category, minutes, track]);

  return null;
}