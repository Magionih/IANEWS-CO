import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Mail, MessageCircle, Newspaper } from "lucide-react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitContactMessage } from "@/lib/contact.functions";

export const Route = createFileRoute("/contato")({
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
      { property: "og:url", content: "https://ianews.site/contato" },
    ],
    links: [{ rel: "canonical", href: "https://ianews.site/contato" }],
  }),
  component: ContatoPage,
});

const REASONS = [
  { icon: Newspaper, title: "Pauta ou release", text: "Tem uma novidade de IA relevante para quem decide? Conte para a redação." },
  { icon: MessageCircle, title: "Correção", text: "Encontrou um erro em alguma matéria? Corrigimos com transparência." },
  { icon: Mail, title: "Imprensa e parcerias", text: "Colaborações editoriais, entrevistas e cobertura de eventos." },
];

function ContatoPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await submitContactMessage({
        data: {
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
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <p className="font-mono-eyebrow text-[color:var(--color-lime)]">Fale conosco</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight sm:text-5xl">
          Contato com a redação do IA News
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Pautas, correções, sugestões e parcerias editoriais. Toda mensagem chega direto ao
          time e é respondida em até 2 dias úteis.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
          <form onSubmit={onSubmit} className="rounded-[var(--radius)] border bg-card p-5 sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" required maxLength={160} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Maria Silva" className="h-12 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" required maxLength={255} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="voce@empresa.com" className="h-12 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (opcional)</Label>
                <Input id="phone" type="tel" maxLength={30} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(11) 99999-0000" className="h-12 rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Assunto</Label>
                <Input id="subject" maxLength={200} value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Pauta, correção, parceria..." className="h-12 rounded-lg" />
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea id="message" required maxLength={4000} rows={7} value={form.message} onChange={(e) => set("message", e.target.value)} placeholder="Conte o contexto, links e prazos relevantes." className="rounded-lg" />
            </div>
            <Button type="submit" disabled={loading} className="mt-6 h-12 w-full rounded-lg text-base font-bold sm:w-auto sm:px-10">
              {loading ? "Enviando..." : "Enviar mensagem"}
            </Button>
          </form>

          <aside className="space-y-4">
            {REASONS.map((r) => (
              <div key={r.title} className="rounded-[var(--radius)] border bg-card p-5">
                <r.icon className="h-5 w-5 text-[color:var(--color-lime)]" aria-hidden />
                <p className="mt-3 font-extrabold">{r.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{r.text}</p>
              </div>
            ))}
            <div className="rounded-[var(--radius)] bg-secondary/60 p-5">
              <p className="font-mono-eyebrow text-muted-foreground">Anunciantes</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Para mídia, patrocínio de newsletter e conteúdo de marca, use a página{" "}
                <a href="/anuncie" className="font-semibold text-[color:var(--color-lime)] hover:underline">
                  Anuncie
                </a>
                .
              </p>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}