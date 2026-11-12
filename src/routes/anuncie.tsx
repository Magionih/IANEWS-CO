import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { submitContactMessage } from "@/lib/contact.functions";
import { NewsletterOptIn, wantsNewsletter } from "@/components/site/newsletter-opt-in";
import { metaCtx, novoEventId, pixel } from "@/lib/pixel";

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

const FORMATS = [
  {
    title: "Destaque · R$ 350",
    text: "Matéria exclusiva de destaque no portal, capa em collab no Instagram e link nos stories. Bom para começar.",
  },
  {
    title: "Presença · R$ 1.050 por 1 mês",
    text: "Matéria de destaque com carrossel em collab, 1 Reels e 1 sequência de stories com link.",
  },
  {
    title: "Autoridade · R$ 2.490 por mês",
    text: "Matéria com carrossel em collab, 3 Reels, 2 posts no feed e 4 sequências de stories, nos 7 canais, nos horários de maior audiência.",
  },
  {
    title: "Patrocínio · R$ 5.900 por mês",
    text: "Série \u201capresentada por\u201d a sua marca, exclusividade de categoria e edição dedicada da newsletter.",
  },
];

const AUDIENCE = [
  { value: "1 mi+", label: "Visualizações em 30 dias" },
  { value: "340 mil", label: "Contas alcançadas em 30 dias" },
  { value: "108,8 mil", label: "Seguidores no Instagram" },
];

const REASONS = [
  {
    title: "Conteúdo, não banner.",
    text: "Sua marca entra numa matéria da redação, que o público lê como notícia.",
  },
  {
    title: "Gente nova a cada post.",
    text: "55% das visualizações da IA News vêm de quem ainda não segue o perfil.",
  },
  {
    title: "Você aprova antes.",
    text: "Nada vai ao ar sem a sua aprovação, sempre sinalizado como parceria paga.",
  },
  {
    title: "Sete canais.",
    text: "Instagram, Facebook, LinkedIn, Threads, portal, newsletter e canal no WhatsApp.",
  },
];

const BUDGETS = [
  "Até R$ 1 mil",
  "R$ 1 mil a R$ 3 mil",
  "R$ 3 mil a R$ 6 mil",
  "Acima de R$ 6 mil",
  "Ainda definindo",
];

function AnunciePage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    budget: "",
    message: "",
  });
  const [loading, setLoading] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const newsletter = wantsNewsletter(e);
    setLoading(true);
    try {
      const eventId = novoEventId("anuncie");
      await submitContactMessage({
        data: {
          meta: metaCtx(eventId),
          newsletter,
          kind: "anuncie",
          full_name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
          budget: form.budget,
          subject: "Solicitação de mídia kit",
          message: form.message,
        },
      });
      pixel("Lead", { content_name: "Publicidade IA News", content_category: "publicidade" }, eventId);
      toast.success("Recebemos seu contato! Enviaremos o mídia kit em breve.");
      setForm({ name: "", email: "", phone: "", company: "", budget: "", message: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar agora.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <main id="main" className="page">
        <div className="wrap">
          <div className="biz">
            <div className="biz-head">
              <p className="kick">Mídia IA News</p>
              <h1>Anuncie para quem decide a agenda de IA das empresas</h1>
              <p className="sub">
                A IA News conta quem está fazendo IA de verdade nos negócios brasileiros. Sua marca entra
                nessa conversa com conteúdo editorial em collab, aprovado por você antes de ir ao ar.
              </p>
            </div>

            <div className="biz-card">
              <form className="biz-form" onSubmit={onSubmit}>
                <div>
                  <h2 className="h-big">Solicite o mídia kit</h2>
                  <p className="fine" style={{ marginTop: 8, fontSize: 15 }}>
                    Preencha os dados e o Henrique Magioni, da IA News, retorna com as vagas do mês e o
                    plano que faz sentido para a sua marca.
                  </p>
                </div>

                <fieldset>
                  <legend className="step-l">
                    <i>Passo 1</i>Seus dados
                  </legend>
                  <div className="biz-fields">
                    <label className="f" htmlFor="name">
                      Nome completo
                      <input
                        className="field"
                        id="name"
                        required
                        maxLength={160}
                        autoComplete="name"
                        value={form.name}
                        onChange={(e) => set("name", e.target.value)}
                        placeholder="Maria Silva"
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
                        placeholder="Sua empresa ou agência"
                      />
                    </label>
                    <label className="f" htmlFor="email">
                      E-mail corporativo
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
                      Telefone (WhatsApp)
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
                    <i>Passo 2</i>Investimento previsto <small>Selecione uma faixa</small>
                  </legend>
                  <div className="opts">
                    {BUDGETS.map((b) => (
                      <label className="opt" key={b}>
                        <input
                          type="radio"
                          name="budget"
                          value={b}
                          checked={form.budget === b}
                          onChange={() => set("budget", b)}
                        />
                        <span>{b}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="step-l">
                    <i>Passo 3</i>Sobre a campanha
                  </legend>
                  <label className="f" htmlFor="message">
                    <span className="hp">Sobre a campanha</span>
                    <textarea
                      className="field"
                      id="message"
                      required
                      maxLength={4000}
                      rows={6}
                      value={form.message}
                      onChange={(e) => set("message", e.target.value)}
                      placeholder="Objetivo, público-alvo, período e formatos de interesse."
                    />
                  </label>
                </fieldset>

                <NewsletterOptIn />
                <div className="biz-submit">
                  <button className="btn blue" type="submit" disabled={loading}>
                    {loading ? "Enviando..." : "Quero o mídia kit"}
                  </button>
                  <span className="fine">
                    Mensagens para a redação vão pela página de <Link to="/contato">Contato</Link>.
                  </span>
                </div>
              </form>
            </div>

            <div className="biz-info">
              <div
                className="stats mini"
                style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}
              >
                {AUDIENCE.map((a) => (
                  <div key={a.label}>
                    <b>{a.value}</b>
                    <span>{a.label}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="kick" style={{ marginBottom: 12 }}>
                  Formatos disponíveis
                </p>
                <ol className="biz-steps">
                  {FORMATS.map((f) => (
                    <li key={f.title}>
                      <b>{f.title}</b>
                      <span>{f.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <p className="kick" style={{ marginBottom: 4 }}>
                  Por que anunciar aqui
                </p>
                <ul className="plain">
                  {REASONS.map((r) => (
                    <li key={r.title}>
                      <span>
                        <b style={{ color: "var(--p-ink)" }}>{r.title}</b> {r.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
