import { useSyncExternalStore, useState, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { EmailInput, PhoneInput } from "@/components/site/smart-fields";
import { subscribeLead } from "@/lib/newsletter.functions";
import { getLeadContext, trackCta } from "@/lib/cta-tracking";

let open = false;
let placement = "generico";
const listeners = new Set<() => void>();
let goToSubscribePage: ((from: string) => void) | null = null;

function emit() {
  listeners.forEach((l) => l());
}

/**
 * CTA principal de assinatura: leva o leitor para a página /assinar
 * (em vez de abrir o pop-up).
 */
export function openSubscribe(from?: string) {
  const source = from ?? "generico";
  trackCta({ event: "click", placement: source, variant: "ir-para-assinar" });
  if (goToSubscribePage) goToSubscribePage(source);
  else if (typeof window !== "undefined")
    window.location.assign(`/assinar?from=${encodeURIComponent(source)}`);
}

/** Pop-up compacto — usado apenas em gatilhos automáticos (exit intent). */
export function openSubscribeDialog(from?: string) {
  placement = from ?? "generico";
  open = true;
  trackCta({ event: "click", placement, variant: "abrir-popup" });
  emit();
}

function setOpen(next: boolean) {
  open = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const PERKS = [
  "Edição diária no e-mail antes das 8h",
  "Alertas de mercado em tempo real no WhatsApp",
  "Ranking IA completo, atualizado a cada edição",
  "Análises de impacto para o seu negócio",
];

export function SubscribeDialog() {
  const isOpen = useSyncExternalStore(
    subscribe,
    () => open,
    () => false,
  );
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const subscribeFn = useServerFn(subscribeLead);
  const navigate = useNavigate();

  useEffect(() => {
    goToSubscribePage = (from: string) => {
      open = false;
      emit();
      navigate({ to: "/assinar", search: { from } });
    };
    return () => {
      goToSubscribePage = null;
    };
  }, [navigate]);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent
        className="left-1/2 top-auto bottom-3 w-[calc(100%-1.5rem)] max-w-md translate-x-[-50%] translate-y-0 gap-0 overflow-hidden border border-white/10 bg-[color:var(--color-nav)] p-0 text-white shadow-2xl data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4 sm:bottom-auto sm:top-1/2 sm:translate-y-[-50%]"
      >
        <div className="relative p-5 sm:p-7">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full opacity-25 blur-3xl"
            style={{ background: "var(--color-lime)" }}
          />
          <p className="relative font-mono-eyebrow flex items-center gap-2 text-[color:var(--color-lime)]">
            <Sparkles className="h-3.5 w-3.5" /> Assinatura IA News
          </p>
          <DialogTitle className="relative mt-2 text-xl font-extrabold leading-tight sm:text-2xl">
            5 minutos por dia. Zero hype.
          </DialogTitle>
          <p className="relative mt-1.5 text-[13px] leading-snug text-white/70">
            A edição diária do IA News, grátis, antes das 8h.
          </p>

          <ul className="relative mt-4 hidden space-y-2 sm:block">
            {PERKS.slice(0, 3).map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-white/85">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-lime)]" />
                {p}
              </li>
            ))}
          </ul>

          <form
            className="relative mt-4 flex flex-col gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              const value = email.trim();
              if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) || value.length > 255) {
                toast.error("Informe um e-mail válido.");
                return;
              }
              setSending(true);
              const ctx = getLeadContext();
              subscribeFn({
                data: {
                  email: value,
                  full_name: name.trim() || undefined,
                  phone: phone.trim() || undefined,
                  source: placement || "popup-assinatura",
                  placement,
                  variant: "popup-assinatura",
                  path: ctx.path,
                  utmSource: ctx.utmSource,
                  utmMedium: ctx.utmMedium,
                  utmCampaign: ctx.utmCampaign,
                },
              })
                .then((res) => {
                  trackCta({
                    event: "convert",
                    placement,
                    variant: "popup-assinatura",
                    leadEmail: value,
                  });
                  setEmail("");
                  setName("");
                  setPhone("");
                  setOpen(false);
                  toast.success(
                    res.alreadySubscribed
                      ? `${value} já está na lista — a próxima edição chega amanhã cedo.`
                      : `Quase lá! Enviamos um e-mail para ${value}: confirme para ativar a assinatura.`,
                  );
                })

                .catch((err: unknown) =>
                  toast.error(
                    err instanceof Error ? err.message : "Não foi possível concluir a inscrição.",
                  ),
                )
                .finally(() => setSending(false));
            }}
          >
            <div className="hidden flex-col gap-2.5 sm:flex sm:flex-row">
              <Input
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                aria-label="Seu nome"
                className="h-11 rounded-none border-white/15 bg-white/10 px-4 text-base text-white placeholder:text-white/50"
              />
              <PhoneInput
                value={phone}
                onChange={setPhone}
                className="h-11 rounded-none border-white/15 bg-white/10 px-4 text-base text-white placeholder:text-white/50"
              />
            </div>
            <EmailInput
              value={email}
              onChange={setEmail}
              className="h-11 rounded-none border-white/15 bg-white/10 px-4 text-base text-white placeholder:text-white/50"
            />
            <Button
              type="submit"
              disabled={sending}
              className="h-11 w-full rounded-none bg-[color:var(--color-lime)] px-6 font-bold text-white hover:bg-[color:var(--color-lime)]/90"
            >
              {sending ? "Enviando..." : "Assinar grátis"}
            </Button>
          </form>

          <p className="relative mt-3 text-xs text-white/50">
            <Link
              to="/assinar"
              search={{ from: "popup" }}
              onClick={() => setOpen(false)}
              className="font-semibold text-[color:var(--color-lime)] hover:underline"
            >
              Ver todos os benefícios
            </Link>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}