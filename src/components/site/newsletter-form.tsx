import { useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, LoaderCircle, Mail } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeLead } from "@/lib/newsletter.functions";
import { getLeadContext } from "@/lib/cta-tracking";

const emailSchema = z.string().trim().max(255).email();
const confirmation = "Quase lá! Enviamos um e-mail para confirmar sua inscrição. Confira a caixa de entrada (e o spam).";

export function NewsletterForm({ placement, loadedAt }: {
  placement: "newsletter-hero" | "newsletter-footer";
  loadedAt: { current: number | null };
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
      const response = await subscribe({ data: {
        email: parsed.data,
        source: "newsletter-page",
        placement,
        path: context.path,
        utmSource: context.utmSource?.slice(0, 120),
        utmMedium: context.utmMedium?.slice(0, 120),
        utmCampaign: context.utmCampaign?.slice(0, 120),
      } });
      if (!response.ok) throw new Error("subscription failed");
      setResult(response.alreadySubscribed ? "Este e-mail já está inscrito." : confirmation);
    } catch {
      setError("Não foi possível concluir sua inscrição agora. Tente novamente em alguns instantes.");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return (
    <div className="w-full max-w-xl">
      {result ? (
        <div role="status" className="flex items-start gap-3 border-l-4 border-primary bg-primary/5 p-5">
          <Mail className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-base font-medium leading-relaxed">{result}</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate aria-label={placement === "newsletter-hero" ? "Inscrição na newsletter" : "Inscrição final na newsletter"}>
          <label htmlFor={inputId} className="mb-2 block text-sm font-semibold">Seu e-mail</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input id={inputId} name="email" type="email" autoComplete="email" inputMode="email" maxLength={255} required
              value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }}
              placeholder="voce@exemplo.com" disabled={sending} aria-invalid={Boolean(error)}
              aria-describedby={error ? `${inputId}-error` : undefined}
              className="h-12 min-w-0 flex-1 rounded-none bg-card text-base" />
            <Input name="site" tabIndex={-1} aria-hidden="true" autoComplete="off" className="hidden" />
            <Button type="submit" disabled={sending} className="h-12 shrink-0 rounded-none px-6 text-base font-bold">
              {sending && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />}
              {sending ? "Enviando..." : "Quero receber"}
            </Button>
          </div>
          {error && <p id={`${inputId}-error`} role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
        </form>
      )}
      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground sm:text-sm">
        {["Grátis", "Cancele com 1 clique", "Sem spam"].map((label) => (
          <li key={label} className="flex items-center gap-1.5"><Check className="size-3.5 text-primary" />{label}</li>
        ))}
      </ul>
    </div>
  );
}