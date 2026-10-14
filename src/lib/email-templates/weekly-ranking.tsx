import { WeeklyRankingEmail, type RankingEmailTool } from '@/lib/ranking-email-template'
import type { TemplateEntry } from './registry'

export const RANKING_PREVIEW_TOOLS: RankingEmailTool[] = [
  {
    slug: 'chatgpt',
    name: 'ChatGPT',
    maker: 'OpenAI',
    category: 'Assistentes',
    weekly_score: 9.4,
    previous_score: 9.2,
    rank_position: 1,
    previous_position: 2,
    ratings_avg: 4.6,
    about: 'Assistente generalista com agentes, análise de arquivos e integrações corporativas.',
    website: 'https://chat.openai.com',
  },
  {
    slug: 'gemini',
    name: 'Gemini',
    maker: 'Google',
    category: 'Assistentes',
    weekly_score: 9.1,
    previous_score: 9.1,
    rank_position: 2,
    previous_position: 1,
    ratings_avg: 4.4,
    about: 'Forte em contexto longo e integração com o ecossistema Workspace.',
    website: 'https://gemini.google.com',
  },
  {
    slug: 'claude',
    name: 'Claude',
    maker: 'Anthropic',
    category: 'Assistentes',
    weekly_score: 8.9,
    previous_score: 8.6,
    rank_position: 3,
    previous_position: 4,
    ratings_avg: 4.5,
    about: 'Referência em raciocínio longo, revisão de documentos e código.',
    website: 'https://claude.ai',
  },
]

export const weeklyRankingTemplate = {
  component: WeeklyRankingEmail,
  subject: 'Ranking IA da semana · as melhores ferramentas de IA',
  displayName: 'Ranking IA semanal',
  previewData: {
    editionLabel: '25 de agosto de 2026',
    siteUrl: 'https://ianews.site',
    recipientName: 'Ana',
    tools: RANKING_PREVIEW_TOOLS,
  },
} satisfies TemplateEntry
