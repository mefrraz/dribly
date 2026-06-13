-- Add from_google flag to pavilions table
-- Run this in Supabase SQL Editor

ALTER TABLE pavilions ADD COLUMN IF NOT EXISTS from_google boolean DEFAULT false;

-- Index for filtering protected pavilions
CREATE INDEX IF NOT EXISTS idx_pavilions_from_google ON pavilions(from_google);
