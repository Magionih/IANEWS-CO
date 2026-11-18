import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  FGIA_DIRECT_URL,
  FGIA_FAQ,
  FGIA_INGRESSO_URL,
  FGIA_INSTAGRAM,
  FGIA_ONLINE_INICIO,
  FGIA_PROGRAMA,
  validateFgia,
  type FgiaErrors,
  type FgiaInput,
  type FgiaTipo,
} from "@/lib/fgia";
import { pixel } from "@/lib/pixel";

/* Landing page da FGIA Educação, o palco da IA News. Vende um passo por vez: ingresso do online (16/12),
   lista de espera do presencial em BH (11/02/2027), candidatura a palestrante e patrocínio. */

const Check = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A55C" strokeWidth="2">
    <path d="M5 12l5 5L20 7" />
  </svg>
);

function useCountdown(target: string) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (now === null) return { d: "--", h: "--", m: "--" };
  let diff = Math.max(0, new Date(target).getTime() - now);
  const d = Math.floor(diff / 86400000);
  diff -= d * 86400000;
  const h = Math.floor(diff / 3600000);
  diff -= h * 3600000;
  return { d: pad(d), h: pad(h), m: pad(Math.floor(diff / 60000)) };
}

function useUtm() {
  const [utm, setUtm] = useState<Record<string, string>>({});
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const out: Record<string, string> = {};
    for (const k of ["utm_source", "utm_medium", "utm_campaign"]) {
      const v = q.get(k);
      if (v) out[k] = v.slice(0, 80);
    }
    if (!out.utm_source && window.location.hostname.includes("fgiaeducacao")) out.utm_source = "fgiaeducacao.com.br";
    setUtm(out);
  }, []);
  return utm;
}

const EMPTY = (tipo: FgiaTipo): FgiaInput => ({
  tipo,
  nome: "",
  whatsapp: "",
  email: "",
  empresa: "",
  cargo: "",
  instagram: "",
  mensagem: "",
  consentimento: false,
});

function FgiaForm({ tipo, utm }: { tipo: FgiaTipo; utm: Record<string, string> }) {
  const [v, setV] = useState<FgiaInput>(EMPTY(tipo));
  const [hp, setHp] = useState("");
  const [errors, setErrors] = useState<FgiaErrors>({});
  const [state, setState] = useState<"idle" | "sending" | "ok" | "fail">("idle");
  const [failMsg, setFailMsg] = useState("");

  useEffect(() => {
    setV((p) => ({ ...p, tipo }));
    setErrors({});
    setState((s) => (s === "ok" ? "ok" : "idle"));
  }, [tipo]);

  const set = (k: keyof FgiaInput) => (e: { target: { value: string; checked?: boolean; type?: string } }) =>
    setV((p) => ({ ...p, [k]: e.target.type === "checkbox" ? !!e.target.checked : e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { errors: errs } = validateFgia(v);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setState("sending");
    try {
      const res = await fetch("/api/public/fgia", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...v, site: hp, ...utm }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; errors?: FgiaErrors; error?: string };
      if (res.ok && json.ok) {
        setState("ok");
        try {
          pixel("Lead", { content_name: `fgia_${tipo}` });
        } catch {
          /* sem pixel */
        }
        return;
      }
      if (json.errors) setErrors(json.errors);
      setFailMsg(json.error ?? "Confira os campos e tente de novo.");
      setState("fail");
    } catch {
      setFailMsg("Sem conexão agora. Tente de novo em instantes.");
      setState("fail");
    }
  };

  if (state === "ok") {
    const msg: Record<FgiaTipo, [string, string]> = {
      lista_bh: ["Você está na", "Quando a pré-venda de BH abrir, você fica sabendo primeiro, pelo WhatsApp."],
      palestrar: ["Case recebido.", "A curadoria da IA News avalia e fala com você pelo WhatsApp."],
      patrocinio: ["Recebemos.", "O Henrique Magioni ou a equipe da IA News falam com você pelo WhatsApp."],
    };
    return (
      <div className="fg-ok" role="status">
        <div className="fg-serif">
          {tipo === "lista_bh" ? (
            <>
              {msg[tipo][0]} <i>lista.</i>
            </>
          ) : (
            msg[tipo][0]
          )}
        </div>
        <p className="fg-p" style={{ fontSize: 16 }}>
          {msg[tipo][1]}
        </p>
      </div>
    );
  }

  const field = (k: keyof FgiaInput, label: string, props: Record<string, unknown> = {}) => (
    <label className="fg-field">
      {label}
      <input value={v[k] as string} onChange={set(k)} aria-invalid={!!errors[k]} {...props} />
      {errors[k] ? <span className="err">{errors[k]}</span> : null}
    </label>
  );

  return (
    <form className="fg-form" onSubmit={submit} noValidate>
      <div className="fg-hp" aria-hidden="true">
        <label>
          Site
          <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} />
        </label>
      </div>
      {field("nome", "Nome completo", { autoComplete: "name", required: true })}
      {field("whatsapp", "WhatsApp com DDD", { type: "tel", inputMode: "tel", autoComplete: "tel", required: true })}
      {field("email", "E-mail", { type: "email", autoComplete: "email", required: true })}
      {field("empresa", tipo === "lista_bh" ? "Empresa (opcional)" : "Empresa", { autoComplete: "organization" })}
      {tipo !== "lista_bh" ? field("cargo", "Cargo", { autoComplete: "organization-title" }) : null}
      {tipo === "palestrar" ? field("instagram", "Instagram (opcional)", { placeholder: "@seuperfil" }) : null}
      {tipo !== "lista_bh" ? (
        <label className="fg-field">
          {tipo === "palestrar" ? "O seu case: o que a IA faz na empresa e qual foi o resultado" : "Mensagem (opcional)"}
          <textarea value={v.mensagem} onChange={set("mensagem")} aria-invalid={!!errors.mensagem} maxLength={800} />
          {errors.mensagem ? <span className="err">{errors.mensagem}</span> : null}
        </label>
      ) : null}
      <label className="fg-check">
        <input type="checkbox" checked={v.consentimento} onChange={set("consentimento")} />
        <span>
          Aceito receber contato da IA News e da FGIA Educação por WhatsApp e e-mail sobre os eventos. Posso sair quando
          quiser.
        </span>
      </label>
      {errors.consentimento ? <span className="fg-alert">{errors.consentimento}</span> : null}
      {state === "fail" ? (
        <span className="fg-alert" role="alert">
          {failMsg}
        </span>
      ) : null}
      <button type="submit" className="fg-btn fg-btn-gold" disabled={state === "sending"}>
        {state === "sending"
          ? "Enviando..."
          : tipo === "lista_bh"
            ? "Quero ser avisado"
            : tipo === "palestrar"
              ? "Enviar meu case"
              : "Quero conversar"}
      </button>
    </form>
  );
}

export function FgiaPage() {
  const cd = useCountdown(FGIA_ONLINE_INICIO);
  const utm = useUtm();
  const [open, setOpen] = useState(0);
  const [aba, setAba] = useState<"palestrar" | "patrocinio">("palestrar");
  const ingresso = useMemo(() => {
    const src = utm.utm_source;
    return src && src !== "fgiaeducacao.com.br"
      ? FGIA_INGRESSO_URL.replace("utm_medium=site", `utm_medium=site-${encodeURIComponent(src)}`)
      : FGIA_INGRESSO_URL;
  }, [utm]);

  return (
    <div className="fg">
      <header className="fg-header">
        <div className="fg-wrap">
          <a href="#topo" className="fg-brand" aria-label="FGIA Educação, início">
            FGIA <span className="bar" /> <span className="sub">EDUCAÇÃO</span>
          </a>
          <nav className="fg-nav" aria-label="Seções">
            <a href="#online">Online 16.12</a>
            <a href="#presencial">BH 11.02</a>
            <a href="#henrique">Anfitrião</a>
            <a href="#palestrar">Palestrar</a>
            <a href="#duvidas">Dúvidas</a>
          </nav>
          <a href={ingresso} className="fg-btn fg-btn-gold">
            Garantir ingresso
          </a>
        </div>
      </header>

      <main>
        <section id="topo" className="fg-wrap fg-hero">
          <div className="fg-stack" style={{ gap: 26 }}>
            <div className="fg-kick">
              <span className="rule" />O palco da IA News
            </div>
            <h1 className="fg-serif fg-h1">
              Quem faz, <i>ensina.</i>
            </h1>
            <p className="fg-lead">
              Eventos de inteligência artificial para empresários. Só sobe ao palco quem já colocou IA para trabalhar numa
              empresa, com curadoria da redação da IA News.
            </p>
            <div className="fg-ctas">
              <a href={ingresso} className="fg-btn fg-btn-gold">
                Ingresso do online · R$ 97
              </a>
              <a href="#presencial" className="fg-btn fg-btn-ghost">
                Lista de espera de BH
              </a>
            </div>
            <div className="fg-count" aria-label={`Faltam ${cd.d} dias, ${cd.h} horas e ${cd.m} minutos para o Palco online`}>
              <span style={{ fontSize: 14, color: "#9AA0AE", marginRight: 6 }}>Online em</span>
              <div className="box">
                <b>{cd.d}</b>
                <small>DIAS</small>
              </div>
              <div className="box">
                <b>{cd.h}</b>
                <small>HORAS</small>
              </div>
              <div className="box">
                <b>{cd.m}</b>
                <small>MIN</small>
              </div>
            </div>
          </div>
          <figure className="fg-photo" style={{ margin: 0 }}>
            <img src="/fgia/henrique.jpg" alt="Henrique Magioni, fundador da IA News e anfitrião dos eventos" width={724} height={905} />
            <figcaption>
              <b>Henrique Magioni</b>
              <br />
              Fundador da IA News e anfitrião dos eventos
            </figcaption>
          </figure>
        </section>

        <section className="fg-agenda" aria-label="Agenda">
          <div className="fg-wrap">
            <a href="#online">
              <span className="num">16.12</span>
              <span className="txt">
                <b>Palco IA News Online</b>
                <br />
                <span>Quarta · 19h às 20h30 · ingressos abertos</span>
              </span>
            </a>
            <a href="#presencial">
              <span className="num">11.02</span>
              <span className="txt">
                <b>Palco IA News · Belo Horizonte</b>
                <br />
                <span>Quinta · 2027 · presencial · lista de espera</span>
              </span>
            </a>
          </div>
        </section>

        <section id="online" className="fg-light">
          <div className="fg-wrap fg-section fg-two">
            <div className="fg-stack">
              <div className="fg-kick">Online e ao vivo · quarta, 16.12, 19h</div>
              <h2 className="fg-serif fg-h2">
                Raio-X 2026: o que deu certo com IA nas empresas <i>brasileiras</i>
              </h2>
              <p className="fg-p">
                Em 1h30, o Henrique Magioni abre o que funcionou de verdade quando empresas brasileiras colocaram IA para
                trabalhar, com três cases contados por quem fez, com números, e o que fazer em 2027.
              </p>
              <ol className="fg-prog">
                {FGIA_PROGRAMA.map((it) => (
                  <li key={it.t}>
                    <b>{it.t}</b>
                    <span>{it.s}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <div className="fg-ticket">
                <div className="fg-kick">Ingresso</div>
                <div className="price">R$ 97</div>
                <ul>
                  <li>
                    <Check />
                    Aula ao vivo com o Henrique Magioni
                  </li>
                  <li>
                    <Check />
                    Gravação por 30 dias
                  </li>
                  <li>
                    <Check />
                    Slides do Raio-X e Playbook IA 2027
                  </li>
                  <li>
                    <Check />
                    Sua pergunta na Mesa IA News
                  </li>
                  <li>
                    <Check />
                    Os R$ 97 viram crédito no presencial de BH
                  </li>
                </ul>
                <a href={ingresso} className="fg-btn fg-btn-gold">
                  Garantir meu ingresso
                </a>
                <div className="note">Pix, cartão ou boleto</div>
              </div>
            </div>
          </div>
        </section>

        <section id="presencial" className="fg-wrap fg-section fg-two center">
          <div className="fg-stack">
            <div className="fg-kick">Presencial · Belo Horizonte · quinta</div>
            <div className="fg-date">
              11.02<i className="fg-gold" style={{ fontStyle: "italic" }}>.27</i>
            </div>
            <h2 className="fg-serif" style={{ margin: 0, fontSize: "clamp(32px, 4vw, 48px)", lineHeight: 1.05 }}>
              O primeiro Palco IA News <i>presencial</i>
            </h2>
            <p className="fg-p">
              Uma tarde de cases, conversas e networking com empresários que usam IA no dia a dia. Local, valores e
              palestrantes serão anunciados em breve. Quem estiver no online de 16.12 compra primeiro.
            </p>
          </div>
          <div className="fg-card">
            <h3 className="fg-serif" style={{ margin: 0, fontSize: 34, fontWeight: 400 }}>
              Entre na lista de espera
            </h3>
            <FgiaForm tipo="lista_bh" utm={utm} />
          </div>
        </section>

        <section id="henrique" className="fg-light">
          <div className="fg-wrap fg-section fg-two center" style={{ gridTemplateColumns: "0.9fr 1.2fr" }}>
            <figure className="fg-photo2" style={{ margin: 0 }}>
              <img src="/fgia/henrique-microfone.jpg" alt="Henrique Magioni no microfone da IA News" width={1000} height={1333} loading="lazy" />
            </figure>
            <div className="fg-stack">
              <div className="fg-kick">Anfitrião</div>
              <h2 className="fg-serif fg-h2">
                Henrique <i>Magioni</i>
              </h2>
              <p className="fg-p">
                Fundador e CEO da IA News, o ecossistema de mídia sobre inteligência artificial com newsletter, portal e
                canais nas redes. Toda semana a redação conta a história de quem colocou IA para trabalhar no Brasil. No
                Palco, o Henrique abre esses bastidores ao vivo.
              </p>
              <div className="fg-ctas">
                <a href="https://www.instagram.com/henriquemagioni/" className="fg-btn fg-btn-line" target="_blank" rel="noopener">
                  @henriquemagioni
                </a>
                <a href="https://ianewsbr.com" className="fg-btn fg-btn-line" target="_blank" rel="noopener">
                  ianewsbr.com
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="palestrar" className="fg-wrap fg-section">
          <div className="fg-two">
            <div className="fg-stack">
              <div className="fg-kick">Palco aberto e patrocínio</div>
              <h2 className="fg-serif fg-h2">
                Colocou IA para trabalhar? <i>Suba no palco.</i>
              </h2>
              <p className="fg-p">
                A curadoria procura empresários e executivos com um case real para o Palco de BH. E empresas que querem a
                marca no palco têm espaço para a marca e tempo de fala no evento.
              </p>
              <a href={FGIA_DIRECT_URL} className="fg-btn fg-btn-ghost" style={{ alignSelf: "flex-start" }} target="_blank" rel="noopener">
                Prefere o Direct? Mande PALESTRA
              </a>
            </div>
            <div className="fg-card">
              <div className="fg-tabs" role="tablist" aria-label="Tipo de contato">
                <button type="button" role="tab" className="fg-tab" aria-selected={aba === "palestrar"} onClick={() => setAba("palestrar")}>
                  Quero palestrar
                </button>
                <button type="button" role="tab" className="fg-tab" aria-selected={aba === "patrocinio"} onClick={() => setAba("patrocinio")}>
                  Quero patrocinar
                </button>
              </div>
              <FgiaForm tipo={aba} utm={utm} />
            </div>
          </div>
          <div className="fg-crit">
            <div className="fg-card">
              <div className="n">01</div>
              <div className="t">IA funcionando na operação</div>
              <p>Um processo real de uma empresa, não um projeto de apresentação.</p>
            </div>
            <div className="fg-card">
              <div className="n">02</div>
              <div className="t">Números de antes e depois</div>
              <p>Tempo, custo, vendas ou atendimento: o que mudou e quanto.</p>
            </div>
            <div className="fg-card">
              <div className="n">03</div>
              <div className="t">Quem fez, contando como fez</div>
              <p>Os erros e as decisões, para quem assiste aplicar na própria empresa.</p>
            </div>
          </div>
        </section>

        <section id="duvidas" className="fg-wrap fg-section">
          <div className="fg-faq">
            <h2 className="fg-serif fg-h2" style={{ marginBottom: 28 }}>
              Dúvidas
            </h2>
            <div style={{ borderTop: "1px solid rgba(244,239,230,.15)" }}>
              {FGIA_FAQ.map((q, i) => (
                <div className="fg-faq-item" key={q.q}>
                  <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? -1 : i)}>
                    {q.q}
                    <span aria-hidden="true">{open === i ? "−" : "+"}</span>
                  </button>
                  {open === i ? <p>{q.a}</p> : null}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="fg-band">
          <div className="fg-wrap">
            <h2 className="fg-serif" style={{ margin: 0, fontSize: "clamp(36px, 4.5vw, 56px)", lineHeight: 1, flex: "999 1 480px" }}>
              16.12, às 19h. <i>Garanta o seu lugar.</i>
            </h2>
            <a href={ingresso} className="fg-btn fg-btn-dark">
              Ingresso · R$ 97
            </a>
          </div>
        </section>
      </main>

      <footer className="fg-footer">
        <div className="fg-wrap">
          <div className="fg-brand" style={{ fontSize: 18 }}>
            FGIA <span className="sub" style={{ letterSpacing: 0, fontSize: 14, fontWeight: 500, color: "#9AA0AE" }}>Educação® · o palco da IA News</span>
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <a href={FGIA_INSTAGRAM} target="_blank" rel="noopener">
              @fgiaeducacao
            </a>
            <a href="https://www.instagram.com/ianews.co/" target="_blank" rel="noopener">
              @ianews.co
            </a>
            <a href="https://ianewsbr.com/termos" target="_blank" rel="noopener">
              Termos e privacidade
            </a>
          </div>
        </div>
      </footer>

      <div className="fg-sticky">
        <a href={ingresso} className="fg-btn fg-btn-gold">
          Ingresso · R$ 97
        </a>
        <a href="#presencial" className="fg-btn fg-btn-ghost">
          Lista BH
        </a>
      </div>
    </div>
  );
}

export const FGIA_HEAD = {
  title: "FGIA Educação · Eventos de IA para empresários | Palco IA News",
  description:
    "Quem faz, ensina. Palco IA News Online em 16/12, às 19h (R$ 97), e o primeiro Palco presencial em Belo Horizonte, em 11/02/2027. Com Henrique Magioni, fundador da IA News.",
  fonts:
    "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap",
};

export function fgiaHead(url: string) {
  const image = "https://fgiaeducacao.com.br/fgia/og.jpg";
  const events = [
    {
      "@context": "https://schema.org",
      "@type": "Event",
      name: "Palco IA News Online: Raio-X 2026 da IA nas empresas brasileiras",
      startDate: "2026-12-16T19:00:00-03:00",
      endDate: "2026-12-16T20:30:00-03:00",
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      location: { "@type": "VirtualLocation", url: "https://ianewsbr.com/palco" },
      organizer: { "@type": "Organization", name: "FGIA Educação · IA News", url: "https://fgiaeducacao.com.br" },
      offers: { "@type": "Offer", price: "97", priceCurrency: "BRL", url: "https://ianewsbr.com/palco", availability: "https://schema.org/InStock" },
      image,
    },
    {
      "@context": "https://schema.org",
      "@type": "Event",
      name: "Palco IA News · Belo Horizonte",
      startDate: "2027-02-11",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      location: { "@type": "Place", name: "Belo Horizonte", address: { "@type": "PostalAddress", addressLocality: "Belo Horizonte", addressRegion: "MG", addressCountry: "BR" } },
      organizer: { "@type": "Organization", name: "FGIA Educação · IA News", url: "https://fgiaeducacao.com.br" },
      image,
    },
  ];
  return {
    meta: [
      { title: FGIA_HEAD.title },
      { name: "description", content: FGIA_HEAD.description },
      { property: "og:title", content: FGIA_HEAD.title },
      { property: "og:description", content: FGIA_HEAD.description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: image },
      { name: "theme-color", content: "#070B16" },
    ],
    links: [
      { rel: "canonical", href: url },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" as const },
      { rel: "stylesheet", href: FGIA_HEAD.fonts },
    ],
    scripts: events.map((e) => ({ type: "application/ld+json", children: JSON.stringify(e) })),
  };
}
