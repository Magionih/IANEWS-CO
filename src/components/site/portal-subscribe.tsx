import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";

import { PERFIS_LEAD, saveLeadPerfil, subscribeLead } from "@/lib/newsletter.functions";
import { getLeadContext, trackCta } from "@/lib/cta-tracking";

/* Formulário de inscrição no padrão visual do IANews Portal.
   Mesma lógica de sempre: subscribeLead + UTMs + honeypot + tempo mínimo. */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const SUB_KEY = "ianews_subscribed";
const subs = new Set<() => void>();

export function markSubscribed(email: string) {
  try {
    localStorage.setItem(SUB_KEY, email);
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f());
}

function readSubscribed() {
  try {
    return Boolean(localStorage.getItem(SUB_KEY));
  } catch {
    return false;
  }
}

/** true quando este navegador já assinou: usado para esconder chamadas repetidas. */
export function useSubscribed() {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    readSubscribed,
    () => false,
  );
}

type Props = {
  placement: string;
  button?: string;
  placeholder?: string;
  articleSlug?: string | null;
  /** "row" = campo e botão lado a lado; "stack" = um embaixo do outro. */
  layout?: "row" | "stack";
  wideButton?: boolean;
  onDone?: (res: { alreadySubscribed: boolean; email: string }) => void;
};

export function PortalSubscribeForm({
  placement,
  button = "Assinar grátis",
  placeholder = "Seu melhor e-mail",
  articleSlug = null,
  layout = "row",
  wideButton = false,
  onDone,
}: Props) {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [askEmail, setAskEmail] = useState<string | null>(null);
  const loadedAt = useRef<number>(0);
  const hp = useRef<HTMLInputElement>(null);
  const subscribe = useServerFn(subscribeLead);

  useEffect(() => {
    loadedAt.current = Date.now();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    const value = email.trim().toLowerCase();
    if (hp.current?.value) {
      setMsg({ t: "Pronto! A primeira edição chega amanhã às 7h.", ok: true });
      return;
    }
    if (!EMAIL_RE.test(value) || value.length > 254) {
      setMsg({ t: "Confira o e-mail digitado.", ok: false });
      return;
    }
    if (Date.now() - loadedAt.current < 1500) return;
    setSending(true);
    setMsg(null);
    try {
      const ctx = getLeadContext(articleSlug);
      const res = await subscribe({
        data: {
          email: value,
          source: placement.slice(0, 40),
          placement,
          variant: "portal",
          articleSlug,
          path: ctx.path,
          utmSource: ctx.utmSource,
          utmMedium: ctx.utmMedium,
          utmCampaign: ctx.utmCampaign,
        },
      });
      trackCta({ event: "convert", placement, variant: "portal", articleSlug, leadEmail: value });
      markSubscribed(value);
      setMsg({
        t: res.alreadySubscribed
          ? "Este e-mail já está na lista. A próxima edição chega no seu e-mail."
          : "Pronto! Você está na lista. A primeira edição chega amanhã às 7h. Se não aparecer, confira o spam.",
        ok: true,
      });
      setEmail("");
      if (!res.alreadySubscribed && !onDone) setAskEmail(value);
      onDone?.({ alreadySubscribed: Boolean(res.alreadySubscribed), email: value });
    } catch (err) {
      setMsg({
        t:
          err instanceof Error && err.message
            ? err.message
            : "Não foi possível assinar agora. Tente de novo.",
        ok: false,
      });
    } finally {
      setSending(false);
    }
  }

  const field = (
    <input
      className="field"
      name="email"
      type="email"
      inputMode="email"
      autoComplete="email"
      placeholder={placeholder}
      aria-label="Seu e-mail"
      maxLength={254}
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      disabled={sending}
    />
  );
  const btn = (
    <button className={"btn blue" + (wideButton ? " wide" : "")} type="submit" disabled={sending}>
      {sending ? "Enviando…" : button}
    </button>
  );

  if (askEmail) return <PerfilStep email={askEmail} onClose={() => setAskEmail(null)} />;

  return (
    <form onSubmit={submit} noValidate>
      <input
        ref={hp}
        className="hp"
        type="text"
        name="site"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      {layout === "row" ? (
        <div className="form-row">
          {field}
          {btn}
        </div>
      ) : (
        <>
          {field}
          {btn}
        </>
      )}
      <p
        className={"msg" + (msg ? (msg.ok ? " ok" : " err") : "")}
        role="status"
        aria-live="polite"
      >
        {msg?.t ?? ""}
      </p>
    </form>
  );
}

const PERFIL_KEY = "ianews_perfil_lead";

/** Perfil que a pessoa declarou ao assinar (usado para escolher a oferta certa no site). */
export function readPerfilLead(): string | null {
  try {
    return localStorage.getItem(PERFIL_KEY);
  } catch {
    return null;
  }
}

/** Passo opcional depois de assinar: uma pergunta para qualificar o leitor, sem travar a inscrição. */
export function PerfilStep({ email, onClose }: { email: string; onClose?: () => void }) {
  const save = useServerFn(saveLeadPerfil);
  const [done, setDone] = useState(false);
  async function pick(perfil: string) {
    setDone(true);
    try {
      localStorage.setItem(PERFIL_KEY, perfil);
    } catch {
      /* ignore */
    }
    trackCta({ event: "click", placement: "perfil-lead", variant: perfil });
    try {
      await save({ data: { email, perfil } });
    } catch {
      /* opcional: falha silenciosa */
    }
  }
  if (done) {
    return (
      <div className="pf-step" role="status">
        <p className="pf-ok">
          <b>Inscrição feita. Obrigado!</b> A primeira edição chega amanhã às 7h. Se não aparecer,
          confira o spam.
        </p>
        {onClose ? (
          <button type="button" className="linkish" onClick={onClose}>
            Fechar
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="pf-step" role="group" aria-labelledby="pf-q">
      <p className="pf-ok">
        <b>Pronto, você está na lista.</b> Uma pergunta rápida para a newsletter falar com você:
      </p>
      <p className="pf-q" id="pf-q">
        Você é…
      </p>
      <div className="pf-opts">
        {PERFIS_LEAD.map((p) => (
          <button key={p.value} type="button" onClick={() => pick(p.value)}>
            {p.label}
          </button>
        ))}
      </div>
      <button type="button" className="linkish" onClick={() => setDone(true)}>
        Pular
      </button>
    </div>
  );
}
