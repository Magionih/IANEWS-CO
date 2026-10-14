
# IA News — Plano de construção

Plataforma editorial de IA (notícias + ranking de ferramentas + hábitos de leitura + painel admin), 100% dinâmica sobre backend, no padrão visual de TheNews / Morning Brew / The Verge.

## Ajustes ao stack pedido

O projeto Lovable atual roda em **TanStack Start (React 19 + Vite)**, não Vite + React Router puro. Isso não muda nada do produto — só adapto:

- Roteamento: TanStack Router (file-based em `src/routes/`) no lugar de React Router. Mesma UX de rotas (`/noticias`, `/materia/$slug`, `/ranking`, `/habitos`, `/admin/...`).
- SEO/OG: `head()` por rota (nativo do TanStack), no lugar de `react-helmet`.
- Backend: **Lovable Cloud** (Supabase gerenciado) — Auth, Postgres, Storage, RLS. Server functions do TanStack para leituras/escritas sensíveis.
- Tudo o mais como pedido: Tailwind + shadcn/ui + Framer Motion + TanStack Query + Recharts.

Também vou **remover** o `iframe` provisório do `ianews.html` e construir a home nativa em React.

## Design system (fase 1)

Tokens em `src/styles.css` (oklch):
- `--primary` #1F5EFF, `--ink` #26221C, `--background` #FBFAF7, `--surface` #FFFFFF, `--border` #E6E0D6, `--muted-foreground` #6C6A64, `--gold` #E8A020, `--success` #1F965A.
- Cores de categoria como variáveis (`--cat-bigtech`, `--cat-startup`, `--cat-brasil`, ...) para chips.
- Fontes via `<link>` no `__root.tsx` (Google Fonts): **Outfit** (títulos), **Lora** (corpo editorial), **Instrument Sans** (UI), **Geist Mono** (eyebrows). Mapeadas em `@theme`.
- Componentes base shadcn: Button, Card, Badge (chip de categoria), Input, Dialog, Sheet, Tabs, Progress, Avatar, DropdownMenu, Sonner, Skeleton.
- Logo IA News (quadrado azul arredondado + "News").
- Layout público: Header (nav + busca + CTA newsletter) / Footer (sobre, categorias, social, assinatura). Mobile-first, dark mode opcional.

## Modelo de dados (fase 2 — Lovable Cloud)

Enum `app_role` (`admin`, `reader`) + tabela `user_roles` com `has_role()` security-definer (padrão obrigatório — nunca papel no `profiles`).

Tabelas (todas com GRANTs corretos e RLS):

- `categories` (slug, name, color, description, order).
- `articles` (slug, title, dek, body markdown, category_id, cover_image_url, image_credit, author, source_name, source_url, read_minutes, status draft/scheduled/published, featured, published_at, views_count, seo_title, seo_description). Índice full-text (`tsvector` PT-BR) em título+dek+body.
- `ai_tools` (name, slug, category, tagline, logo_url, website_url, editorial_score, popularity, pros[], cons[], description, pricing_note).
- `tool_reviews` (tool_id, user_id, rating 1–5, comment). Média agregada por view.
- `profiles` (id=auth.users, name, email, avatar_url) — auto via trigger `on_auth_user_created`.
- `reading_events` (user_id nullable, session_id, article_id nullable, event_type, value, path, created_at). Insert público (anon+authenticated), select só admin.
- `subscribers` (email unique, source, frequency, confirmed_at).

Storage: buckets **públicos** `article-covers` e `tool-logos` (upload restrito a admin via policy).

Seed de categorias + 8–10 matérias reais + 12 ferramentas com logos (via migration; imagens usando URLs de kits de imprensa das próprias empresas com crédito).

## Rotas públicas (fase 3)

Todas em `src/routes/` com `head()` próprio (title/description/og:title/og:description; og:image nas leafs com imagem real da matéria/ferramenta).

- `/` — Home: hero + captura de e-mail, matéria destaque, grid recentes, faixa de categorias, teaser ranking, bloco Members, CTA newsletter.
- `/noticias` — feed com busca full-text (Supabase `websearch_to_tsquery`), filtro por categoria, ordenação (recentes/populares), scroll infinito.
- `/categoria/$slug` — feed filtrado, header temático na cor.
- `/materia/$slug` — página editorial: cover + crédito, chip, título Outfit, dek, meta (autor/data/tempo), barra de progresso ligada ao scroll, corpo Lora com H2/pull-quote/lista/bloco "Por que isso importa"/fecho, botão fonte, "Leia também" por categoria, CTA newsletter inline. Renderização de markdown (react-markdown + rehype).
- `/ranking` — cards com logo real, estrelas editoriais + média de usuários, barra de popularidade, prós/cons, preço, "Visitar"; comparador lado a lado (até 3 via search params); form de review (autenticado).
- `/newsletter` — landing de assinatura; grava em `subscribers`.
- `/auth` — login/cadastro (email+senha; magic link opcional).

Dados via `createServerFn` (leituras públicas com cliente publishable server-side; escritas autenticadas com `requireSupabaseAuth`). Loader + `ensureQueryData` + `useSuspenseQuery`.

## Auth + tracking real (fase 4)

- Fluxo email/senha via Supabase Auth; sessão listener no `__root.tsx`.
- Rotas privadas em `src/routes/_authenticated/` (gate gerenciado pela integração).
- Hook `useTracking()` no cliente: registra `page_view`, `article_open`, `scroll_25/50/75/100`, `time_tick` (a cada 15s ativo com visibilitychange), `read_complete`, `cta_click`, `subscribe`. `session_id` em cookie/localStorage. Insert direto na tabela `reading_events` (policy INSERT permite anon).
- `/habitos` (rota `_authenticated`): dashboard real — streak, artigos lidos, meta semanal (anel), heatmap 30 dias, tempo total, categorias favoritas, badges. Agregações via server function que consulta `reading_events` do `userId`.

## Painel admin (fase 5)

`src/routes/_authenticated/admin/*` com guard extra `has_role(admin)` no `beforeLoad` (via server fn). Layout com sidebar shadcn.

- `/admin` — Analytics: totais (sessões, page views, assinantes), matérias mais lidas, taxa de conclusão, profundidade média de scroll, retenção, crescimento de assinantes, conversão de CTA. Recharts + filtros de período. Fonte: agregações SQL em `reading_events` + `subscribers`.
- `/admin/noticias` — CRUD com editor rich text (Tiptap ou textarea markdown com preview), upload de capa para `article-covers`, crédito, categoria, destaque, status, agendamento (`published_at` futuro publicado por checagem no fetch), reordenação da curadoria da home.
- `/admin/ranking` — CRUD de ferramentas (logo upload), moderação de reviews.
- `/admin/assinantes` — lista + export CSV.
- Todas escritas via server functions com `requireSupabaseAuth` + verificação `has_role('admin')`.

## Polimento (fase 6)

- Skeletons, empty states, 404 editorial, microinterações (Framer Motion) sutis.
- Lazy loading de imagens (`loading="lazy"`, `sizes`), code-splitting por rota (nativo TanStack), OG images reais por matéria, sitemap.xml gerado, robots.txt.
- A11y AA (foco visível, contraste, aria labels), responsivo mobile→desktop, dark mode (toggle no header, persistido).
- Substituir `title` template padrão e limpar `public/ianews.html`/rota iframe.

## Ordem de execução

Vou construir e validar fase a fase, uma por turno de trabalho, começando pela **Fase 1 (design system) + Fase 2 (habilitar Lovable Cloud e criar schema/seed)** juntas, porque a fase 3 depende do schema pronto.

## Perguntas para depois do "aprovar"

1. Você tem imagens/logos de matérias e ferramentas para o seed inicial, ou uso URLs públicas de press kits/OG das fontes com crédito visível?
2. Newsletter: só captura de e-mail agora, ou já quero conectar Resend/Brevo para disparar confirmação? (posso deixar preparado e ligar depois).
3. Dark mode: entrego já na fase 1 ou deixo para o polimento?
