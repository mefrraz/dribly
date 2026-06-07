-- Run this in Supabase SQL Editor to create missing season tables
-- Tables already exist: games_2025_2026, games_2024_2025, games_2023_2024, games_2022_2023

DO $$
DECLARE
    seasons text[] := ARRAY[
        '2003_2004','2004_2005','2005_2006','2006_2007','2007_2008',
        '2008_2009','2009_2010','2010_2011','2011_2012','2012_2013',
        '2013_2014','2014_2015','2015_2016','2016_2017','2017_2018',
        '2018_2019','2019_2020','2020_2021','2021_2022'
    ];
    s text;
BEGIN
    FOREACH s IN ARRAY seasons
    LOOP
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS games_%s (
                slug text PRIMARY KEY,
                data date NOT NULL,
                hora text,
                equipa_casa text NOT NULL,
                equipa_fora text NOT NULL,
                resultado_casa integer,
                resultado_fora integer,
                escalao text,
                competicao text,
                local text,
                logotipo_casa text,
                logotipo_fora text,
                status text CHECK (status IN (''AGENDADO'', ''A DECORRER'', ''FINALIZADO'')),
                epoca text,
                created_at timestamptz DEFAULT now(),
                updated_at timestamptz DEFAULT now()
            )
        ', s);
    END LOOP;
END $$;
