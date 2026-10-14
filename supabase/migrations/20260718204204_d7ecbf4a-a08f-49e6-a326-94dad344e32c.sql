
-- Articles
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  dek TEXT,
  body_markdown TEXT NOT NULL,
  why_it_matters TEXT,
  category TEXT NOT NULL DEFAULT 'geral',
  cover_image_url TEXT,
  source_name TEXT,
  source_url TEXT,
  author TEXT DEFAULT 'Redação IA News',
  read_minutes INT DEFAULT 3,
  published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  views_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX articles_published_at_idx ON public.articles (published_at DESC);
CREATE INDEX articles_category_idx ON public.articles (category);

GRANT SELECT ON public.articles TO anon;
GRANT SELECT ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read articles" ON public.articles
  FOR SELECT TO anon, authenticated
  USING (true);

-- Ingest runs log
CREATE TABLE public.ingest_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  imported_count INT NOT NULL DEFAULT 0,
  error TEXT,
  notes TEXT
);

GRANT ALL ON public.ingest_runs TO service_role;

ALTER TABLE public.ingest_runs ENABLE ROW LEVEL SECURITY;

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_cron & pg_net for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
