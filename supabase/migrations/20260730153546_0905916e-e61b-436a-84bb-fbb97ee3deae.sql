ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS seo_title text,
  ADD COLUMN IF NOT EXISTS seo_description text,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS articles_source_url_idx ON public.articles (source_url);
CREATE INDEX IF NOT EXISTS articles_published_at_idx ON public.articles (published_at DESC);