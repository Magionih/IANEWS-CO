CREATE TABLE public.ad_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event text NOT NULL,
  ad_name text NOT NULL,
  page text NOT NULL,
  slot_id text NOT NULL DEFAULT '',
  path text NOT NULL DEFAULT '/',
  article_slug text,
  category text,
  session_id text NOT NULL DEFAULT '',
  visitor_hash text NOT NULL DEFAULT '',
  device text NOT NULL DEFAULT 'desktop',
  country text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  visible_ms integer NOT NULL DEFAULT 0,
  visible_pct integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.ad_events TO service_role;
GRANT SELECT ON public.ad_events TO authenticated;

ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read ad events"
  ON public.ad_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX ad_events_created_at_idx ON public.ad_events (created_at DESC);
CREATE INDEX ad_events_event_idx ON public.ad_events (event);
CREATE INDEX ad_events_page_idx ON public.ad_events (page);
CREATE INDEX ad_events_article_idx ON public.ad_events (article_slug);
CREATE INDEX ad_events_country_idx ON public.ad_events (country);