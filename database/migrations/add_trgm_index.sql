-- Enable pg_trgm extension for fast ilike '%text%' queries
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add GIN trigram indexes to games_2025_2026 for fast club name matching
-- Without this, ilike '%FC Porto%' does a full sequential scan
CREATE INDEX IF NOT EXISTS idx_games_equipa_casa_trgm ON games_2025_2026 USING GIN (equipa_casa gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_games_equipa_fora_trgm ON games_2025_2026 USING GIN (equipa_fora gin_trgm_ops);

-- Add B-tree index on data for fast date sorting/filtering
CREATE INDEX IF NOT EXISTS idx_games_data ON games_2025_2026 (data);
