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
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-white/10 bg-[color:var(--color-nav)] px-4 py-4 text-white shadow-2xl sm:px-6"
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-3xl text-xs leading-relaxed text-white/75 sm:text-sm">
          Usamos cookies essenciais para o funcionamento do site e, com o seu consentimento,
          cookies de medição para entender o desempenho do conteúdo. Saiba mais na nossa{" "}
          <Link to="/termos" hash="cookies" className="underline hover:text-white">
            Política de Privacidade
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => writeConsent("essential")}
            className="rounded-lg border border-white/25 px-4 py-2 text-sm font-semibold text-white/85 hover:bg-white/10"
          >
            Só essenciais
          </button>
          <button
            type="button"
            onClick={() => writeConsent("all")}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-white"
            style={{ background: "var(--color-lime)" }}
          >
            Aceitar tudo
          </button>
        </div>
      </div>
    </div>
  );
}
