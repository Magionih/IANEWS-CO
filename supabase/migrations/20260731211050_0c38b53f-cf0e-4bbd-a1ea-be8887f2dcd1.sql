REVOKE EXECUTE ON FUNCTION public.increment_article_views(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enforce_single_admin() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;

CREATE POLICY "No client writes to newsletter sends"
ON public.newsletter_sends FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "No client updates to newsletter sends"
ON public.newsletter_sends FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes to newsletter sends"
ON public.newsletter_sends FOR DELETE TO anon, authenticated USING (false);

CREATE POLICY "No client writes to newsletter recipients"
ON public.newsletter_recipients FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "No client updates to newsletter recipients"
ON public.newsletter_recipients FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes to newsletter recipients"
ON public.newsletter_recipients FOR DELETE TO anon, authenticated USING (false);

REVOKE INSERT, UPDATE, DELETE ON public.newsletter_sends FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.newsletter_recipients FROM anon, authenticated;
GRANT ALL ON public.newsletter_sends TO service_role;
GRANT ALL ON public.newsletter_recipients TO service_role;