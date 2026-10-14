import { useEffect, useRef } from "react";

import { trackCta } from "@/lib/cta-tracking";

/** Dispara um evento de impressão quando o CTA fica visível na tela (uma vez por montagem). */
export function useCtaImpression(placement: string, variant = "default", articleSlug?: string | null) {
  const ref = useRef<HTMLDivElement | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired.current) {
            fired.current = true;
            trackCta({ event: "impression", placement, variant, articleSlug });
            io.disconnect();
          }
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [placement, variant, articleSlug]);

  return ref;
}
