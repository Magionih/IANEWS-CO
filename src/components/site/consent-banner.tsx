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
        paddingBlock: "14px calc(14px + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <div
        className="wrap"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px 24px",
        }}
      >
        <p
          className="fine"
          style={{
            flex: "1 1 420px",
            maxWidth: "62em",
            color: "var(--p-ink-2)",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          Usamos cookies essenciais para o funcionamento do site e, com o seu consentimento, cookies
          de medição para entender o desempenho do conteúdo. Saiba mais na nossa{" "}
          <Link to="/termos" hash="cookies">
            Política de Privacidade
          </Link>
          .
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, flex: "0 0 auto" }}>
          <button type="button" className="btn line s" onClick={() => writeConsent("essential")}>
            Só essenciais
          </button>
          <button type="button" className="btn blue s" onClick={() => writeConsent("all")}>
            Aceitar tudo
          </button>
        </div>
      </div>
    </div>
  );
}
