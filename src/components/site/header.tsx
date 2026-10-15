import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import logoWhite from "@/assets/ianews-logo-white.png";
import { useAuth } from "@/hooks/use-auth";
import { useAdminAccess } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_SEO_LIST } from "@/lib/categories";
import { HUB_LIST } from "@/lib/hubs";
import { openSubscribeDialog } from "@/components/site/subscribe-dialog";

/* Cabeçalho no design do IANews Portal: uma linha só, escuro, com Notícias em menu suspenso. */

function Icon({ d, className = "ico" }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const I = {
  search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm9 16-3.6-3.6",
  menu: "M4 7h16M4 12h16M4 17h16",
  x: "M6 6l12 12M18 6 6 18",
};

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  function go(e?: React.FormEvent) {
    e?.preventDefault();
    const term = q.trim().slice(0, 80);
    onClose();
    navigate({ to: "/noticias", search: { q: term, cat: "all" } });
  }
  return (
    <div
      className="srch-bg"
      role="dialog"
      aria-modal="true"
      aria-label="Buscar na IANews"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="srch">
        <form className="srch-bar" onSubmit={go}>
          <Icon d={I.search} />
          <input
            ref={input}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar matérias e plataformas"
            aria-label="Buscar matérias e plataformas"
            autoComplete="off"
            maxLength={80}
          />
          <button className="srch-x" type="button" onClick={onClose}>
            Fechar
          </button>
        </form>
        <div className="srch-res">
          <h5>Atalhos</h5>
          <Link className="srch-it" to="/ranking" onClick={onClose}>
            <span>
              <b>Ranking IA</b>
              <small>As melhores plataformas de IA, atualizado todo dia</small>
            </span>
          </Link>
          <Link className="srch-it" to="/newsletter" onClick={onClose}>
            <span>
              <b>Newsletter</b>
              <small>O resumo de IA para quem decide, grátis</small>
            </span>
          </Link>
          <h5>Editorias</h5>
          {CATEGORY_SEO_LIST.slice(0, 6).map((c) => (
            <Link key={c.slug} className="srch-it" to="/categoria/$cat" params={{ cat: c.slug }} onClick={onClose}>
              <span>
                <b>{c.label}</b>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SiteHeader() {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const [ddOff, setDdOff] = useState(false);
  const { isAuthenticated } = useAuth();
  const { isAdmin } = useAdminAccess();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setMenu(false);
    setDdOff(true);
    const t = setTimeout(() => setDdOff(false), 300);
    return () => clearTimeout(t);
  }, [path]);

  const cur = (p: string) =>
    (p === "/noticias" ? /^\/(noticias|materia|categoria|guias|artigos)/.test(path) : path.startsWith(p))
      ? ("page" as const)
      : undefined;

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <>
      <header className="top" id="top">
        <div className="wrap top-in">
          <Link className="logo" to="/" aria-label="IANews, página inicial">
            <img src={logoWhite} alt="IANews" width={795} height={160} />
          </Link>
          <nav className="nav" aria-label="Seções">
            <div className={"nav-dd" + (ddOff ? " off" : "")}>
              <Link to="/noticias" search={{ q: "", cat: "all" }} aria-haspopup="true" aria-current={cur("/noticias")}>
                Notícias
              </Link>
              <div className="dd">
                <div>
                  <h5>Editorias</h5>
                  <div className="dd-cats">
                    {CATEGORY_SEO_LIST.map((c) => (
                      <Link key={c.slug} to="/categoria/$cat" params={{ cat: c.slug }}>
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </div>
                <div>
                  <h5>Temas</h5>
                  <div>
                    {HUB_LIST.map((h) => (
                      <Link key={h.slug} to="/guias/$hub" params={{ hub: h.slug }} search={{ q: "", tema: "all" }}>
                        {h.eyebrow || h.title}
                      </Link>
                    ))}
                    <Link to="/artigos/inteligencia-artificial-nas-empresas">IA nas empresas</Link>
                  </div>
                </div>
                <div className="dd-all">
                  <Link to="/noticias" search={{ q: "", cat: "all" }}>
                    Todas as notícias →
                  </Link>
                </div>
              </div>
            </div>
            <Link to="/ranking" aria-current={cur("/ranking")}>
              Ranking IA
            </Link>
            <Link to="/gente" aria-current={cur("/gente")}>
              Gente
            </Link>
            <Link to="/empresas" aria-current={cur("/empresas")}>
              Para empresas
            </Link>
            {isAdmin && (
              <Link to="/admin" aria-current={cur("/admin")}>
                Painel
              </Link>
            )}
          </nav>
          <div className="top-act">
            <button className="icon-btn" type="button" aria-label="Buscar" onClick={() => setSearch(true)}>
              <Icon d={I.search} />
            </button>
            {isAuthenticated ? (
              <Link className="top-pref" to="/habitos">
                Minha conta
              </Link>
            ) : (
              <Link className="top-pref" to="/auth">
                Entrar
              </Link>
            )}
            <button className="btn blue s" type="button" onClick={() => openSubscribeDialog("topo")}>
              <span className="cta-long">Assinar newsletter</span>
              <span className="cta-short">Assinar</span>
            </button>
            <button
              className="icon-btn"
              id="open-menu"
              type="button"
              aria-label={menu ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menu}
              aria-controls="menu"
              onClick={() => setMenu((m) => !m)}
            >
              <Icon d={menu ? I.x : I.menu} />
            </button>
          </div>
        </div>
        {menu && (
          <div className="menu" id="menu">
            <div className="wrap">
              <Link className="m" to="/noticias" search={{ q: "", cat: "all" }} aria-current={cur("/noticias")}>
                Notícias
              </Link>
              <Link className="m" to="/ranking" aria-current={cur("/ranking")}>
                Ranking IA
              </Link>
              <Link className="m" to="/gente" aria-current={cur("/gente")}>
                Gente
              </Link>
              <Link className="m" to="/empresas" aria-current={cur("/empresas")}>
                Para empresas
              </Link>
              <Link className="m" to="/newsletter" aria-current={cur("/newsletter")}>
                Newsletter
              </Link>
              <Link className="m" to="/anuncie" aria-current={cur("/anuncie")}>
                Anuncie
              </Link>
              {isAuthenticated ? (
                <>
                  <Link className="m" to="/habitos" aria-current={cur("/habitos")}>
                    Minha conta
                  </Link>
                  {isAdmin && (
                    <Link className="m" to="/admin">
                      Painel
                    </Link>
                  )}
                  <a
                    className="m"
                    href="/"
                    onClick={(e) => {
                      e.preventDefault();
                      void signOut();
                    }}
                  >
                    Sair
                  </a>
                </>
              ) : (
                <>
                  <Link className="m" to="/auth">
                    Entrar
                  </Link>
                  <Link className="m" to="/cadastro">
                    Criar conta
                  </Link>
                </>
              )}
              <h5>Editorias</h5>
              <div className="menu-cats">
                {CATEGORY_SEO_LIST.map((c) => (
                  <Link key={c.slug} to="/categoria/$cat" params={{ cat: c.slug }}>
                    {c.label}
                  </Link>
                ))}
              </div>
              <button
                className="btn blue"
                type="button"
                onClick={() => {
                  setMenu(false);
                  openSubscribeDialog("menu");
                }}
              >
                Assinar newsletter grátis
              </button>
            </div>
          </div>
        )}
      </header>
      {search && <SearchOverlay onClose={() => setSearch(false)} />}
    </>
  );
}
