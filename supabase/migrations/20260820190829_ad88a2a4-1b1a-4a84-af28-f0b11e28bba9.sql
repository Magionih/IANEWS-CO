ALTER TABLE public.cta_events
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS referrer_host text;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS cta_placement text,
  ADD COLUMN IF NOT EXISTS cta_variant text,
  ADD COLUMN IF NOT EXISTS article_slug text,
  ADD COLUMN IF NOT EXISTS landing_path text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS confirm_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS welcome_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS leads_confirm_token_key ON public.leads (confirm_token);
CREATE INDEX IF NOT EXISTS leads_confirmed_at_idx ON public.leads (confirmed_at);
CREATE INDEX IF NOT EXISTS cta_events_country_idx ON public.cta_events (country);