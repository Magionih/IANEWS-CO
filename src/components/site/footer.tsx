import { Link } from "@tanstack/react-router";
import { openConsentSettings } from "@/components/site/consent-banner";

import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <>
      <footer className="bg-[color:var(--color-nav)] text-white">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <Logo size="lg" onDark />
          <p className="mt-4 max-w-sm text-sm text-white/60">
            A corrida da IA, explicada para quem decide. Um resumo por dia, sem hype,
            focado em resultado de negócio.
          </p>
          <p className="mt-4 font-mono-eyebrow text-white/50">@ianews.co</p>
        </div>
        <div>
          <p className="font-mono-eyebrow text-[color:var(--color-lime)]">Explore</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link
                to="/noticias"
                search={{ q: "", cat: "all" }}
                className="text-white/70 hover:text-white"
              >
                Notícias
              </Link>
            </li>
            <li>
              <Link
                to="/ranking"
                search={{ area: "semanal", cat: "todas", q: "", all: false }}
                className="text-white/70 hover:text-white"
              >
                Ranking IA
              </Link>
            </li>
            <li>
              <Link to="/habitos" className="text-white/70 hover:text-white">
                Meus Hábitos
              </Link>
            </li>
            <li>
              <Link
                to="/newsletter"
                className="text-white/70 hover:text-white"
              >
                Newsletter
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-mono-eyebrow text-[color:var(--color-lime)]">Sobre</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link to="/sobre" className="text-white/70 hover:text-white">
                Sobre &amp; Política editorial
              </Link>
            </li>
            <li>
              <Link to="/anuncie" className="text-white/70 hover:text-white">
                Anuncie
              </Link>
            </li>
            <li>
              <Link to="/contato" className="text-white/70 hover:text-white">
                Contato
              </Link>
            </li>
            <li>
              <Link to="/termos" className="text-white/70 hover:text-white">
                Termos &amp; Privacidade
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={openConsentSettings}
                className="text-white/70 hover:text-white"
              >
                Preferências de cookies
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-2 px-4 py-6 text-xs text-white/50 sm:flex-row sm:items-center sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} IA News. Todos os direitos reservados.</p>
          <p>Feito no Brasil, para quem decide.</p>
        </div>
      </div>
    </footer>
    </>
  );
}