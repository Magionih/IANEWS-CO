import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { submitContactMessage } from "@/lib/contact.functions";
import { NewsletterOptIn, wantsNewsletter } from "@/components/site/newsletter-opt-in";
import { metaCtx, novoEventId, pixel } from "@/lib/pixel";
import { markConverted } from "@/components/site/smart-popup";
import { trackCta } from "@/lib/cta-tracking";
import { LayoutGrid, Newspaper, ShieldCheck, UserPlus } from "lucide-react";

export const Route = createFileRoute("/anuncie")({
  head: () => ({
    meta: [
      { title: "Anuncie no IA News — mídia para quem decide sobre IA" },
      {
        name: "description",
        content:
          "Planos de publicidade da IA News: destaque, Presença, Autoridade e Patrocínio, com conteúdo editorial em collab nos 7 canais.",
      },
      { property: "og:title", content: "Anuncie no IA News" },
      {
        property: "og:description",
        content:
          "Conteúdo editorial em collab para marcas que querem estar na conversa sobre IA nos negócios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://ianewsbr.com/anuncie" },
    ],
    links: [{ rel: "canonical", href: "https://ianewsbr.com/anuncie" }],
  }),
  component: AnunciePage,
});

/* Os valores não ficam públicos: vão no mídia kit, depois do contato. */
const FORMATS = [
  {
    nome: "Destaque",
    tipo: "Ação pontual",
    text: "Matéria exclusiva de destaque no portal, capa em collab no Instagram e link nos stories.",
  },
  {
    nome: "Presença",
    tipo: "1 mês",
    text: "Matéria de destaque com carrossel em collab, 1 Reels e 1 sequência de stories com link.",
  },
  {
    nome: "Autoridade",
    tipo: "Mensal",
    text: "Carrossel em collab, 3 Reels, 2 posts no feed e 4 sequências de stories, nos 7 canais.",
  },
  {
    nome: "Patrocínio",
    tipo: "Mensal",
    text: "Série “apresentada por” a sua marca, exclusividade de categoria e edição dedicada da newsletter.",
  },
];

const AUDIENCE = [
  { value: "1 mi+", label: "visualizações em 30 dias" },
  { value: "340 mil", label: "contas alcançadas em 30 dias" },
  { value: "108,8 mil", label: "seguidores no Instagram" },
];

const REASONS = [
  {
    icon: Newspaper,
    title: "Conteúdo, não banner",
    text: "Sua marca entra numa matéria da redação, lida como notícia.",
  },
  {
    icon: UserPlus,
    title: "Gente nova a cada post",
    text: "55% das visualizações vêm de quem ainda não segue o perfil.",
  },
  {
    icon: ShieldCheck,
    title: "Você aprova antes",
    text: "Nada vai ao ar sem a sua aprovação, sinalizado como parceria.",
  },
  {
    icon: LayoutGrid,
    title: "Sete canais",
    text: "Instagram, Facebook, LinkedIn, Threads, portal, newsletter e WhatsApp.",
  },
];

const FATURAMENTO = [
  "Até R$ 500 mil",
  "R$ 500 mil a R$ 2 milhões",
  "R$ 2 a R$ 10 milhões",
  "Mais de R$ 10 milhões",
];

const OBJETIVOS = [
  "Gerar leads e vendas",
  "Fortalecer a marca",
  "Lançar produto ou serviço",
  "Patrocinar eventos",
];

const EMPTY = { name: "", email: "", phone: "", company: "", fat: "", message: "" };

function AnunciePage() {
  const [form, setForm] = useState(EMPTY);
  const [goal, setGoal] = useState("");
  const [formato, setFormato] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function escolherFormato(nome: string) {
    setFormato(nome);
    trackCta({ event: "click", placement: "anuncie-formatos", variant: nome });
    document.getElementById("midia-kit")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.getElementById("name")?.focus({ preventScroll: true }), 450);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newsletter = wantsNewsletter(e);
    if (form.name.trim().length < 2) return toast.error("Informe seu nome.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()))
      return toast.error("Informe um e-mail válido.");
    setLoading(true);
    try {
      const eventId = novoEventId("anuncie");
      const message = [
        `Objetivo: ${goal || "Não informado"}`,
        `Formato de interesse: ${formato || "Não definido"}`,
        `Faturamento anual: ${form.fat || "Não informado"}`,
        "",
        form.message.trim() || "Sem mensagem adicional.",
      ].join("\n");
      await submitContactMessage({
        data: {
          meta: metaCtx(eventId),
          newsletter,
          kind: "anuncie",
          full_name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
          budget: form.fat ? `Faturamento: ${form.fat}` : "",
          subject: `Mídia kit${formato ? ` · ${formato}` : ""}`,
          message,
        },
      });
      pixel(
        "Lead",
        { content_name: "Publicidade IA News", content_category: "publicidade" },
        eventId,
      );
      markConverted("anuncie");
      trackCta({ event: "convert", placement: "anuncie-form", variant: formato || "sem-formato" });
      setDone(true);
      setForm(EMPTY);
      setGoal("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="page an2">
        <section className="an2-hero">
          <div className="wrap an2-grid">
            <div className="an2-copy">
              <p className="kick">Mídia IA News</p>
              <h1>Anuncie para quem decide sobre IA nas empresas</h1>
              <p className="sub">
                Sua marca entra na conversa com conteúdo editorial em collab, aprovado por você
                antes de ir ao ar.
              </p>
              <div className="an2-stats">
                {AUDIENCE.map((a) => (
                  <div key={a.label}>
                    <b className="num">{a.value}</b>
                    <span>{a.label}</span>
                  </div>
                ))}
              </div>
              <ul className="an2-why">
                {REASONS.map((r) => (
                  <li key={r.title}>
                    <span aria-hidden="true">
                      <r.icon />
                    </span>
                    <p>
                      <b>{r.title}.</b> {r.text}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="biz-card an2-card" id="midia-kit">
              {done ? (
                <div className="biz-done" role="status">
                  <span className="ok-mark" aria-hidden="true">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m5 12.5 4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                  <h2>Pedido recebido</h2>
                  <p>
                    O Henrique Magioni, da IA News, retorna com o mídia kit, as vagas do mês e o
                    plano que faz sentido para a sua marca.
                  </p>
                  <div className="actions">
                    <Link className="btn line" to="/noticias" search={{}}>
                      Ver o conteúdo da IA News
                    </Link>
                  </div>
                </div>
              ) : (
                <form className="biz-form an2-form" onSubmit={onSubmit} noValidate>
                  <div>
                    <h2 className="an2-ft">Receba o mídia kit</h2>
                    <p className="fine">
                      Resposta com as vagas do mês e o plano certo para a marca.
                    </p>
                  </div>

                  <fieldset>
                    <legend className="step-l">
                      <i>1</i>Seus dados
                    </legend>
                    <div className="biz-fields">
                      <label className="f" htmlFor="name">
                        Nome
                        <input
                          className="field"
                          id="name"
                          required
                          maxLength={160}
                          autoComplete="name"
                          value={form.name}
                          onChange={(e) => set("name", e.target.value)}
                          placeholder="Seu nome"
                        />
                      </label>
                      <label className="f" htmlFor="company">
                        Empresa
                        <input
                          className="field"
                          id="company"
                          maxLength={160}
                          autoComplete="organization"
                          value={form.company}
                          onChange={(e) => set("company", e.target.value)}
                          placeholder="Empresa ou agência"
                        />
                      </label>
                      <label className="f" htmlFor="email">
                        E-mail
                        <input
                          className="field"
                          id="email"
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          required
                          maxLength={255}
                          value={form.email}
                          onChange={(e) => set("email", e.target.value)}
                          placeholder="voce@empresa.com"
                        />
                      </label>
                      <label className="f" htmlFor="phone">
                        WhatsApp
                        <input
                          className="field"
                          id="phone"
                          type="tel"
                          autoComplete="tel"
                          maxLength={30}
                          value={form.phone}
                          onChange={(e) => set("phone", e.target.value)}
                          placeholder="(11) 99999-0000"
                        />
                      </label>
                    </div>
                  </fieldset>

                  <fieldset>
                    <legend className="step-l">
                      <i>2</i>Sobre a campanha
                    </legend>
                    <div className="an2-sels">
                      <label className="f" htmlFor="an-fat">
                        Faturamento anual da empresa
                        <select
                          id="an-fat"
                          className="field an2-select"
                          value={form.fat}
                          onChange={(e) => set("fat", e.target.value)}
                        >
                          <option value="">Selecione a faixa</option>
                          {FATURAMENTO.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="f" htmlFor="an-goal">
                        Objetivo principal
                        <select
                          id="an-goal"
                          className="field an2-select"
                          value={goal}
                          onChange={(e) => setGoal(e.target.value)}
                        >
                          <option value="">Selecione o objetivo</option>
                          {OBJETIVOS.map((g) => (
                            <option key={g} value={g}>
                              {g}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="f full" htmlFor="an-fmt">
                        Formato de interesse
                        <select
                          id="an-fmt"
                          className="field an2-select"
                          value={formato}
                          onChange={(e) => setFormato(e.target.value)}
                        >
                          <option value="">Ainda não sei, quero uma recomendação</option>
                          {FORMATS.map((f) => (
                            <option key={f.nome} value={f.nome}>
                              {f.nome} · {f.tipo}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label className="f" htmlFor="message" style={{ marginTop: 12 }}>
                      <span>
                        Algo mais? <small className="pt-opt">opcional</small>
                      </span>
                      <textarea
                        className="field"
                        id="message"
                        maxLength={4000}
                        rows={3}
                        value={form.message}
                        onChange={(e) => set("message", e.target.value)}
                        placeholder="Público, período ou produto que quer divulgar."
                      />
                    </label>
                  </fieldset>

                  <NewsletterOptIn />
                  <div className="biz-submit">
                    <button className="btn blue" type="submit" disabled={loading}>
                      {loading ? "Enviando..." : "Quero o mídia kit"}
                    </button>
                    <span className="fine">
                      Mensagens para a redação vão pela página de <Link to="/contato">Contato</Link>
                      .
                    </span>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        <div className="wrap">
          <section className="pt-sec" aria-labelledby="an2-fm">
            <div className="sec-head">
              <h2 id="an2-fm">Formatos</h2>
              <p className="lede">Valores e vagas do mês vão no mídia kit</p>
            </div>
            <div className="an2-plans">
              {FORMATS.map((f) => (
                <div key={f.nome} className={"an2-plan" + (formato === f.nome ? " on" : "")}>
                  <span className="an2-pn">{f.tipo}</span>
                  <b>{f.nome}</b>
                  <p>{f.text}</p>
                  <button
                    type="button"
                    className="btn line s"
                    onClick={() => escolherFormato(f.nome)}
                  >
                    Solicitar proposta
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
