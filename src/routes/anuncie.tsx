import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { submitContactMessage } from "@/lib/contact.functions";
import { NewsletterOptIn, wantsNewsletter } from "@/components/site/newsletter-opt-in";

export const Route = createFileRoute("/anuncie")({
  head: () => ({
    meta: [
      { title: "Anuncie no IA News — mídia para quem decide sobre IA" },
      {
        name: "description",
        content:
          "Formatos de mídia do IA News: newsletter diária, display no site, conteúdo patrocinado e ações sob medida para alcançar decisores de tecnologia.",
      },
      { property: "og:title", content: "Anuncie no IA News" },
      {
        property: "og:description",
        content:
          "Newsletter diária, display e conteúdo patrocinado para decisores de IA no Brasil.",
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
    title: "Newsletter diária",
    text: "Patrocínio da edição das 8h com bloco de marca, texto editorial e link rastreável.",
  },
  {
    title: "Display no site",
    text: "Posições premium na home, nas matérias e no Ranking IA, em desktop e mobile.",
  },
  {
    title: "Conteúdo patrocinado",
    text: "Matéria produzida com o padrão editorial do IA News, sinalizada como conteúdo de marca.",
  },
  {
    title: "Ações sob medida",
    text: "Pesquisas, relatórios setoriais e cobertura de eventos com a audiência do IA News.",
  },
];

const AUDIENCE = [
  { value: "Diária", label: "Frequência editorial" },
  { value: "C-level", label: "Perfil predominante" },
  { value: "Brasil", label: "Cobertura principal" },
];

const REASONS = [
  {
    title: "Audiência qualificada.",
    text: "Decisores que acompanham IA por obrigação profissional, não por curiosidade.",
  },
  {
    title: "Contexto editorial.",
    text: "Sua marca aparece ao lado de análise própria, não de conteúdo genérico.",
  },
  {
    title: "Transparência.",
    text: "Relatórios de entrega, cliques e leitura ao final de cada campanha.",
  },
  {
    title: "Formatos flexíveis.",
    text: "Do patrocínio pontual da newsletter a programas anuais.",
  },
];

const BUDGETS = [
  "Até R$ 5 mil",
  "R$ 5 mil a R$ 15 mil",
  "R$ 15 mil a R$ 50 mil",
  "Acima de R$ 50 mil",
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
      await submitContactMessage({
        data: {
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
                O IA News é lido por executivos, fundadores e times de tecnologia que precisam
                entender o impacto da inteligência artificial no negócio — todos os dias, antes das
                8h.
              </p>
            </div>

            <div className="biz-card">
              <form className="biz-form" onSubmit={onSubmit}>
                <div>
                  <h2 className="h-big">Solicite o mídia kit</h2>
                  <p className="fine" style={{ marginTop: 8, fontSize: 15 }}>
                    Preencha os dados e nosso time comercial retorna com formatos, disponibilidade e
                    valores.
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
