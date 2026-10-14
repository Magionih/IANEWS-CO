import { useEffect } from "react";

import { sendEngagement } from "@/lib/cta-tracking";

/** Mede tempo de visualização e profundidade de leitura de qualquer visitante (com ou sem login). */
export function ContentEngagement({
  slug,
  title,
  category,
}: {
  slug: string;
  title: string;
  category: string;
}) {
  useEffect(() => {
    let seconds = 0;
    let maxScroll = 0;
    let lastSent = -1;

    const readScroll = () => {
      const doc = document.documentElement;
      const total = Math.max(1, doc.scrollHeight - window.innerHeight);
      const pct = Math.round((window.scrollY / total) * 100);
      maxScroll = Math.min(100, Math.max(maxScroll, pct));
    };

    const flush = (force = false) => {
      const should = force || seconds === 10 || seconds === 30 || (seconds > 30 && seconds % 60 === 0);
      if (!should || seconds < 5 || seconds === lastSent) return;
      lastSent = seconds;
      sendEngagement({
        slug,
        title,
        category,
        seconds,
        scrollPct: maxScroll,
        completed: maxScroll >= 80,
      });
    };

    const tick = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      seconds += 1;
      flush();
    }, 1000);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush(true);
    };

    readScroll();
    window.addEventListener("scroll", readScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(tick);
      window.removeEventListener("scroll", readScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      flush(true);
    };
  }, [slug, title, category]);

  return null;
}
