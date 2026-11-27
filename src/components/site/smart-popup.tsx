import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";

import { trackCta } from "@/lib/cta-tracking";
import { LISTA } from "@/lib/inscricao";
import {
  PortalSubscribeForm,
  readPerfilLead,
  useSubscribed,
} from "@/components/site/portal-subscribe";
import {
  PopShell,
  markPopupDismissed,
  openSubscribeDialog,
  popupSnoozed,
} from "@/components/site/subscribe-dialog";

/* Pop-ups estratégicos ao longo da navegação.
   1. Entende o interesse do visitante pelas páginas que ele visitou (pauta, anúncio, soluções,
      eventos, Lista 100, ranking, leitura) e pelo perfil que declarou ao assinar a newsletter.
   2. Monta uma fila de ofertas e mostra uma de cada vez, sem repetir na mesma visita.
   3. A primeira oferta da visita (ou na saída da página) aparece como pop-up central;
      as seguintes entram como cartão no canto, que não bloqueia a leitura.
   Ritmo: até 4 ofertas por visita, com pelo menos 75 segundos entre uma e outra. */

type Interesse = "pauta" | "anuncie" | "empresas" | "eventos" | "ranking" | "leitura" | "lista";
type Oferta =
  | "pauta"
  | "anuncie"
  | "empresas"
  | "eventos"
  | "lista"
  | "whatsapp"
  | "newsletter"
  | "newsletter-ranking";

const INT_KEY = "ianews_interesse";
const CONV_PREFIX = "ianews_conv_";
const SESSAO_KEY = "ianews_sp_sessao";
const VIEWS_KEY = "ianews_session_views";
const PALCO_FIM = new Date("2026-12-16T20:30:00-03:00").getTime();
const LISTA_FIM = new Date(LISTA.fechaIso).getTime();
const WHATSAPP_URL = "https://chat.whatsapp.com/Is5edILjICj0D2MMHUmGbL";

const MAX_POR_VISITA = 4;
const INTERVALO_MS = 75_000;

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

type Sessao = { n: number; last: number; vistos: Oferta[] };

function lerSessao(): Sessao {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSAO_KEY) ?? "null") as Sessao | null;
    if (s && typeof s.n === "number") return s;
  } catch {
    /* ignore */
  }
  return { n: 0, last: 0, vistos: [] };
}

function gravarSessao(s: Sessao) {
  try {
    sessionStorage.setItem(SESSAO_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Registra que o visitante concluiu uma ação (pauta, mídia kit, pedido): a oferta some. */
export function markConverted(kind: "pauta" | "anuncie" | "empresas" | "eventos" | "lista") {
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

/** Fila de ofertas pelo comportamento: página atual, páginas visitadas e perfil declarado. */
function fila(path: string, subscribed: boolean): Oferta[] {
  const atual = interesseDe(path);
  const ints = lerInteresses();
  const agora = Date.now();
  const palco = agora < PALCO_FIM && !converteu("eventos");
  const lista = agora < LISTA_FIM && !converteu("lista");
  const out: Oferta[] = [];
  const add = (o: Oferta | false) => {
    if (o && !out.includes(o)) out.push(o);
  };

  // 1. Na página do formulário: ajuda a concluir.
  if ((atual === "pauta" || atual === "anuncie" || atual === "empresas") && !converteu(atual))
    add(atual);

  // 2. Interesse comercial demonstrado em outra página e ainda não concluído.
  if ((ints.anuncie ?? 0) > 0 && !converteu("anuncie")) add("anuncie");
  if ((ints.pauta ?? 0) > 0 && !converteu("pauta")) add("pauta");
  if ((ints.empresas ?? 0) > 0 && !converteu("empresas")) add("empresas");
  if (((ints.eventos ?? 0) > 0 || atual === "eventos") && palco) add("eventos");
  if (((ints.lista ?? 0) > 0 || atual === "lista") && lista) add("lista");

  // 3. Quem ainda não assina: a newsletter é a base de tudo.
  if (!subscribed) add(atual === "ranking" ? "newsletter-ranking" : "newsletter");

  // 4. Perfil declarado na newsletter.
  const perfil = readPerfilLead();
  if (perfil === "fornecedor") {
    add(!converteu("anuncie") && "anuncie");
    add(palco && "eventos");
  }
  if (perfil === "empresario" || perfil === "executivo") {
    add(!converteu("pauta") && "pauta");
    add(!converteu("empresas") && "empresas");
    add(palco && "eventos");
  }
  if (perfil === "profissional" || perfil === "investidor" || perfil === "estudante") {
    add(palco && "eventos");
    add(lista && "lista");
  }

  // 5. Leitor que já navegou bastante: participação e comunidade.
  if ((ints.leitura ?? 0) >= 2 && !converteu("pauta")) add("pauta");
  add(palco && "eventos");
  add(lista && "lista");
  add("whatsapp");
  return out;
}

type Conteudo = {
  kick: string;
  titulo: string;
  texto: string;
  itens: string[];
  cta: string;
  to?: "/pauta" | "/anuncie" | "/empresas" | "/palco" | "/lista100";
  hash?: string;
  href?: string;
  faces?: boolean;
  form?: boolean;
};

const CONTEUDO: Record<Exclude<Oferta, "newsletter" | "newsletter-ranking">, Conteudo> & {
  "newsletter-card": Conteudo;
} = {
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
      "Proposta sob medida para a sua marca",
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
    itens: ["Vira crédito no presencial de BH", "Garantia de 7 dias", "Online, de qualquer lugar"],
    cta: "Garantir minha vaga",
    to: "/palco",
  },
  lista: {
    kick: `Lista IA News 100 · até ${LISTA.fecha}`,
    titulo: "Quem faz a IA acontecer no Brasil? Indique um nome",
    texto: "Os 100 nomes da Lista IA News 100 serão revelados ao vivo no Palco de 16/12.",
    itens: ["Indicação gratuita", "Vale indicar a si mesmo", "Avaliação pela redação"],
    cta: "Indicar um nome",
    to: "/lista100",
    hash: "candidatura",
    faces: true,
  },
  whatsapp: {
    kick: "Comunidade IA News",
    titulo: "Os destaques de IA do dia no seu WhatsApp",
    texto: "Entre no grupo da IA News e receba as principais notícias direto no celular.",
    itens: ["Gratuito", "Só o que importa", "Saia quando quiser"],
    cta: "Entrar no grupo",
    href: WHATSAPP_URL,
  },
  "newsletter-card": {
    kick: "Newsletter IA News",
    titulo: "Receba as notícias de IA às 7h",
    texto: "5 minutos por dia, grátis. O que importa para o seu negócio, sem hype.",
    itens: [],
    cta: "Assinar grátis",
    form: true,
  },
};

const FACES = [
  "/gente/tarciana.jpg",
  "/gente/diego.jpg",
  "/gente/monica-retrato.jpg",
  "/gente/luis.jpg",
];

type Ativa = { oferta: Oferta; formato: "modal" | "cartao" };

export function SmartPopup() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const subscribed = useSubscribed();
  const [ativa, setAtiva] = useState<Ativa | null>(null);
  const ativaRef = useRef<Ativa | null>(null);
  ativaRef.current = ativa;

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

  // O cartão do canto fecha sozinho ao trocar de página (conta como visto).
  useEffect(() => {
    if (ativaRef.current?.formato === "cartao") setAtiva(null);
  }, [pathname]);

  useEffect(() => {
    if (HIDDEN.some((p) => pathname.startsWith(p))) return;
    if (typeof window === "undefined" || window.location.hostname.includes("fgiaeducacao")) return;

    const atual = interesseDe(pathname);
    const naPaginaDeForm = atual === "pauta" || atual === "anuncie" || atual === "empresas";
    const mobile = window.matchMedia("(max-width: 820px)").matches;
    const entrouEm = Date.now();
    let interagiu = false;
    let scrolled = 0;

    const digitando = () => {
      const el = document.activeElement;
      return (
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")
      );
    };

    const fire = (gatilho: "tempo" | "saida" | "rolagem") => {
      if (ativaRef.current || digitando() || popupSnoozed()) return;
      if (document.querySelector(".pop-bg, .rkd-bg, [role='dialog'][data-state='open']")) return;
      if (naPaginaDeForm && interagiu) return; // está preenchendo: não atrapalha
      const sessao = lerSessao();
      if (sessao.n >= MAX_POR_VISITA) return;
      if (sessao.last && Date.now() - sessao.last < INTERVALO_MS) return;
      const oferta = fila(pathname, subscribed).find((o) => !sessao.vistos.includes(o));
      if (!oferta) return;
      const formato: Ativa["formato"] = sessao.n === 0 || gatilho === "saida" ? "modal" : "cartao";
      gravarSessao({ n: sessao.n + 1, last: Date.now(), vistos: [...sessao.vistos, oferta] });
      trackCta({
        event: "impression",
        placement: "smart-popup",
        variant: `${oferta}-${formato}-${gatilho}`,
      });
      if (formato === "modal" && (oferta === "newsletter" || oferta === "newsletter-ranking")) {
        openSubscribeDialog(`smart-${oferta}-${gatilho}`);
        return;
      }
      setAtiva({ oferta, formato });
    };

    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) fire("saida");
    };
    const onFocusIn = (e: FocusEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT"))
        interagiu = true;
    };
    const onScroll = () => {
      const doc = document.documentElement;
      const total = Math.max(1, doc.scrollHeight - window.innerHeight);
      scrolled = Math.max(scrolled, window.scrollY / total);
      // Quem leu boa parte da página recebe a próxima oferta (respeitando o intervalo).
      if (scrolled > 0.6 && Date.now() - entrouEm > 15_000) fire("rolagem");
    };

    // Tempo na página antes da oferta: menor para quem já navegou por mais páginas.
    let views = 1;
    try {
      views = Number(sessionStorage.getItem(VIEWS_KEY) ?? 1);
    } catch {
      /* ignore */
    }
    const primeira = lerSessao().n === 0;
    const espera = naPaginaDeForm ? 35_000 : primeira ? (views >= 3 ? 15_000 : 25_000) : 20_000;
    const timer = window.setInterval(() => {
      if (Date.now() - entrouEm < espera) return;
      if (!naPaginaDeForm && mobile && scrolled < 0.25) return;
      fire("tempo");
    }, 5_000);

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

  if (!ativa) return null;
  const chave =
    ativa.oferta === "newsletter" || ativa.oferta === "newsletter-ranking"
      ? "newsletter-card"
      : ativa.oferta;
  const c = CONTEUDO[chave];
  const aqui = !!c.to && pathname.startsWith(c.to);

  const fechar = () => {
    markPopupDismissed();
    const s = lerSessao();
    gravarSessao({ ...s, last: Date.now() });
    trackCta({ event: "click", placement: "smart-popup", variant: `${ativa.oferta}-fechar` });
    setAtiva(null);
  };

  const clicou = () => {
    trackCta({ event: "click", placement: "smart-popup", variant: `${ativa.oferta}-cta` });
    setAtiva(null);
  };

  const irParaForm = () => {
    clicou();
    const alvo = document.getElementById(c.hash ?? "") ?? document.querySelector("form");
    alvo?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      const campo = (alvo ?? document).querySelector<HTMLElement>("input:not(.hp), textarea");
      campo?.focus({ preventScroll: true });
    }, 500);
  };

  const botao = c.form ? (
    <PortalSubscribeForm
      placement={`smart-${ativa.formato}`}
      button={c.cta}
      layout={ativa.formato === "modal" ? "stack" : "row"}
      wideButton={ativa.formato === "modal"}
    />
  ) : c.href ? (
    <a
      className="btn blue wide"
      href={c.href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={clicou}
    >
      {c.cta}
    </a>
  ) : aqui ? (
    <button className="btn blue wide" type="button" onClick={irParaForm}>
      {c.cta}
    </button>
  ) : (
    <Link className="btn blue wide" to={c.to!} hash={c.hash} onClick={clicou}>
      {c.cta}
    </Link>
  );

  if (ativa.formato === "cartao") {
    return (
      <aside className="sp-card" role="complementary" aria-labelledby="sp-card-t">
        <button className="sp-card-x" type="button" aria-label="Fechar" onClick={fechar}>
          <X aria-hidden="true" />
        </button>
        {c.faces ? (
          <div className="sp-faces sm" aria-hidden="true">
            {FACES.map((f) => (
              <img key={f} src={f} alt="" width={32} height={32} loading="lazy" />
            ))}
          </div>
        ) : null}
        <p className="kick">{aqui ? "Falta pouco" : c.kick}</p>
        <p className="sp-card-t" id="sp-card-t">
          {c.titulo}
        </p>
        <p className="sp-card-d">{c.texto}</p>
        {botao}
      </aside>
    );
  }

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
        {c.itens.length ? (
          <ul className="ticks small">
            {c.itens.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        ) : null}
        <div className="sp-cta">{botao}</div>
      </div>
    </PopShell>
  );
}
