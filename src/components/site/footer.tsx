import { Link } from "@tanstack/react-router";

import logoWhite from "@/assets/ianews-logo-white.png";
import { openConsentSettings } from "@/components/site/consent-banner";
import { PortalSubscribeForm, useSubscribed } from "@/components/site/portal-subscribe";
import { HUB_LIST } from "@/lib/hubs";

/* Rodapé no design do IANews Portal. */
export function SiteFooter() {
  const subscribed = useSubscribed();
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-in">
          <div>
            <Link className="logo" to="/" aria-label="IANews">
              <img src={logoWhite} alt="IANews" width={795} height={160} />
            </Link>
            <p>A corrida da IA, explicada para quem decide. Notícias, ranking de plataformas e as pessoas por trás.</p>
            {!subscribed && (
              <div>
                <p className="lb">Newsletter diária, grátis</p>
                <PortalSubscribeForm placement="rodape" button="Assinar" />
              </div>
            )}
          </div>
          <div>
            <h4>Portal</h4>
            <Link to="/noticias" search={{ q: "", cat: "all" }}>
              Notícias
            </Link>
            <Link to="/ranking">Ranking IA</Link>
            <Link to="/gente">Gente</Link>
            <Link to="/habitos">Meus hábitos</Link>
          </div>
          <div>
            <h4>Temas</h4>
            {HUB_LIST.map((h) => (
              <Link key={h.slug} to="/guias/$hub" params={{ hub: h.slug }} search={{ q: "", tema: "all" }}>
                {h.eyebrow || h.title}
              </Link>
            ))}
            <Link to="/artigos/inteligencia-artificial-nas-empresas">IA nas empresas</Link>
          </div>
          <div>
            <h4>IANews</h4>
            <Link to="/newsletter">Newsletter</Link>
            <Link to="/empresas">Para empresas</Link>
            <Link to="/anuncie">Anuncie</Link>
            <Link to="/pauta" search={{ utm_source: "site", utm_medium: "rodape", utm_campaign: "pauta" }}>
              Envie sua pauta
            </Link>
            <Link to="/sobre">Como fazemos</Link>
            <Link to="/contato">Contato</Link>
            <a href="https://www.instagram.com/ianews.co/" target="_blank" rel="noopener noreferrer">
              Instagram @ianews.co
            </a>
          </div>
        </div>
        <div className="legal">
          <span>
            © {new Date().getFullYear()} IA News ·{" "}
            <Link to="/termos" style={{ display: "inline", padding: 0, textDecoration: "underline" }}>
              Privacidade e termos
            </Link>{" "}
            ·{" "}
            <button
              type="button"
              onClick={openConsentSettings}
              style={{ background: "none", border: 0, padding: 0, color: "inherit", textDecoration: "underline", cursor: "pointer" }}
            >
              Cookies
            </button>
          </span>
          <span>Feito no Brasil, para quem decide.</span>
        </div>
      </div>
    </footer>
  );
}
