ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS quality_score numeric,
  ADD COLUMN IF NOT EXISTS quality_report jsonb,
  ADD COLUMN IF NOT EXISTS editorial_angle text;