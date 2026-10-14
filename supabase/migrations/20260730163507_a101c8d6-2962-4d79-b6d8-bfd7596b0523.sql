CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text,
  phone text,
  source text NOT NULL DEFAULT 'site',
  is_active boolean NOT NULL DEFAULT true,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT INSERT ON public.leads TO anon;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can subscribe" ON public.leads FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins read leads" ON public.leads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update leads" ON public.leads FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete leads" ON public.leads FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.newsletter_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  edition_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date),
  status text NOT NULL DEFAULT 'running',
  recipients_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  article_slugs text[] NOT NULL DEFAULT '{}',
  triggered_by text NOT NULL DEFAULT 'cron',
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.newsletter_sends TO authenticated;
GRANT ALL ON public.newsletter_sends TO service_role;
ALTER TABLE public.newsletter_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read newsletter sends" ON public.newsletter_sends FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_newsletter_sends_updated_at BEFORE UPDATE ON public.newsletter_sends FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.newsletter_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid NOT NULL REFERENCES public.newsletter_sends(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX newsletter_recipients_send_id_idx ON public.newsletter_recipients(send_id);
GRANT SELECT ON public.newsletter_recipients TO authenticated;
GRANT ALL ON public.newsletter_recipients TO service_role;
ALTER TABLE public.newsletter_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read newsletter recipients" ON public.newsletter_recipients FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));