CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_id uuid,
  visitor_hash text NOT NULL DEFAULT '',
  device text NOT NULL DEFAULT 'desconhecido',
  browser text NOT NULL DEFAULT 'desconhecido',
  country text,
  is_active boolean NOT NULL DEFAULT true,
  last_sent_at timestamptz,
  failure_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.push_subscriptions TO service_role;
GRANT SELECT ON public.push_subscriptions TO authenticated;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins podem ver assinaturas push" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_push_subscriptions_updated_at BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.push_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL,
  article_slug text,
  recipients_count integer NOT NULL DEFAULT 0,
  delivered_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  triggered_by text NOT NULL DEFAULT 'cron',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.push_sends TO service_role;
GRANT SELECT ON public.push_sends TO authenticated;
ALTER TABLE public.push_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins podem ver envios push" ON public.push_sends
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));