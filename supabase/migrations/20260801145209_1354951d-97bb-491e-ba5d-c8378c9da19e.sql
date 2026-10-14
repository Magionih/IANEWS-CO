
-- ============ TABELA DE FERRAMENTAS ============
CREATE TABLE public.ai_tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  maker text NOT NULL,
  category text NOT NULL DEFAULT 'chat',
  website text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '',
  brand text NOT NULL DEFAULT '#1F5EFF',
  about text NOT NULL DEFAULT '',
  context_window text NOT NULL DEFAULT '',
  pricing text NOT NULL DEFAULT '',
  released text NOT NULL DEFAULT '',
  pros text[] NOT NULL DEFAULT '{}',
  cons text[] NOT NULL DEFAULT '{}',
  scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  base_score numeric(4,2) NOT NULL DEFAULT 8.00,
  buzz_score numeric(6,2) NOT NULL DEFAULT 0,
  weekly_score numeric(5,2) NOT NULL DEFAULT 0,
  previous_score numeric(5,2) NOT NULL DEFAULT 0,
  rank_position integer NOT NULL DEFAULT 0,
  previous_position integer NOT NULL DEFAULT 0,
  ratings_count integer NOT NULL DEFAULT 0,
  ratings_avg numeric(3,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  last_ranked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_tools TO anon;
GRANT SELECT ON public.ai_tools TO authenticated;
GRANT ALL ON public.ai_tools TO service_role;

ALTER TABLE public.ai_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ai tools" ON public.ai_tools
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins insert ai tools" ON public.ai_tools
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update ai tools" ON public.ai_tools
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete ai tools" ON public.ai_tools
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_ai_tools_updated_at BEFORE UPDATE ON public.ai_tools
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AVALIAÇÕES DOS LEITORES ============
CREATE TABLE public.ai_tool_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id uuid NOT NULL REFERENCES public.ai_tools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  use_case text,
  comment text CHECK (comment IS NULL OR length(comment) <= 800),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tool_id, user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_tool_ratings TO authenticated;
GRANT ALL ON public.ai_tool_ratings TO service_role;

ALTER TABLE public.ai_tool_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own ratings" ON public.ai_tool_ratings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read all ratings" ON public.ai_tool_ratings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own rating" ON public.ai_tool_ratings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own rating" ON public.ai_tool_ratings
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own rating" ON public.ai_tool_ratings
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_tool_ratings_updated_at BEFORE UPDATE ON public.ai_tool_ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ AGREGAÇÃO DE MÉDIAS ============
CREATE OR REPLACE FUNCTION public.refresh_ai_tool_rating_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid := COALESCE(NEW.tool_id, OLD.tool_id);
BEGIN
  UPDATE public.ai_tools t
  SET ratings_count = COALESCE(s.cnt, 0),
      ratings_avg = COALESCE(s.avg, 0)
  FROM (
    SELECT count(*)::int AS cnt, round(avg(rating)::numeric, 2) AS avg
    FROM public.ai_tool_ratings WHERE tool_id = target
  ) s
  WHERE t.id = target;
  RETURN NULL;
END;
$$;

CREATE TRIGGER ai_tool_ratings_stats
AFTER INSERT OR UPDATE OR DELETE ON public.ai_tool_ratings
FOR EACH ROW EXECUTE FUNCTION public.refresh_ai_tool_rating_stats();

-- ============ RECÁLCULO SEMANAL BASEADO EM FATOS ============
CREATE OR REPLACE FUNCTION public.recompute_ai_ranking()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- repercussão real: menções da ferramenta/fabricante nas matérias dos últimos 7 dias
  WITH buzz AS (
    SELECT t.id,
           (SELECT count(*) FROM public.articles a
             WHERE a.published_at > now() - interval '7 days'
               AND (a.title ILIKE '%' || t.name || '%'
                 OR a.title ILIKE '%' || t.maker || '%'
                 OR a.body_markdown ILIKE '%' || t.name || '%'))::numeric AS mentions
    FROM public.ai_tools t
  ), maxb AS (
    SELECT GREATEST(max(mentions), 1) AS m FROM buzz
  )
  UPDATE public.ai_tools t
  SET buzz_score = round(b.mentions, 2),
      previous_score = t.weekly_score,
      previous_position = t.rank_position,
      weekly_score = round(
        (0.68 * t.base_score)
        + (1.7 * (b.mentions / (SELECT m FROM maxb)))
        + (CASE WHEN t.ratings_count > 0
                THEN 1.6 * (t.ratings_avg / 5.0) * LEAST(t.ratings_count::numeric / 12.0, 1.0)
                ELSE 0.55 END)
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
$$;

REVOKE EXECUTE ON FUNCTION public.recompute_ai_ranking() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_ai_ranking() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('recompute-ai-ranking', '0 6 * * 1', $$SELECT public.recompute_ai_ranking();$$);
