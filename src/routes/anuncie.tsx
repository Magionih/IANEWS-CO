import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BarChart3, Mail, Megaphone, Target } from "lucide-react";

import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitContactMessage } from "@/lib/contact.functions";

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
        content: "Newsletter diária, display e conteúdo patrocinado para decisores de IA no Brasil.",
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
    icon: Mail,
    title: "Newsletter diária",
    text: "Patrocínio da edição das 8h com bloco de marca, texto editorial e link rastreável.",
  },
  {
    icon: Megaphone,
    title: "Display no site",
    text: "Posições premium na home, nas matérias e no Ranking IA, em desktop e mobile.",
  },
  {
    icon: Target,
    title: "Conteúdo patrocinado",
    text: "Matéria produzida com o padrão editorial do IA News, sinalizada como conteúdo de marca.",
  },
  {
    icon: BarChart3,
    title: "Ações sob medida",
    text: "Pesquisas, relatórios setoriais e cobertura de eventos com a audiência do IA News.",
  },
];

const AUDIENCE = [
  { value: "Diária", label: "Frequência editorial" },
  { value: "C-level", label: "Perfil predominante" },
  { value: "Brasil", label: "Cobertura principal" },
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
    setLoading(true);
    try {
      await submitContactMessage({
        data: {
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
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <section className="bg-[color:var(--color-nav)] text-white">
          <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <p className="font-mono-eyebrow text-[color:var(--color-lime)]">Mídia IA News</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Anuncie para quem decide a agenda de IA das empresas
            </h1>
            <p className="mt-4 max-w-2xl text-white/70">
              O IA News é lido por executivos, fundadores e times de tecnologia que precisam
              entender o impacto da inteligência artificial no negócio — todos os dias, antes das 8h.
            </p>
            <dl className="mt-10 grid gap-4 sm:grid-cols-3">
              {AUDIENCE.map((a) => (
                <div key={a.label} className="rounded-[var(--radius)] bg-white/5 p-5">
                  <dt className="font-mono-eyebrow text-white/50">{a.label}</dt>
                  <dd className="mt-2 text-2xl font-extrabold">{a.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Formatos disponíveis</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FORMATS.map((f) => (
              <div key={f.title} className="rounded-[var(--radius)] border bg-card p-6">
                <f.icon className="h-6 w-6 text-[color:var(--color-lime)]" aria-hidden />
                <p className="mt-4 font-extrabold">{f.title}</p>
                <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
            <form onSubmit={onSubmit} className="rounded-[var(--radius)] border bg-card p-5 sm:p-8">
              <h2 className="text-2xl font-extrabold tracking-tight">Solicite o mídia kit</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Preencha os dados e nosso time comercial retorna com formatos, disponibilidade e valores.
              </p>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input id="name" required maxLength={160} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Maria Silva" className="h-12 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Empresa</Label>
                  <Input id="company" maxLength={160} value={form.company} onChange={(e) => set("company", e.target.value)} placeholder="Sua empresa ou agência" className="h-12 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail corporativo</Label>
                  <Input id="email" type="email" required maxLength={255} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="voce@empresa.com" className="h-12 rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                  <Input id="phone" type="tel" maxLength={30} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(11) 99999-0000" className="h-12 rounded-lg" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="budget">Investimento previsto</Label>
                  <Select value={form.budget} onValueChange={(v) => set("budget", v)}>
                    <SelectTrigger id="budget" className="h-12 rounded-lg">
                      <SelectValue placeholder="Selecione uma faixa" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUDGETS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                <Label htmlFor="message">Sobre a campanha</Label>
                <Textarea id="message" required maxLength={4000} rows={6} value={form.message} onChange={(e) => set("message", e.target.value)} placeholder="Objetivo, público-alvo, período e formatos de interesse." className="rounded-lg" />
              </div>
              <Button type="submit" disabled={loading} className="mt-6 h-12 w-full rounded-lg text-base font-bold sm:w-auto sm:px-10">
                {loading ? "Enviando..." : "Quero o mídia kit"}
              </Button>
            </form>

            <aside className="rounded-[var(--radius)] bg-secondary/60 p-6">
              <h3 className="text-xl font-extrabold leading-tight">Por que anunciar aqui</h3>
              <ul className="mt-5 space-y-4 text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Audiência qualificada.</strong> Decisores que
                  acompanham IA por obrigação profissional, não por curiosidade.
                </li>
                <li>
                  <strong className="text-foreground">Contexto editorial.</strong> Sua marca aparece
                  ao lado de análise própria, não de conteúdo genérico.
                </li>
                <li>
                  <strong className="text-foreground">Transparência.</strong> Relatórios de entrega,
                  cliques e leitura ao final de cada campanha.
                </li>
                <li>
                  <strong className="text-foreground">Formatos flexíveis.</strong> Do patrocínio
                  pontual da newsletter a programas anuais.
                </li>
              </ul>
            </aside>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}