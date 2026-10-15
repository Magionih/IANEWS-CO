import { useState, type RefObject } from "react";

import { PortalSubscribeForm, useSubscribed } from "@/components/site/portal-subscribe";
import { useCtaImpression } from "@/hooks/use-cta-impression";
import { trackCta } from "@/lib/cta-tracking";

/* Chamadas de newsletter da matéria no padrão do IANews Portal.
   Mesmos placements de antes (materia-meio, materia-sidebar) + faixa do fim (materia-fim),
   com impressão rastreada e inscrição real via PortalSubscribeForm.
   Somem para quem já assinou, exceto logo depois de assinar ali (para mostrar a confirmação). */

const WHATSAPP_URL = "https://chat.whatsapp.com/Is5edILjICj0D2MMHUmGbL";

function useHideForSubscribed() {
  const subscribed = useSubscribed();
  const [justDone, setJustDone] = useState(false);
  return { hidden: subscribed && !justDone, onDone: () => setJustDone(true) };
}

/** Faixa discreta no meio do texto (placement materia-meio). */
export function ArticleInlineCta({ articleSlug }: { articleSlug: string }) {
  const placement = "materia-meio";
  const ref = useCtaImpression(placement, "inline", articleSlug);
  const { hidden, onDone } = useHideForSubscribed();
  if (hidden) return null;
  return (
    <div className="inline-cta" ref={ref}>
      <p className="t">
        <b>Receba matérias assim no seu e-mail</b>
        Edição diária da IANews, grátis, com a fonte de cada notícia.
      </p>
      <PortalSubscribeForm
        placement={placement}
        button="Assinar"
        articleSlug={articleSlug}
        onDone={onDone}
      />
    </div>
  );
}

/** Faixa de newsletter no fim da matéria (placement materia-fim). */
export function ArticleEndBand({
  articleSlug,
  categoryLabel,
}: {
  articleSlug: string;
  categoryLabel: string;
}) {
  const placement = "materia-fim";
  const ref = useCtaImpression(placement, "band", articleSlug);
  const { hidden, onDone } = useHideForSubscribed();
  if (hidden) return null;
  return (
    <section
      className="band art-end-band"
      ref={ref as unknown as RefObject<HTMLElement>}
      aria-label="Newsletter IANews"
    >
      <div className="txt">
        <p className="kick">Newsletter IANews</p>
        <h3>Receba mais sobre {categoryLabel} no seu e-mail</h3>
        <p>A newsletter diária da IANews, em 5 minutos, com a fonte de cada notícia.</p>
      </div>
      <PortalSubscribeForm
        placement={placement}
        button="Assinar grátis"
        articleSlug={articleSlug}
        onDone={onDone}
      />
    </section>
  );
}

/** Caixa lateral (placement materia-sidebar), com o grupo gratuito do WhatsApp. */
export function ArticleSideSubscribe({ articleSlug }: { articleSlug: string }) {
  const placement = "materia-sidebar";
  const ref = useCtaImpression(placement, "card", articleSlug);
  const { hidden, onDone } = useHideForSubscribed();
  if (hidden) return null;
  return (
    <div className="box nl-side" ref={ref}>
      <h3>5 minutos por dia. Zero hype.</h3>
      <PortalSubscribeForm
        placement={placement}
        button="Assinar grátis"
        placeholder="Seu e-mail"
        layout="stack"
        articleSlug={articleSlug}
        onDone={onDone}
      />
      <a
        className="wa-link"
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer noopener"
        onClick={() => trackCta({ event: "click", placement, variant: "whatsapp", articleSlug })}
      >
        Entrar no grupo gratuito do WhatsApp
      </a>
    </div>
  );
}
