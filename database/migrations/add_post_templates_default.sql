-- Add is_default column to post_templates
ALTER TABLE post_templates ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- Ensure only one default per type (unique partial index)
-- Drop if exists first
DROP INDEX IF EXISTS idx_post_templates_default;
CREATE UNIQUE INDEX idx_post_templates_default ON post_templates (type) WHERE is_default = true;
