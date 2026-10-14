DROP POLICY "Anyone can subscribe" ON public.leads;
CREATE POLICY "Anyone can subscribe" ON public.leads
FOR INSERT TO anon, authenticated
WITH CHECK (
  length(email) BETWEEN 5 AND 255
  AND position('@' in email) > 1
  AND confirmed_at IS NULL
  AND unsubscribed_at IS NULL
  AND is_active = true
);