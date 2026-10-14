-- Lock down ingest_runs: internal automation logs, never exposed via the Data API
ALTER TABLE public.ingest_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingest_runs FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.ingest_runs FROM anon;
REVOKE ALL ON public.ingest_runs FROM authenticated;
GRANT ALL ON public.ingest_runs TO service_role;

DROP POLICY IF EXISTS "No client access to ingest runs" ON public.ingest_runs;
CREATE POLICY "No client access to ingest runs"
ON public.ingest_runs
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);