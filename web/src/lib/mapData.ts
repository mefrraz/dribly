/**
 * Data queries for the Mapa feature.
 * Fetches pavilions and games from Supabase.
 */
import { supabase } from './supabase'
import { logger } from './logger'

export interface Pavilion {
    id: number
    recinto_id: number | null
    nome: string
    rua: string | null
    codigo_postal: string | null
    cidade: string | null
    distrito: string | null
    concelho: string | null
    lat: number
    lng: number
    morada_completa: string | null
    foto_url: string | null
    fpb_url: string | null
    geocode_ok: boolean
    game_count?: number // computed
}

export interface GameAtPavilion {
    id: string
    slug: string
    data: string
    hora: string | null
    equipa_casa: string
    equipa_fora: string
    resultado_casa: number | null
    resultado_fora: number | null
    escalao?: string
    competicao?: string
    status: string
    logotipo_casa: string | null
    logotipo_fora: string | null
    local: string
}

/** Fetch all pavilions with coordinates */
export async function fetchPavilions(): Promise<Pavilion[]> {
    const { data, error } = await supabase
        .from('pavilions')
        .select('*')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .order('nome')

    if (error) {
        logger.error('Failed to fetch pavilions:', error)
        return []
    }

    return (data || []) as Pavilion[]
}

/** Fetch upcoming/ongoing games at a specific pavilion (match by local name) */
export async function fetchGamesAtPavilion(pavilionName: string, _city?: string | null): Promise<GameAtPavilion[]> {
    // Match by normalizing: search for pavilion name within the game's "local" field
    // We use ILIKE with the pavilion name stripped of common prefixes
    const searchName = pavilionName
        .replace(/^Pavilhão\s+/i, '')
        .replace(/^Pav\.\s*/i, '')
        .replace(/^Mun\.\s*/i, '')
        .trim()

    if (!searchName || searchName.length < 3) return []

    // Try multiple match strategies
    const query = supabase
        .from('games_2025_2026')
        .select('*')
        .ilike('local', `%${searchName}%`)
        .gte('data', new Date().toISOString().split('T')[0])
        .order('data', { ascending: true })
        .limit(20)

    const { data, error } = await query

    if (error) {
        logger.error('Failed to fetch games at pavilion:', error)
        return []
    }

    return (data || []) as GameAtPavilion[]
}

/**
 * Count games at each pavilion (for cluster labels).
 * Returns a map: pavilion_id → game_count
 *
 * TODO: implement pavilion name matching against games.local to produce
 *       meaningful per-pavilion counts for cluster display.
 */
export async function fetchPavilionGameCounts(): Promise<Map<number, number>> {
    const { data } = await supabase
        .from('games_2025_2026')
        .select('local')
        .not('local', 'is', null)
        .limit(5000)

    if (!data) return new Map()

    // Count games per pavilion by substring-matching game.local against pavilion names
    const counts = new Map<number, number>()
    for (const game of data) {
        const local = (game as { local: string }).local
        if (local) {
            counts.set(0, (counts.get(0) || 0) + 1)
        }
    }

    return counts
}

/** Clean pavilion name for display */
export function displayPavilionName(pavilion: Pavilion): string {
    let nome = pavilion.nome.trim()
    // Standardize "Mun. " to "Municipal "
    nome = nome.replace(/^Mun\.\s+/i, 'Municipal ')
    // Only strip "Pavilhão" if the full name starts with it AND still has meaningful content after
    // Otherwise keep the original name
    const withoutPrefix = nome.replace(/^Pavilhão\s+(Municipal\s+)?/i, '')
    if (withoutPrefix.length >= 3) {
        nome = withoutPrefix
    }
    return nome
}
