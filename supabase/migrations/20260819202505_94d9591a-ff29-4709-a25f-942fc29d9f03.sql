CREATE TABLE public.cta_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL CHECK (event IN ('impression','click','convert')),
  placement text NOT NULL,
  variant text NOT NULL DEFAULT 'default',
  path text NOT NULL DEFAULT '/',
  article_slug text,
  session_id text NOT NULL DEFAULT '',
  visitor_hash text NOT NULL DEFAULT '',
  utm_source text,
  utm_campaign text,
  device text NOT NULL DEFAULT 'desktop',
  lead_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cta_events_created_idx ON public.cta_events (created_at DESC);
CREATE INDEX cta_events_placement_idx ON public.cta_events (placement, event);

GRANT ALL ON public.cta_events TO service_role;
GRANT SELECT ON public.cta_events TO authenticated;
ALTER TABLE public.cta_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read cta events" ON public.cta_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.content_engagement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_slug text NOT NULL,
  article_title text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  session_id text NOT NULL DEFAULT '',
  visitor_hash text NOT NULL DEFAULT '',
  seconds integer NOT NULL DEFAULT 0,
  scroll_pct integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  device text NOT NULL DEFAULT 'desktop',
  referrer_host text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, article_slug)
);
CREATE INDEX content_engagement_slug_idx ON public.content_engagement (article_slug);
CREATE INDEX content_engagement_created_idx ON public.content_engagement (created_at DESC);

GRANT ALL ON public.content_engagement TO service_role;
GRANT SELECT ON public.content_engagement TO authenticated;
ALTER TABLE public.content_engagement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read engagement" ON public.content_engagement
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));