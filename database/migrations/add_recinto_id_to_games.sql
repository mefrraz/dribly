-- Add recinto_id to games tables for direct pavilion linking
-- Run this in Supabase SQL Editor

ALTER TABLE public.games_2025_2026 ADD COLUMN IF NOT EXISTS recinto_id INTEGER;
ALTER TABLE public.games_2024_2025 ADD COLUMN IF NOT EXISTS recinto_id INTEGER;
ALTER TABLE public.games_2023_2024 ADD COLUMN IF NOT EXISTS recinto_id INTEGER;
ALTER TABLE public.games_2022_2023 ADD COLUMN IF NOT EXISTS recinto_id INTEGER;

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_games_2025_2026_recinto ON public.games_2025_2026 (recinto_id) WHERE recinto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_games_2024_2025_recinto ON public.games_2024_2025 (recinto_id) WHERE recinto_id IS NOT NULL;
