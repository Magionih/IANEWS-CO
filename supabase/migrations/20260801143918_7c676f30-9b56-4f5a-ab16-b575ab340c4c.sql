CREATE TABLE public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'contato',
  full_name text NOT NULL,
  email text NOT NULL,
  phone text,
  company text,
  budget text,
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'nova',
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO service_role;

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can send a message"
  ON public.contact_messages FOR INSERT TO anon, authenticated
  WITH CHECK (
    kind IN ('contato','anuncie')
    AND length(full_name) BETWEEN 2 AND 160
    AND length(email) BETWEEN 5 AND 255
    AND position('@' in email) > 1
    AND length(message) BETWEEN 5 AND 4000
    AND status = 'nova'
    AND admin_notes IS NULL
  );

CREATE POLICY "Admins read messages"
  ON public.contact_messages FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update messages"
  ON public.contact_messages FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete messages"
  ON public.contact_messages FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_contact_messages_updated_at
  BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX contact_messages_created_idx ON public.contact_messages (created_at DESC);