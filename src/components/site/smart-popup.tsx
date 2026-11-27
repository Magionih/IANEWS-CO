import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";

import { trackCta } from "@/lib/cta-tracking";
import { readPerfilLead, useSubscribed } from "@/components/site/portal-subscribe";
import {
  PopShell,
  markPopupDismissed,
  openSubscribeDialog,
  popupSnoozed,
} from "@/components/site/subscribe-dialog";

/* Pop-up estratégico: entende o interesse do visitante pelas páginas que ele visitou
   (pauta, anúncio, soluções para empresas, eventos, ranking, leitura) e oferece a próxima
   ação certa, uma vez por sessão, no momento de saída ou depois de um tempo de leitura.
   Nas páginas de formulário, oferece ajuda para concluir quando a pessoa ameaça sair. */

type Interesse = "pauta" | "anuncie" | "empresas" | "eventos" | "ranking" | "leitura" | "lista";
type Oferta = "pauta" | "anuncie" | "empresas" | "eventos" | "newsletter" | "newsletter-ranking";

const INT_KEY = "ianews_interesse";
const CONV_PREFIX = "ianews_conv_";
const SHOWN_KEY = "ianews_smart_shown";
const VIEWS_KEY = "ianews_session_views";
const PALCO_FIM = new Date("2026-12-16T20:30:00-03:00").getTime();

const HIDDEN = [
  "/admin",
  "/auth",
  "/cadastro",
  "/habitos",
  "/fgia",
  "/ingresso",
  "/palco/checkout",
  "/briefing",
  "/previa",
  "/confirmar",
  "/descadastrar",
  "/assinar",
  "/links",
];

function interesseDe(path: string): Interesse | null {
  if (path.startsWith("/pauta")) return "pauta";
  if (path.startsWith("/anuncie")) return "anuncie";
  if (path.startsWith("/empresas") && !path.startsWith("/empresas-de-ia")) return "empresas";
  if (path.startsWith("/eventos") || path.startsWith("/palco") || path.startsWith("/aula"))
    return "eventos";
  if (path.startsWith("/ranking") || path.startsWith("/empresas-de-ia")) return "ranking";
  if (path.startsWith("/lista100")) return "lista";
  if (path.startsWith("/materia/")) return "leitura";
  return null;
}

function lerInteresses(): Partial<Record<Interesse, number>> {
  try {
    return JSON.parse(localStorage.getItem(INT_KEY) ?? "{}") ?? {};
  } catch {
    return {};
  }
}

/** Registra que o visitante concluiu uma ação (pauta, mídia kit, pedido): a oferta some. */
export function markConverted(kind: "pauta" | "anuncie" | "empresas" | "eventos") {
  try {
    localStorage.setItem(CONV_PREFIX + kind, String(Date.now()));
  } catch {
    /* ignore */
  }
}

function converteu(kind: string) {
  try {
    return Boolean(localStorage.getItem(CONV_PREFIX + kind));
  } catch {
    return true;
  }
}

/** Escolhe a oferta pelo comportamento: página atual, páginas visitadas e perfil declarado. */
function escolher(path: string, subscribed: boolean): Oferta | null {
  const atual = interesseDe(path);
  const ints = lerInteresses();
  const palcoAberto = Date.now() < PALCO_FIM;

  // Na própria página do formulário: ajuda a concluir.
  if (atual === "pauta" || atual === "anuncie" || atual === "empresas")
    return converteu(atual) ? (subscribed ? null : "newsletter") : atual;

  // Quem já demonstrou interesse comercial em outra visita recebe a oferta certa.
  const fila: Oferta[] = [];
  if ((ints.anuncie ?? 0) > 0 && !converteu("anuncie")) fila.push("anuncie");
  if ((ints.pauta ?? 0) > 0 && !converteu("pauta")) fila.push("pauta");
  if ((ints.empresas ?? 0) > 0 && !converteu("empresas")) fila.push("empresas");
  if (palcoAberto && ((ints.eventos ?? 0) > 0 || atual === "eventos") && !converteu("eventos"))
    fila.push("eventos");
  if (fila.length) return fila[0];

  // Perfil declarado na newsletter.
  const perfil = readPerfilLead();
  if (perfil === "fornecedor" && !converteu("anuncie")) return "anuncie";
  if ((perfil === "empresario" || perfil === "executivo") && !converteu("pauta")) return "pauta";

  if (!subscribed) return atual === "ranking" ? "newsletter-ranking" : "newsletter";
  // Leitor fiel e já assinante: convida a contar a própria história.
  if ((ints.leitura ?? 0) >= 3 && !converteu("pauta")) return "pauta";
  return null;
}

const CONTEUDO: Record<
  Exclude<Oferta, "newsletter" | "newsletter-ranking">,
  {
    kick: string;
    titulo: string;
    texto: string;
    itens: string[];
    cta: string;
    to: "/pauta" | "/anuncie" | "/empresas" | "/palco";
    hash?: string;
    faces?: boolean;
  }
> = {
  pauta: {
    kick: "Sua empresa na IA News",
    titulo: "Sua empresa usa IA? A próxima história pode ser a sua",
    texto:
      "Envie sua pauta em 3 minutos. A redação lê todas e responde em até 2 dias úteis, pelo WhatsApp ou e-mail.",
    itens: [
      "Matéria no portal e no Google",
      "Post em collab no Instagram",
      "Entra na newsletter das 7h",
    ],
    cta: "Enviar minha pauta",
    to: "/pauta",
    hash: "enviar",
    faces: true,
  },
  anuncie: {
    kick: "Mídia kit IA News",
    titulo: "Fale com quem decide sobre IA nas empresas",
    texto:
      "1 milhão de visualizações em 30 dias e 108 mil seguidores. Receba o mídia kit com as vagas do mês.",
    itens: [
      "Conteúdo em collab, aprovado por você",
      "7 canais, do Instagram à newsletter",
      "Planos a partir de R$ 350",
    ],
    cta: "Receber o mídia kit",
    to: "/anuncie",
    hash: "midia-kit",
  },
  empresas: {
    kick: "Para empresas",
    titulo: "Coloque IA para rodar na sua operação",
    texto:
      "Conte em 2 minutos o que você quer resolver. O time da IA News responde com o caminho e o próximo passo.",
    itens: ["Implementação em sprint", "Conteúdo com IA em escala", "Treinamento de equipes"],
    cta: "Falar com o time",
    to: "/empresas",
  },
  eventos: {
    kick: "Ao vivo · 16/12 · 19h",
    titulo: "Palco IA News Online: o Raio-X 2026 da IA nas empresas",
    texto:
      "Casos reais, o Playbook IA 2027 e a revelação ao vivo da Lista IA News 100. Gravação por 30 dias.",
    itens: [
      "R$ 97, vira crédito no presencial de BH",
      "Garantia de 7 dias",
      "Online, de qualquer lugar",
    ],
    cta: "Garantir minha vaga",
    to: "/palco",
  },
};

const FACES = [
  "/gente/tarciana.jpg",
  "/gente/diego.jpg",
  "/gente/monica-retrato.jpg",
  "/gente/luis.jpg",
];

export function SmartPopup() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const subscribed = useSubscribed();
  const [oferta, setOferta] = useState<Oferta | null>(null);
  const fired = useRef(false);

  // Memória de interesse: conta as páginas que a pessoa visitou.
  useEffect(() => {
    const it = interesseDe(pathname);
    try {
      const n = Number(sessionStorage.getItem(VIEWS_KEY) ?? 0) + 1;
      sessionStorage.setItem(VIEWS_KEY, String(n));
      if (it) {
        const ints = lerInteresses();
        ints[it] = (ints[it] ?? 0) + 1;
        localStorage.setItem(INT_KEY, JSON.stringify(ints));
      }
    } catch {
      /* ignore */
    }
  }, [pathname]);

  useEffect(() => {
    if (HIDDEN.some((p) => pathname.startsWith(p))) return;
    if (typeof window === "undefined" || window.location.hostname.includes("fgiaeducacao")) return;
    try {
      if (sessionStorage.getItem(SHOWN_KEY)) return;
    } catch {
      return;
    }
    if (popupSnoozed()) return;

    const atual = interesseDe(pathname);
    const naPaginaDeForm = atual === "pauta" || atual === "anuncie" || atual === "empresas";
    const mobile = window.matchMedia("(max-width: 820px)").matches;
    let interagiu = false;
    let scrolled = 0;

    const digitando = () => {
      const el = document.activeElement;
      return (
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")
      );
    };

    const fire = (gatilho: string) => {
      if (fired.current || digitando()) return;
      if (naPaginaDeForm && interagiu) return; // está preenchendo: não atrapalha
      const escolhida = escolher(pathname, subscribed);
      if (!escolhida) return;
      fired.current = true;
      try {
        sessionStorage.setItem(SHOWN_KEY, escolhida);
      } catch {
        /* ignore */
      }
      trackCta({
        event: "impression",
        placement: "smart-popup",
        variant: `${escolhida}-${gatilho}`,
      });
      if (escolhida === "newsletter" || escolhida === "newsletter-ranking") {
        openSubscribeDialog(`smart-${escolhida}-${gatilho}`);
        return;
      }
      setOferta(escolhida);
    };

    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) fire("saida");
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) interagiu = true;
    };
    const onScroll = () => {
      const doc = document.documentElement;
      const total = Math.max(1, doc.scrollHeight - window.innerHeight);
      scrolled = Math.max(scrolled, window.scrollY / total);
    };

    // Tempo de leitura antes da oferta: menor em quem já navegou por mais páginas.
    let views = 1;
    try {
      views = Number(sessionStorage.getItem(VIEWS_KEY) ?? 1);
    } catch {
      /* ignore */
    }
    const espera = naPaginaDeForm ? 40000 : views >= 3 ? 20000 : mobile ? 45000 : 60000;
    const timer = window.setInterval(() => {
      if (!naPaginaDeForm && mobile && scrolled < 0.35) return;
      fire("tempo");
    }, espera);

    document.addEventListener("mouseout", onLeave);
    document.addEventListener("focusin", onFocusIn);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("mouseout", onLeave);
      document.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname, subscribed]);

  if (!oferta || oferta === "newsletter" || oferta === "newsletter-ranking") return null;
  const c = CONTEUDO[oferta];
  const aqui = pathname.startsWith(c.to);

  const fechar = () => {
    markPopupDismissed();
    trackCta({ event: "click", placement: "smart-popup", variant: `${oferta}-fechar` });
    setOferta(null);
  };

  const irParaForm = () => {
    trackCta({ event: "click", placement: "smart-popup", variant: `${oferta}-cta` });
    setOferta(null);
    const alvo = document.getElementById(c.hash ?? "") ?? document.querySelector("form");
    alvo?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      const campo = (alvo ?? document).querySelector<HTMLElement>("input:not(.hp), textarea");
      campo?.focus({ preventScroll: true });
    }, 500);
  };

  return (
    <PopShell onClose={fechar} labelledBy="smart-title">
      <div className="sp">
        {c.faces ? (
          <div className="sp-faces" aria-hidden="true">
            {FACES.map((f) => (
              <img key={f} src={f} alt="" width={44} height={44} loading="lazy" />
            ))}
          </div>
        ) : null}
        <p className="kick">{aqui ? "Falta pouco" : c.kick}</p>
        <h2 id="smart-title">{c.titulo}</h2>
        <p className="lead-p">{c.texto}</p>
        <ul className="ticks small">
          {c.itens.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
        {aqui ? (
          <button className="btn blue wide" type="button" onClick={irParaForm}>
            {c.cta}
          </button>
        ) : (
          <Link
            className="btn blue wide"
            to={c.to}
            hash={c.hash}
            onClick={() => {
              trackCta({ event: "click", placement: "smart-popup", variant: `${oferta}-cta` });
              setOferta(null);
            }}
          >
            {c.cta}
          </Link>
        )}
      </div>
    </PopShell>
  );
}
