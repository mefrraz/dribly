-- Add pavilions table for the Mapa feature
CREATE TABLE IF NOT EXISTS public.pavilions (
    id SERIAL PRIMARY KEY,
    recinto_id INTEGER UNIQUE,
    nome TEXT NOT NULL,
    rua TEXT,
    codigo_postal TEXT,
    cidade TEXT,
    distrito TEXT,
    concelho TEXT,
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION,
    morada_completa TEXT,
    foto_url TEXT,
    fpb_url TEXT,
    geocode_ok BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.pavilions ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read pavilions"
ON public.pavilions FOR SELECT
USING (true);

-- Spatial index for map queries
CREATE INDEX IF NOT EXISTS idx_pavilions_coords
ON public.pavilions (lat, lng)
WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Index on nome for matching game locations
CREATE INDEX IF NOT EXISTS idx_pavilions_nome
ON public.pavilions (nome);

-- Trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_pavilions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pavilions_updated_at ON public.pavilions;
CREATE TRIGGER trg_pavilions_updated_at
    BEFORE UPDATE ON public.pavilions
    FOR EACH ROW
    EXECUTE FUNCTION update_pavilions_updated_at();
