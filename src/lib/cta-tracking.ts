export type CtaEvent = "impression" | "click" | "convert";

export function getTrackingSessionId() {
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

/** Contexto de origem do visitante (página, UTM, referrer) usado no funil. */
export function getLeadContext(articleSlug?: string | null) {
  if (typeof window === "undefined") {
    return { path: "/", utmSource: null, utmMedium: null, utmCampaign: null, referrer: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    path: window.location.pathname,
    articleSlug: articleSlug ?? null,
    utmSource: params.get("utm_source"),
    utmMedium: params.get("utm_medium"),
    utmCampaign: params.get("utm_campaign"),
    referrer: document.referrer || null,
  };
}

export function trackCta(input: {
  event: CtaEvent;
  placement: string;
  variant?: string;
  articleSlug?: string | null;
  leadEmail?: string | null;
}) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    ...input,
    variant: input.variant ?? "default",
    path: `${window.location.pathname}${window.location.search}`,
    referrer: document.referrer || null,
    sessionId: getTrackingSessionId(),
    device: window.innerWidth < 768 ? "mobile" : "desktop",
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/public/cta", new Blob([payload], { type: "application/json" }));
      return;
    }
  } catch {
    /* fallback abaixo */
  }
  void fetch("/api/public/cta", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}

export function sendEngagement(input: {
  slug: string;
  title: string;
  category: string;
  seconds: number;
  scrollPct: number;
  completed: boolean;
}) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    ...input,
    sessionId: getTrackingSessionId(),
    device: window.innerWidth < 768 ? "mobile" : "desktop",
    referrer: document.referrer || null,
  });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        "/api/public/engagement",
        new Blob([payload], { type: "application/json" }),
      );
      return;
    }
  } catch {
    /* fallback abaixo */
  }
  void fetch("/api/public/engagement", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}
