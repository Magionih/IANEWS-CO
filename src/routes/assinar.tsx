import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Mail, MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput, PhoneInput } from "@/components/site/smart-fields";
import { subscribeLead } from "@/lib/newsletter.functions";
import { getLeadContext, trackCta } from "@/lib/cta-tracking";

const WHATSAPP_URL = "https://chat.whatsapp.com/Is5edILjICj0D2MMHUmGbL";

const PERKS = [
  "Edição diária no e-mail antes das 8h",
  "Alertas de mercado em tempo real no WhatsApp",
  "Ranking IA completo, atualizado a cada edição",
  "Análises de impacto para o seu negócio",
];

type Search = { from: string };

export const Route = createFileRoute("/assinar")({
  validateSearch: (search: Partial<Record<string, unknown>>): Search => ({
    from: typeof search.from === "string" ? search.from : "pagina-assinar",
  }),
  head: () => ({
    meta: [
      { title: "Assine a newsletter do IA News — grátis, todo dia útil" },
      {
        name: "description",
        content:
          "Receba a edição diária do IA News antes das 8h: notícias, análises e o Ranking IA com impacto real para o seu negócio. Grátis.",
      },
      { property: "og:title", content: "Assine a newsletter do IA News" },
      {
        property: "og:description",
        content:
          "Uma edição diária com o que muda na inteligência artificial e o impacto para empresas brasileiras.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ianews.site/assinar" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://ianews.site/assinar" }],
  }),
  component: AssinarPage,
});

function AssinarPage() {
  const { from } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const subscribeFn = useServerFn(subscribeLead);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto grid max-w-[1100px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:px-8 lg:py-16">
        <section>
          <p className="font-mono-eyebrow inline-flex items-center gap-2 text-[color:var(--color-lime)]">
            <Sparkles className="h-3.5 w-3.5" /> Assinatura IA News
          </p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
            5 minutos por dia. Zero hype.
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Tudo o que muda na inteligência artificial, com a análise de impacto para quem
            precisa decidir. Grátis, todo dia útil antes das 8h.
          </p>
          <ul className="mt-7 space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[15px] text-foreground/85">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--color-lime)]" />
                {p}
              </li>
            ))}
          </ul>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => trackCta({ event: "click", placement: "pagina-assinar", variant: "whatsapp" })}
            className="mt-8 inline-flex items-center gap-2 border border-border px-5 py-3 text-sm font-semibold hover:border-foreground/50"
          >
            <MessageCircle className="h-4 w-4" /> Entrar no grupo gratuito do WhatsApp
          </a>
        </section>

        <section className="h-fit border border-border bg-[color:var(--color-nav)] p-6 text-white sm:p-8">
          {done ? (
            <div className="text-center">
              <Mail className="mx-auto h-10 w-10 text-[color:var(--color-lime)]" />
              <h2 className="mt-4 text-xl font-extrabold">Quase lá!</h2>
              <p className="mt-2 text-sm text-white/75">{done}</p>
              <Button asChild className="mt-6 h-11 w-full rounded-none bg-[color:var(--color-lime)] font-bold text-white hover:bg-[color:var(--color-lime)]/90">
                <Link to="/noticias" search={{ q: "", cat: "all" }}>
                  Ler as notícias de hoje
                </Link>
              </Button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-extrabold">Criar minha assinatura gratuita</h2>
              <p className="mt-1.5 text-sm text-white/65">
                Cancele quando quiser. Sem spam, sem cobrança.
              </p>
              <form
                className="mt-6 flex flex-col gap-3"
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
                      source: from,
                      placement: from,
                      variant: "pagina-assinar",
                      path: ctx.path,
                      utmSource: ctx.utmSource,
                      utmMedium: ctx.utmMedium,
                      utmCampaign: ctx.utmCampaign,
                    },
                  })
                    .then((res) => {
                      trackCta({
                        event: "convert",
                        placement: from,
                        variant: "pagina-assinar",
                        leadEmail: value,
                      });
                      setDone(
                        res.alreadySubscribed
                          ? `${value} já está na lista — a próxima edição chega amanhã cedo.`
                          : `Enviamos um e-mail para ${value}. Confirme para ativar a assinatura.`,
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
                <Input
                  maxLength={120}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  aria-label="Seu nome"
                  className="h-12 rounded-none border-white/15 bg-white/10 px-4 text-base text-white placeholder:text-white/50"
                />
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  className="h-12 rounded-none border-white/15 bg-white/10 px-4 text-base text-white placeholder:text-white/50"
                />
                <EmailInput
                  value={email}
                  onChange={setEmail}
                  className="h-12 rounded-none border-white/15 bg-white/10 px-4 text-base text-white placeholder:text-white/50"
                />
                <Button
                  type="submit"
                  disabled={sending}
                  className="h-12 rounded-none bg-[color:var(--color-lime)] text-base font-bold text-white hover:bg-[color:var(--color-lime)]/90"
                >
                  {sending ? "Enviando..." : "Assinar grátis"}
                </Button>
              </form>
              <p className="mt-4 text-xs text-white/50">
                Já tem conta?{" "}
                <Link to="/auth" className="font-semibold text-[color:var(--color-lime)] hover:underline">
                  Entrar
                </Link>
              </p>
            </>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
