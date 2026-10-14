ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS analysis_markdown text,
  ADD COLUMN IF NOT EXISTS business_context text,
  ADD COLUMN IF NOT EXISTS editorial_conclusion text,
  ADD COLUMN IF NOT EXISTS business_impacts text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS sources jsonb NOT NULL DEFAULT '[]'::jsonb;