
REVOKE EXECUTE ON FUNCTION public.refresh_ai_tool_rating_stats() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_ai_ranking() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_ai_tool_rating_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_ai_ranking() TO service_role;
