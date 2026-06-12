-- Add Google Places fields to pavilions table
-- Run this in Supabase SQL Editor before importing new data

-- New columns
ALTER TABLE public.pavilions
ADD COLUMN IF NOT EXISTS google_place_id TEXT,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS image_urls JSONB,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS google_rating DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS reviews_count INTEGER,
ADD COLUMN IF NOT EXISTS opening_hours JSONB,
ADD COLUMN IF NOT EXISTS additional_info JSONB,
ADD COLUMN IF NOT EXISTS people_also_search JSONB,
ADD COLUMN IF NOT EXISTS google_maps_url TEXT,
ADD COLUMN IF NOT EXISTS search_string TEXT;

-- Index on google_place_id for lookups
CREATE INDEX IF NOT EXISTS idx_pavilions_google_place_id
ON public.pavilions (google_place_id)
WHERE google_place_id IS NOT NULL;

-- Unique constraint on google_place_id (allow multiple NULLs)
ALTER TABLE public.pavilions
ADD CONSTRAINT uq_pavilions_google_place_id UNIQUE (google_place_id);

-- Index on google_rating for sorting
CREATE INDEX IF NOT EXISTS idx_pavilions_rating
ON public.pavilions (google_rating DESC)
WHERE google_rating IS NOT NULL;
