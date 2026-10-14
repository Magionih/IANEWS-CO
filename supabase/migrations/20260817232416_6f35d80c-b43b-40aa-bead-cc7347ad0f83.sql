REVOKE ALL ON FUNCTION public.recompute_ai_ranking() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_ai_ranking() TO service_role, postgres;