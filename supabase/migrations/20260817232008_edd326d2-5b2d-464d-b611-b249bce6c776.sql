CREATE TABLE public.site_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  path text NOT NULL,
  title text,
  referrer text,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  visitor_hash text NOT NULL DEFAULT '',
  session_id text NOT NULL DEFAULT '',
  user_id uuid,
  device text NOT NULL DEFAULT 'desconhecido',
  os text NOT NULL DEFAULT 'desconhecido',
  browser text NOT NULL DEFAULT 'desconhecido',
  country text,
  is_new_visitor boolean NOT NULL DEFAULT false,
  visited_at timestamp with time zone NOT NULL DEFAULT now(),
  visit_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.site_visits TO authenticated;
GRANT ALL ON public.site_visits TO service_role;

ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read site visits"
ON public.site_visits FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX site_visits_visited_at_idx ON public.site_visits (visited_at DESC);
CREATE INDEX site_visits_visit_date_idx ON public.site_visits (visit_date);
CREATE INDEX site_visits_path_idx ON public.site_visits (path);
CREATE INDEX site_visits_visitor_idx ON public.site_visits (visitor_hash);