import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { submitContactMessage } from "@/lib/contact.functions";
import { NewsletterOptIn, wantsNewsletter } from "@/components/site/newsletter-opt-in";

export const Route = createFileRoute("/contato")({
  validateSearch: (search: Record<string, unknown>): { assunto?: string } =>
    typeof search["assunto"] === "string" ? { assunto: search["assunto"].slice(0, 40) } : {},
  head: () => ({
    meta: [
      { title: "Contato — fale com a redação do IA News" },
      {
        name: "description",
        content:
          "Envie pautas, correções, sugestões ou dúvidas para a redação do IA News. Respondemos em até 2 dias úteis.",
      },
      { property: "og:title", content: "Contato — fale com a redação do IA News" },
      {
        property: "og:description",
        content: "Pautas, correções e parcerias editoriais: fale direto com o time do IA News.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: "https://ianewsbr.com/contato" },
    ],
    links: [{ rel: "canonical", href: "https://ianewsbr.com/contato" }],
  }),
  component: ContatoPage,
});

const REASONS = [
  {
    title: "Pauta ou release",
    text: "Tem uma novidade de IA relevante para quem decide? Conte para a redação.",
  },
  { title: "Correção", text: "Encontrou um erro em alguma matéria? Corrigimos com transparência." },
  {
    title: "Imprensa e parcerias",
    text: "Colaborações editoriais, entrevistas e cobertura de eventos.",
  },
];

const ASSUNTOS: Record<string, string> = {
  pauta: "Sugestão de pauta",
};

function ContatoPage() {
  const { assunto } = Route.useSearch();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: (assunto && ASSUNTOS[assunto]) || "",
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
          kind: "contato",
          full_name: form.name,
          email: form.email,
          phone: form.phone,
          subject: form.subject,
          message: form.message,
        },
      });
      toast.success("Mensagem enviada! Nossa equipe responde em até 2 dias úteis.");
      setForm({ name: "", email: "", phone: "", subject: "", message: "" });
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
          <div className="page-head">
            <p className="kick">Fale conosco</p>
            <h1>Contato com a redação do IA News</h1>
            <p className="sub">
              Pautas, correções, sugestões e parcerias editoriais. Toda mensagem chega direto ao
              time e é respondida em até 2 dias úteis.
            </p>
          </div>

          <div className="two-col">
            <form onSubmit={onSubmit} className="panel-form">
              <h3>Envie sua mensagem</h3>
              <div className="two">
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
              </div>
              <div className="two">
                <label className="f" htmlFor="phone">
                  Telefone (opcional)
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
                <label className="f" htmlFor="subject">
                  Assunto
                  <input
                    className="field"
                    id="subject"
                    maxLength={200}
                    value={form.subject}
                    onChange={(e) => set("subject", e.target.value)}
                    placeholder="Pauta, correção, parceria..."
                  />
                </label>
              </div>
              <label className="f" htmlFor="message">
                Mensagem
                <textarea
                  className="field"
                  id="message"
                  required
                  maxLength={4000}
                  rows={7}
                  value={form.message}
                  onChange={(e) => set("message", e.target.value)}
                  placeholder="Conte o contexto, links e prazos relevantes."
                />
              </label>
              <NewsletterOptIn />
              <div>
                <button type="submit" className="btn blue" disabled={loading}>
                  {loading ? "Enviando..." : "Enviar mensagem"}
                </button>
              </div>
            </form>

            <aside style={{ display: "grid", gap: 26 }}>
              <ol className="biz-steps">
                {REASONS.map((r) => (
                  <li key={r.title}>
                    <b>{r.title}</b>
                    <span>{r.text}</span>
                  </li>
                ))}
              </ol>
              <div className="note-box">
                <p className="kick">Anunciantes</p>
                <p>
                  Para mídia, patrocínio de newsletter e conteúdo de marca, use a página{" "}
                  <Link to="/anuncie">Anuncie</Link>.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
