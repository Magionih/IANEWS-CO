REVOKE EXECUTE ON FUNCTION public.increment_article_views(text) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_article_views(text) TO service_role;