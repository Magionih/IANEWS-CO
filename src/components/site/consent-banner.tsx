import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";

export type ConsentValue = "all" | "essential";

const KEY = "ianews-consent-v1";

type ConsentListener = (v: ConsentValue | null) => void;
const listeners = new Set<ConsentListener>();

export function readConsent(): ConsentValue | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "all" || v === "essential" ? v : null;
}

function writeConsent(v: ConsentValue) {
  window.localStorage.setItem(KEY, v);
  // Pixel da Meta só envia dados depois do "aceitar todos" (até lá os eventos ficam retidos).
  const fbq = (window as unknown as { fbq?: (...a: unknown[]) => void }).fbq;
  if (typeof fbq === "function") fbq("consent", v === "all" ? "grant" : "revoke");
  listeners.forEach((fn) => fn(v));
}

/** Reactive consent state (null = ainda não decidiu). */
export function useConsent() {
  const [consent, setConsent] = useState<ConsentValue | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setConsent(readConsent());
    setReady(true);
    const fn: ConsentListener = (v) => setConsent(v);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  return { consent, ready };
}

export function openConsentSettings() {
  window.localStorage.removeItem(KEY);
  listeners.forEach((fn) => fn(null));
}

export function ConsentBanner() {
  const { consent, ready } = useConsent();
  if (!ready || consent) return null;

  return (
    <div
      role="dialog"
      aria-label="Preferências de privacidade e cookies"
      style={{
        position: "fixed",
        insetInline: 0,
        bottom: 0,
        zIndex: 60,
        background: "#fff",
        color: "var(--p-ink)",
        borderTop: "1px solid var(--p-rule)",
        boxShadow: "0 -10px 30px rgba(11,14,19,.08)",
        // Compacto: no celular ocupa duas linhas e não cobre o formulário nem o botão de compra.
        paddingBlock: "10px calc(10px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        className="wrap"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px 20px",
        }}
      >
        <p
          className="fine"
          style={{
            flex: "1 1 260px",
            margin: 0,
            color: "var(--p-ink-2)",
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          Usamos cookies essenciais e, se você aceitar, de medição.{" "}
          <Link to="/termos" hash="cookies">
            Saiba mais
          </Link>
        </p>
        <div style={{ display: "flex", gap: 8, flex: "1 0 auto", justifyContent: "flex-end", maxWidth: 320 }}>
          <button type="button" className="btn line s" style={{ flex: 1 }} onClick={() => writeConsent("essential")}>
            Só essenciais
          </button>
          <button type="button" className="btn blue s" style={{ flex: 1 }} onClick={() => writeConsent("all")}>
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
