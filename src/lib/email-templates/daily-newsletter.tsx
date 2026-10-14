import { DailyNewsletter, type NewsletterArticle } from '@/lib/newsletter-template'
import type { TemplateEntry } from './registry'

export const NEWSLETTER_PREVIEW_ARTICLES: NewsletterArticle[] = [
  {
    slug: 'openai-lanca-agente-corporativo',
    title: 'OpenAI lança agente corporativo e acirra disputa por produtividade',
    dek: 'Nova camada de agentes promete automatizar fluxos inteiros dentro das empresas.',
    category: 'bigtech',
    why_it_matters:
      'Empresas brasileiras que já usam copilotos passam a ter alternativa direta para automação de processos.',
    read_minutes: 4,
  },
  {
    slug: 'ia-generativa-no-varejo-brasileiro',
    title: 'Varejo brasileiro acelera IA generativa em atendimento',
    dek: 'Grandes redes relatam ganhos de conversão com assistentes treinados no próprio catálogo.',
    category: 'brasil',
    why_it_matters: 'O caso serve de referência para operações de médio porte que avaliam pilotos.',
    read_minutes: 5,
  },
  {
    slug: 'regulacao-de-ia-avanca-no-congresso',
    title: 'Regulação de IA avança e muda o calendário de compliance',
    dek: 'Texto em discussão cria obrigações de transparência para sistemas de alto risco.',
    category: 'regulacao',
    why_it_matters: 'Áreas jurídicas precisam mapear os sistemas em uso antes do prazo de adequação.',
    read_minutes: 6,
  },
]

export const dailyNewsletterTemplate = {
  component: DailyNewsletter,
  subject: 'IA News · edição diária',
  displayName: 'Newsletter diária IA News',
  previewData: {
    editionLabel: '30 de julho de 2026',
    siteUrl: 'https://ianews.site',
    recipientName: 'Ana',
    articles: NEWSLETTER_PREVIEW_ARTICLES,
  },
} satisfies TemplateEntry