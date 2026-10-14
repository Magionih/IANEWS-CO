ALTER TABLE public.reading_events
  ADD COLUMN IF NOT EXISTS seconds_read integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS scroll_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS device text,
  ADD COLUMN IF NOT EXISTS read_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date;

DELETE FROM public.reading_events a
USING public.reading_events b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.article_slug = b.article_slug
  AND a.read_date = b.read_date;

CREATE UNIQUE INDEX IF NOT EXISTS reading_events_user_slug_day_idx
  ON public.reading_events (user_id, article_slug, read_date);

ALTER TABLE public.ingest_runs
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.increment_article_views(_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.articles SET views_count = views_count + 1 WHERE slug = _slug;
$$;

GRANT EXECUTE ON FUNCTION public.increment_article_views(text) TO authenticated, anon, service_role;