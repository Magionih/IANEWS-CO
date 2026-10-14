CREATE OR REPLACE FUNCTION public.recompute_ai_ranking()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  WITH buzz AS (
    SELECT t.id,
           (SELECT count(*) FROM public.articles a
             WHERE a.published_at > now() - interval '24 hours'
               AND (a.title ILIKE '%' || t.name || '%'
                 OR a.title ILIKE '%' || t.maker || '%'
                 OR a.body_markdown ILIKE '%' || t.name || '%'))::numeric AS mentions_24h,
           (SELECT count(*) FROM public.articles a
             WHERE a.published_at > now() - interval '7 days'
               AND (a.title ILIKE '%' || t.name || '%'
                 OR a.title ILIKE '%' || t.maker || '%'
                 OR a.body_markdown ILIKE '%' || t.name || '%'))::numeric AS mentions_7d
    FROM public.ai_tools t
  ), maxb AS (
    SELECT GREATEST(max(mentions_24h), 1) AS m24, GREATEST(max(mentions_7d), 1) AS m7 FROM buzz
  )
  UPDATE public.ai_tools t
  SET buzz_score = round(b.mentions_24h * 2 + b.mentions_7d, 2),
      previous_score = t.weekly_score,
      previous_position = t.rank_position,
      weekly_score = round(
        (0.62 * t.base_score)
        + (1.6 * (b.mentions_24h / (SELECT m24 FROM maxb)))
        + (0.9 * (b.mentions_7d / (SELECT m7 FROM maxb)))
        + (CASE WHEN t.ratings_count > 0
                THEN 1.5 * (t.ratings_avg / 5.0) * LEAST(t.ratings_count::numeric / 12.0, 1.0)
                ELSE 0.5 END)
      , 2),
      last_ranked_at = now()
  FROM buzz b
  WHERE b.id = t.id AND t.is_active;

  WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY weekly_score DESC, base_score DESC, name ASC) AS pos
    FROM public.ai_tools WHERE is_active
  )
  UPDATE public.ai_tools t SET rank_position = o.pos FROM ordered o WHERE o.id = t.id;
END;
$function$;

SELECT cron.unschedule('recompute-ai-ranking');
SELECT cron.schedule('recompute-ai-ranking-daily', '0 6 * * *', $$SELECT public.recompute_ai_ranking();$$);
SELECT public.recompute_ai_ranking();