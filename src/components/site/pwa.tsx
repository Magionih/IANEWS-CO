import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { X } from "lucide-react";

import { getPushPublicKey, savePushSubscription } from "@/lib/push.functions";
import { getTrackingSessionId } from "@/lib/cta-tracking";

const DISMISS_KEY = "ianews_push_dismissed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

function bufToBase64Url(buf: ArrayBuffer | null) {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let str = "";
  bytes.forEach((b) => {
    str += String.fromCharCode(b);
  });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Registra o service worker (PWA) e oferece as notificações diárias.
 * A permissão só é pedida depois de um toque explícito do leitor.
 */
export function PwaManager() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const keyFn = useServerFn(getPushPublicKey);
  const saveFn = useServerFn(savePushSubscription);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        if (!("PushManager" in window) || !("Notification" in window)) return;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return;
        if (Notification.permission !== "default") return;
        if (localStorage.getItem(DISMISS_KEY)) return;
        // Só depois da escolha de cookies e de um tempo de leitura, para não empilhar avisos.
        window.setTimeout(() => {
          try {
            if (!localStorage.getItem("ianews-consent-v1")) return;
          } catch {
            return;
          }
          setVisible(true);
        }, 45000);
      } catch (err) {
        console.warn("[pwa] service worker não registrado", err);
      }
    };
    void register();
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setVisible(false);
        localStorage.setItem(DISMISS_KEY, "1");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const { key } = await keyFn({});
      if (!key) throw new Error("Chave de notificação indisponível.");
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource,
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: Record<string, string> };
      await saveFn({
        data: {
          endpoint: json.endpoint ?? sub.endpoint,
          p256dh: json.keys?.["p256dh"] ?? bufToBase64Url(sub.getKey("p256dh")),
          auth: json.keys?.["auth"] ?? bufToBase64Url(sub.getKey("auth")),
          device: window.innerWidth < 768 ? "mobile" : "desktop",
          browser: navigator.userAgent.slice(0, 120),
          visitorHash: getTrackingSessionId(),
        },
      });
      setVisible(false);
    } catch (err) {
      console.warn("[pwa] falha ao ativar notificações", err);
      setVisible(false);
    } finally {
      setBusy(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="push-card" role="dialog" aria-label="Notificações">
      <button
        type="button"
        aria-label="Fechar"
        className="push-x"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setVisible(false);
        }}
      >
        <X className="h-4 w-4" />
      </button>
      <p className="push-t">Receba as matérias do dia</p>
      <p className="push-s">Uma notificação por dia com as principais notícias de IA.</p>
      <button type="button" disabled={busy} onClick={enable} className="btn blue s">
        {busy ? "Ativando..." : "Ativar notificações"}
      </button>
    </div>
  );
}
