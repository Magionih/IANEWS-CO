CREATE TABLE public.share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  article_slug text NOT NULL,
  article_title text NOT NULL DEFAULT '',
  channel text NOT NULL DEFAULT 'instagram_stories',
  campaign text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  clicks_count integer NOT NULL DEFAULT 0,
  unique_visitors integer NOT NULL DEFAULT 0,
  last_click_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX share_links_article_slug_idx ON public.share_links(article_slug);
CREATE UNIQUE INDEX share_links_unique_combo ON public.share_links(article_slug, channel, campaign);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.share_links TO authenticated;
GRANT ALL ON public.share_links TO service_role;

ALTER TABLE public.share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read share links" ON public.share_links FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins insert share links" ON public.share_links FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update share links" ON public.share_links FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete share links" ON public.share_links FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_share_links_updated_at BEFORE UPDATE ON public.share_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.share_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.share_links(id) ON DELETE CASCADE,
  code text NOT NULL,
  article_slug text NOT NULL,
  visitor_hash text NOT NULL DEFAULT '',
  referrer text,
  user_agent text,
  device text NOT NULL DEFAULT 'desconhecido',
  os text NOT NULL DEFAULT 'desconhecido',
  browser text NOT NULL DEFAULT 'desconhecido',
  country text,
  city text,
  is_new_visitor boolean NOT NULL DEFAULT true,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  click_date date NOT NULL DEFAULT ((now() AT TIME ZONE 'utc')::date),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX share_link_clicks_link_idx ON public.share_link_clicks(link_id, clicked_at DESC);
CREATE INDEX share_link_clicks_date_idx ON public.share_link_clicks(click_date);

GRANT SELECT ON public.share_link_clicks TO authenticated;
GRANT ALL ON public.share_link_clicks TO service_role;

ALTER TABLE public.share_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read share link clicks" ON public.share_link_clicks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "No client writes to share link clicks" ON public.share_link_clicks FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "No client updates to share link clicks" ON public.share_link_clicks FOR UPDATE TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes to share link clicks" ON public.share_link_clicks FOR DELETE TO anon, authenticated USING (false);

CREATE OR REPLACE FUNCTION public.register_share_click(
  _code text,
  _visitor_hash text,
  _referrer text,
  _user_agent text,
  _device text,
  _os text,
  _browser text,
  _country text
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link public.share_links%ROWTYPE;
  is_new boolean;
BEGIN
  SELECT * INTO link FROM public.share_links WHERE code = _code AND is_active LIMIT 1;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  is_new := NOT EXISTS (
    SELECT 1 FROM public.share_link_clicks
    WHERE link_id = link.id AND visitor_hash = _visitor_hash AND _visitor_hash <> ''
  );

  INSERT INTO public.share_link_clicks (
    link_id, code, article_slug, visitor_hash, referrer, user_agent, device, os, browser, country, is_new_visitor
  ) VALUES (
    link.id, link.code, link.article_slug, COALESCE(_visitor_hash, ''), _referrer, _user_agent,
    COALESCE(NULLIF(_device, ''), 'desconhecido'),
    COALESCE(NULLIF(_os, ''), 'desconhecido'),
    COALESCE(NULLIF(_browser, ''), 'desconhecido'),
    _country, is_new
  );

  UPDATE public.share_links
  SET clicks_count = clicks_count + 1,
      unique_visitors = unique_visitors + (CASE WHEN is_new THEN 1 ELSE 0 END),
      last_click_at = now()
  WHERE id = link.id;

  RETURN link.article_slug;
END;
$$;

REVOKE ALL ON FUNCTION public.register_share_click(text, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_share_click(text, text, text, text, text, text, text, text) TO service_role;