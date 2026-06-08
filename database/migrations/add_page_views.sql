-- Page views tracker — one row per day
CREATE TABLE IF NOT EXISTS public.page_views (
    date DATE PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
);

-- Public insert (for the beacon)
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert page views"
ON public.page_views FOR INSERT
WITH CHECK (true);

-- Public read (for the dashboard)
CREATE POLICY "Anyone can read page views"
ON public.page_views FOR SELECT
USING (true);
