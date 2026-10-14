import { useEffect, useRef, useState } from "react";
import { Download, Share, Plus, X, Smartphone } from "lucide-react";

import { useConsent } from "@/components/site/consent-banner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "ianews_install_dismissed";
const SNOOZE_KEY = "ianews_install_snooze_until";
/** Se o leitor fechar, só voltamos a convidar depois de 24h. */
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const INTERVAL_MS = 5 * 60 * 1000;

function isSnoozed() {
  try {
    const until = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    return Date.now() < until;
  } catch {
    return false;
  }
}

function isMobileLike() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 900px), (pointer: coarse)").matches;
}


function isStandalone() {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * Convite para instalar o IA News como app (PWA).
 * Só aparece em telas móveis, depois de o leitor decidir sobre cookies,
 * e, se for fechado, fica em silêncio por 24 horas.
 */
export function InstallPwaDialog() {
  const { consent, ready } = useConsent();
  const [open, setOpen] = useState(false);
  const [ios, setIos] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!ready || !consent) return;
    if (isStandalone()) return;
    if (!isMobileLike()) return;
    if (localStorage.getItem(DISMISS_KEY) === "installed") return;

    setIos(isIos());


    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      deferred.current = event as BeforeInstallPromptEvent;
      setCanPrompt(true);
    };
    const onInstalled = () => {
      localStorage.setItem(DISMISS_KEY, "installed");
      setOpen(false);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    const show = () => {
      if (isStandalone()) return;
      if (!isMobileLike()) return;
      if (isSnoozed()) return;
      if (localStorage.getItem(DISMISS_KEY) === "installed") return;
      setOpen(true);
    };

    const first = window.setTimeout(show, 8000);
    const timer = window.setInterval(show, INTERVAL_MS);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [consent, ready]);

  const dismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {
      /* ignora */
    }
  };

  if (!open) return null;

  const install = async () => {
    const evt = deferred.current;
    if (!evt) return;
    try {
      await evt.prompt();
      const choice = await evt.userChoice;
      if (choice.outcome === "accepted") localStorage.setItem(DISMISS_KEY, "installed");
    } catch {
      /* ignora */
    } finally {
      deferred.current = null;
      setCanPrompt(false);
      setOpen(false);
    }
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-md border-2 border-foreground bg-background p-4 shadow-[6px_6px_0_0_var(--color-nav)] sm:bottom-6">
      <button
        type="button"
        aria-label="Fechar"
        onClick={dismiss}
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="text-sm font-extrabold">Instale o IA News no seu celular</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Acesso rápido, tela cheia e as principais notícias de IA em um toque.
          </p>

          {canPrompt ? (
            <button
              type="button"
              onClick={install}
              className="mt-3 inline-flex items-center gap-2 bg-foreground px-3 py-2 text-xs font-bold uppercase tracking-wide text-background"
            >
              <Download className="h-4 w-4" />
              Baixar app
            </button>
          ) : ios ? (
            <ol className="mt-3 space-y-1.5 text-xs text-foreground/80">
              <li className="flex items-center gap-2">
                <span className="font-bold">1.</span>
                <Share className="h-3.5 w-3.5" /> Toque em <strong>Compartilhar</strong> no Safari
              </li>
              <li className="flex items-center gap-2">
                <span className="font-bold">2.</span>
                <Plus className="h-3.5 w-3.5" /> Escolha <strong>Adicionar à Tela de Início</strong>
              </li>
              <li className="flex items-center gap-2">
                <span className="font-bold">3.</span> Confirme em <strong>Adicionar</strong>
              </li>
            </ol>
          ) : (
            <ol className="mt-3 space-y-1.5 text-xs text-foreground/80">
              <li>
                <span className="font-bold">1.</span> Abra o menu <strong>⋮</strong> do navegador
              </li>
              <li>
                <span className="font-bold">2.</span> Toque em{" "}
                <strong>Instalar app / Adicionar à tela inicial</strong>
              </li>
              <li>
                <span className="font-bold">3.</span> Confirme em <strong>Instalar</strong>
              </li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
