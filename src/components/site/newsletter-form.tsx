import { useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { subscribeLead } from "@/lib/newsletter.functions";
import { getLeadContext } from "@/lib/cta-tracking";
import { markSubscribed } from "@/components/site/portal-subscribe";

/* Formulário da página /newsletter no visual do IANews Portal (.nlh-form).
   Mesma lógica de antes: zod, honeypot "site", tempo mínimo de 2s, subscribeLead com UTMs. */

const emailSchema = z.string().trim().max(255).email();
const confirmation =
  "Quase lá! Enviamos um e-mail para confirmar sua inscrição. Confira a caixa de entrada (e o spam).";

export function NewsletterForm({
  placement,
  loadedAt,
  button = "Assinar grátis",
}: {
  placement: "newsletter-hero" | "newsletter-footer";
  loadedAt: { current: number | null };
  button?: string;
}) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const subscribe = useServerFn(subscribeLead);
  const inputId = `${placement}-email`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const form = new FormData(event.currentTarget);
    if (form.get("site")) {
      setResult(confirmation);
      return;
    }
    if (loadedAt.current === null || Date.now() - loadedAt.current < 2000) return;
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError("Informe um e-mail válido para receber a newsletter.");
      return;
    }
    setError("");
    inFlight.current = true;
    setSending(true);
    try {
      const context = getLeadContext();
      const response = await subscribe({
        data: {
          email: parsed.data,
          source: "newsletter-page",
          placement,
          path: context.path,
          utmSource: context.utmSource?.slice(0, 120),
          utmMedium: context.utmMedium?.slice(0, 120),
          utmCampaign: context.utmCampaign?.slice(0, 120),
        },
      });
      if (!response.ok) throw new Error("subscription failed");
      markSubscribed(parsed.data);
      setResult(response.alreadySubscribed ? "Este e-mail já está inscrito." : confirmation);
    } catch {
      setError(
        "Não foi possível concluir sua inscrição agora. Tente novamente em alguns instantes.",
      );
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  if (result) {
    return (
      <p
        className="msg ok"
        role="status"
        aria-live="polite"
        style={{ fontSize: 16, fontWeight: 500 }}
      >
        {result}
      </p>
    );
  }

  return (
    <form
      className="nlh-form"
      onSubmit={submit}
      noValidate
      aria-label={
        placement === "newsletter-hero"
          ? "Inscrição na newsletter"
          : "Inscrição final na newsletter"
      }
    >
      <input
        className="hp"
        type="text"
        name="site"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />
      <div className="form-row">
        <input
          id={inputId}
          className={"field" + (placement === "newsletter-hero" ? " big" : "")}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="Seu melhor e-mail"
          aria-label="Seu e-mail"
          maxLength={255}
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError("");
          }}
          disabled={sending}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
        />
        <button className="btn blue" type="submit" disabled={sending}>
          {sending ? "Enviando…" : button}
        </button>
      </div>
      <p
        id={`${inputId}-error`}
        className={"msg" + (error ? " err" : "")}
        role={error ? "alert" : "status"}
        aria-live="polite"
      >
        {error}
      </p>
    </form>
  );
}
