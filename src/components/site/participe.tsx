import { Link } from "@tanstack/react-router";

import { useCtaImpression } from "@/hooks/use-cta-impression";
import { trackCta } from "@/lib/cta-tracking";

/* "Participe da IA News": as três portas de entrada que geram relacionamento e lead qualificado.
   1. Envie sua pauta · 2. Lista IA News 100 (indicação) · 3. Palco (evento).
   Formato compacto: foto quadrada, título curto e chamada. Os três cabem juntos na tela do celular. */

const AMANDA =
  "https://hgydwvuowxxkdgtlqrdy.supabase.co/storage/v1/object/public/covers/amanda-diniz-divos-da-ia-empresa-agentica/2ab712919abf.jpg";
const PALCO = "https://images.pexels.com/photos/9275222/pexels-photo-9275222.jpeg?auto=compress&cs=tinysrgb&w=400";
const FACES = [
  { src: "/gente/tarciana.jpg", alt: "Tarciana Medeiros" },
  { src: "/gente/diego.jpg", alt: "Diego Barreto" },
  { src: "/gente/monica-retrato.jpg", alt: "Mônica Hauck" },
  { src: "/gente/luis.jpg", alt: "Luis Silva" },
];

type Placement = "links-bio" | "home-participe" | "materia-participe";

export function ParticipeCards({ placement, utm = false }: { placement: Placement; utm?: boolean }) {
  const ref = useCtaImpression(placement, "participe");
  const click = (variant: string) => () => trackCta({ event: "click", placement, variant });
  const u = (campaign: string) =>
    utm ? { utm_source: "instagram", utm_medium: "bio", utm_campaign: campaign } : {};

  return (
    <div ref={ref} className={"pq-grid" + (placement === "home-participe" ? "" : " is-stack")}>
      <Link to="/pauta" search={u("pauta")} className="pq-card pq-pauta" onClick={click("pauta")}>
        <span className="pq-media">
          <img src={AMANDA} alt="Amanda Diniz, do Divos da IA, que contou sua história na IA News" loading="lazy" width={160} height={160} />
        </span>
        <span className="pq-body">
          <span className="pq-k">Sua empresa na IA News</span>
          <b>Sua empresa usa IA? Envie sua pauta</b>
          <span className="pq-cta">Enviar pauta →</span>
        </span>
      </Link>

      <Link to="/lista100" hash="candidatura" className="pq-card pq-lista" onClick={click("lista100")}>
        <span className="pq-media pq-faces">
          {FACES.map((f) => (
            <img key={f.src} src={f.src} alt={f.alt} loading="lazy" width={80} height={80} />
          ))}
        </span>
        <span className="pq-body">
          <span className="pq-k">Lista IA News 100</span>
          <b>Indique quem faz a IA acontecer no Brasil</b>
          <span className="pq-cta">Indicar um nome →</span>
        </span>
      </Link>

      <Link to="/palco" search={u("palco")} className="pq-card pq-palco" onClick={click("palco")}>
        <span className="pq-media">
          <img src={PALCO} alt="Plateia assistindo a uma apresentação" loading="lazy" width={160} height={160} />
        </span>
        <span className="pq-body">
          <span className="pq-k">Ao vivo · 16/12 · 19h</span>
          <b>Palco IA News Online</b>
          <span className="pq-cta">Garantir vaga · R$ 97 →</span>
        </span>
      </Link>
    </div>
  );
}
