-- RPC to increment page view count for a given date (upsert)
CREATE OR REPLACE FUNCTION public.increment_page_view(p_date DATE)
RETURNS void AS $$
BEGIN
    INSERT INTO public.page_views (date, count)
    VALUES (p_date, 1)
    ON CONFLICT (date)
    DO UPDATE SET count = page_views.count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
