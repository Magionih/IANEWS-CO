import { useEffect, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, BriefcaseBusiness, Mail, MessageCircle, Newspaper } from "lucide-react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { NewsletterForm } from "@/components/site/newsletter-form";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { listRecentArticles } from "@/lib/articles.functions";
import { CATEGORY_SEO } from "@/lib/categories";

const articlesOptions = queryOptions({ queryKey: ["articles", "recent"], queryFn: () => listRecentArticles() });
const title = "Newsletter IANews — o resumo de IA para quem decide";
const description = "Receba a newsletter gratuita da IANews: curadoria das notícias de inteligência artificial que importam para negócios, em 5 minutos, todo dia útil às 7h, e Ranking IA semanal. Sem hype.";

export const Route = createFileRoute("/newsletter")({
  ssr: true,
  loader: ({ context }) => context.queryClient.ensureQueryData(articlesOptions),
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://ianewsbr.com/newsletter" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ],
    links: [{ rel: "canonical", href: "https://ianewsbr.com/newsletter" }],
  }),
  component: NewsletterPage,
});

function NewsletterPage() {
  const { data: articles } = useSuspenseQuery(articlesOptions);
  const loadedAt = useRef<number | null>(null);
  useEffect(() => { loadedAt.current = Date.now(); }, []);
  const latest = articles.filter((article) => {
    const published = Date.parse(article.published_at);
    return Number.isFinite(published) && published <= Date.now();
  }).slice(0, 5);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="[&_h1]:tracking-normal [&_h2]:tracking-normal [&_h3]:tracking-normal">
        <section className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <p className="font-mono-eyebrow !tracking-normal text-primary">Newsletter gratuita · todo dia útil, 7h</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-[1.12] sm:text-5xl lg:text-6xl">A corrida da IA em 5 minutos, antes do café.</h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">A curadoria da IANews com as notícias de inteligência artificial que importam para negócios. Contexto para decidir melhor, sem hype.</p>
          <div className="mt-8"><NewsletterForm placement="newsletter-hero" loadedAt={loadedAt} /></div>
        </section>

        <section className="border-y border-border bg-card" aria-labelledby="edition-title">
          <div className="mx-auto grid max-w-[1100px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.7fr_1.3fr] lg:gap-14 lg:px-8 lg:py-16">
            <div>
              <Mail className="size-7 text-primary" />
              <h2 id="edition-title" className="mt-4 text-3xl font-extrabold">Assim chega no seu e-mail</h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">Os fatos, o contexto e por que cada notícia importa. Uma amostra com as matérias mais recentes da redação.</p>
            </div>
            <article className="min-w-0 border border-border bg-background p-5 sm:p-8" aria-label="Amostra da edição da newsletter">
              <div className="flex items-center justify-between gap-3 border-b border-border pb-5">
                <p className="text-xl font-extrabold">IANews<span className="text-primary">.</span></p>
                <span className="text-xs text-muted-foreground">Sua dose de IA</span>
              </div>
              {latest.length ? <ol className="divide-y divide-border">
                {latest.map((article, index) => (
                  <li key={article.id} className="py-5 last:pb-0">
                    <p className="mb-2 text-xs font-semibold uppercase text-primary">{String(index + 1).padStart(2, "0")} / {CATEGORY_SEO[article.category]?.label ?? article.category}</p>
                    <Link to="/materia/$slug" params={{ slug: article.slug }} className="group block focus-visible:outline-primary">
                      <h3 className="text-lg font-bold leading-snug group-hover:text-primary">{article.title}</h3>
                      {(article.why_it_matters || article.dek) && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground"><span className="font-semibold text-foreground">Por que importa: </span>{article.why_it_matters || article.dek}</p>}
                    </Link>
                  </li>
                ))}
              </ol> : <p className="py-6 text-sm text-muted-foreground">As matérias da edição aparecerão aqui assim que estiverem disponíveis.</p>}
            </article>
          </div>
        </section>

        <section className="mx-auto max-w-[1100px] px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <h2 className="text-3xl font-extrabold">O que você recebe</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {[
              { icon: Newspaper, heading: "Resumo diário", text: "As notícias de IA que movem negócios, explicadas em 5 minutos." },
              { icon: BarChart3, heading: "Ranking IA semanal", text: "As ferramentas que mais cresceram na semana." },
              { icon: BriefcaseBusiness, heading: "Análise para quem decide", text: "Impacto prático para empresas e carreiras." },
            ].map(({ icon: Icon, heading, text }) => <div key={heading} className="border-t-2 border-primary pt-5">
              <Icon className="size-6 text-primary" /><h3 className="mt-4 text-xl font-bold">{heading}</h3><p className="mt-3 text-base leading-relaxed text-muted-foreground">{text}</p>
            </div>)}
          </div>
        </section>

        <section className="border-y border-border bg-primary/5">
          <div className="mx-auto flex max-w-[1100px] flex-col items-start gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
            <div className="flex items-start gap-3"><MessageCircle className="mt-1 size-6 shrink-0 text-primary" /><h2 className="max-w-xl text-xl font-bold leading-snug">Prefere no WhatsApp? Entre na comunidade IANews</h2></div>
            <Button asChild variant="outline" className="h-auto min-h-12 shrink-0 whitespace-normal rounded-none bg-card px-5 py-3"><a href="https://chat.whatsapp.com/Is5edILjICj0D2MMHUmGbL" target="_blank" rel="noopener noreferrer">Entrar na comunidade <ArrowRight className="size-4 shrink-0" /></a></Button>
          </div>
        </section>

        <section className="mx-auto max-w-[760px] px-4 py-12 sm:px-6 lg:py-16">
          <h2 className="text-3xl font-extrabold">Perguntas frequentes</h2>
          <Accordion type="single" collapsible className="mt-6">
            <AccordionItem value="free"><AccordionTrigger className="text-base font-semibold">É gratuito?</AccordionTrigger><AccordionContent className="leading-relaxed text-muted-foreground">Sim. A newsletter IANews é gratuita.</AccordionContent></AccordionItem>
            <AccordionItem value="frequency"><AccordionTrigger className="text-base font-semibold">Com que frequência?</AccordionTrigger><AccordionContent className="leading-relaxed text-muted-foreground">Todo dia útil, às 7h, mais o Ranking IA semanal.</AccordionContent></AccordionItem>
            <AccordionItem value="cancel"><AccordionTrigger className="text-base font-semibold">Posso cancelar?</AccordionTrigger><AccordionContent className="leading-relaxed text-muted-foreground">Sim. Há um link para cancelar a inscrição em todo e-mail.</AccordionContent></AccordionItem>
            <AccordionItem value="privacy"><AccordionTrigger className="text-base font-semibold">O que fazem com meu e-mail?</AccordionTrigger><AccordionContent className="leading-relaxed text-muted-foreground">Usamos só para enviar a newsletter, sem venda a terceiros. Leia nossos <Link to="/termos" className="font-medium text-primary underline underline-offset-4">termos e política de privacidade</Link>.</AccordionContent></AccordionItem>
          </Accordion>
        </section>

        <section className="border-t border-border bg-card">
          <div className="mx-auto max-w-[760px] px-4 py-12 sm:px-6 lg:py-16">
            <h2 className="text-3xl font-extrabold">Comece amanhã às 7h</h2>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">Seu próximo dia útil começa com as notícias que ajudam a decidir.</p>
            <div className="mt-7"><NewsletterForm placement="newsletter-footer" loadedAt={loadedAt} /></div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}