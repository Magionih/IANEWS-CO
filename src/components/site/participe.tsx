import { Link } from "@tanstack/react-router";

import { useCtaImpression } from "@/hooks/use-cta-impression";
import { trackCta } from "@/lib/cta-tracking";

/* "Participe da IA News": as três portas de entrada que geram relacionamento e lead qualificado.
   1. Envie sua pauta (empresas que usam IA) · 2. Lista IA News 100 (indicação) · 3. Palco (evento).
   Fotos de pessoas reais que já saíram na IA News, como pede o posicionamento da marca. */

const AMANDA =
  "https://hgydwvuowxxkdgtlqrdy.supabase.co/storage/v1/object/public/covers/amanda-diniz-divos-da-ia-empresa-agentica/2ab712919abf.jpg";
const PALCO = "https://images.pexels.com/photos/3143850/pexels-photo-3143850.jpeg?auto=compress&cs=tinysrgb&w=900";
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
    <div ref={ref} className={"pq-grid" + (placement === "links-bio" ? " is-stack" : "")}>
      <Link to="/pauta" search={u("pauta")} className="pq-card pq-pauta" onClick={click("pauta")}>
        <span className="pq-media">
          <img src={AMANDA} alt="Amanda Diniz, do Divos da IA" loading="lazy" width={900} height={560} />
          <span className="pq-cap">Amanda Diniz, do Divos da IA, contou sua história na IA News</span>
        </span>
        <span className="pq-body">
          <span className="pq-k">Sua empresa na IA News</span>
          <b>Sua empresa usa IA? Envie sua pauta</b>
          <span className="pq-d">
            Conte o que sua empresa faz com inteligência artificial. A redação avalia cada pauta e responde em até 2
            dias úteis.
          </span>
          <span className="pq-cta">Enviar minha pauta →</span>
        </span>
      </Link>

      <Link to="/lista100" hash="candidatura" className="pq-card pq-lista" onClick={click("lista100")}>
        <span className="pq-media pq-faces">
          {FACES.map((f) => (
            <img key={f.src} src={f.src} alt={f.alt} loading="lazy" width={300} height={300} />
          ))}
          <span className="pq-cap">Líderes que já foram notícia na IA News</span>
        </span>
        <span className="pq-body">
          <span className="pq-k">Lista IA News 100</span>
          <b>Indique quem faz a IA acontecer no Brasil</b>
          <span className="pq-d">
            Os 100 nomes que fazem IA de verdade nos negócios. Pode ser do seu time, da sua cidade ou você. Ninguém
            paga para entrar.
          </span>
          <span className="pq-cta">Indicar um nome →</span>
        </span>
      </Link>

      <Link to="/palco" search={u("palco")} className="pq-card pq-palco" onClick={click("palco")}>
        <span className="pq-media">
          <img src={PALCO} alt="Palco iluminado diante de uma plateia" loading="lazy" width={900} height={560} />
          <span className="pq-live">Ao vivo · 16/12 · 19h</span>
        </span>
        <span className="pq-body">
          <span className="pq-k">Palco IA News Online</span>
          <b>O que deu certo com IA nas empresas em 2026</b>
          <span className="pq-d">Raio-X do ano, três cases com números e o Playbook IA 2027, em 1h30 ao vivo.</span>
          <span className="pq-cta">Garantir vaga · R$ 97 →</span>
        </span>
      </Link>
    </div>
  );
}
