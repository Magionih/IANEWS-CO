import { ArrowRight, Mail, MessageCircle, Sparkles } from "lucide-react";

import { openSubscribe } from "@/components/site/subscribe-dialog";
import { useCtaImpression } from "@/hooks/use-cta-impression";
import { trackCta } from "@/lib/cta-tracking";
import { cn } from "@/lib/utils";

const WHATSAPP_URL = "https://chat.whatsapp.com/Is5edILjICj0D2MMHUmGbL";

type Variant = "band" | "inline" | "card";

export function LeadCta({
  eyebrow = "IA News",
  title,
  description,
  action = "Quero receber",
  variant = "band",
  className,
  showWhatsapp = true,
  placement = "cta-generico",
  articleSlug,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: string;
  variant?: Variant;
  className?: string;
  showWhatsapp?: boolean;
  placement?: string;
  articleSlug?: string | null;
}) {
  const ref = useCtaImpression(placement, variant, articleSlug);
  const openFor = () => openSubscribe(placement);
  const onWhats = () =>
    trackCta({ event: "click", placement, variant: "whatsapp", articleSlug });
  if (variant === "inline") {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-3 rounded-2xl border border-border/60 bg-secondary/50 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5",
          className,
        )}
      >
        <div>
          <p className="text-sm font-extrabold leading-tight">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          onClick={openFor}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[color:var(--color-lime)] px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
        >
          {action} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl border border-border/60 bg-background p-5 shadow-[var(--shadow-mui-sm)]",
          className,
        )}
      >
        <p className="font-mono-eyebrow text-primary">{eyebrow}</p>
        <p className="mt-2 text-base font-extrabold leading-tight">{title}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
        <button
          type="button"
          onClick={openFor}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[color:var(--color-nav)] px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
        >
          <Mail className="h-3.5 w-3.5" /> {action}
        </button>
        {showWhatsapp ? (
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer noopener"
            onClick={onWhats}
            className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-foreground/80 ring-1 ring-inset ring-border/70 transition-colors hover:text-foreground"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Entrar no grupo gratuito
          </a>
        ) : null}
      </div>
    );
  }

  return (
    <section
      ref={ref as unknown as React.RefObject<HTMLElement>}
      className={cn("relative overflow-hidden rounded-3xl px-6 py-10 sm:px-10 sm:py-12", className)}
      style={{ background: "var(--color-nav)" }}
    >
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-25 blur-3xl"
        style={{ background: "var(--color-lime)" }}
      />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white">
            <Sparkles className="h-3.5 w-3.5" /> {eyebrow}
          </p>
          <h2 className="mt-4 text-2xl font-extrabold leading-tight text-white sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/75 sm:text-base">{description}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <button
            type="button"
            onClick={openFor}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[color:var(--color-lime)] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-opacity hover:opacity-90"
          >
            <Mail className="h-4 w-4" /> {action}
          </button>
          {showWhatsapp ? (
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noreferrer noopener"
              onClick={onWhats}
              className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/10"
            >
              <MessageCircle className="h-4 w-4" /> Grupo gratuito no WhatsApp
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}