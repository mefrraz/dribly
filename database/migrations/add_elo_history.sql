-- ELO history per club per season
CREATE TABLE IF NOT EXISTS club_elo_history (
    id SERIAL PRIMARY KEY,
    club_id INTEGER REFERENCES clubs(id) ON DELETE CASCADE,
    season TEXT NOT NULL,
    elo_rating DOUBLE PRECISION DEFAULT 1500,
    games_played INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(club_id, season)
);

CREATE INDEX IF NOT EXISTS idx_elo_season ON club_elo_history(season);
CREATE INDEX IF NOT EXISTS idx_elo_club_id ON club_elo_history(club_id);
