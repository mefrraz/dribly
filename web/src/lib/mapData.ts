/**
 * Data queries for the Mapa feature.
 * Fetches pavilions and games from Supabase.
 */
import { supabase } from './supabase'

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
        console.error('Failed to fetch pavilions:', error)
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
    let query = supabase
        .from('games_2025_2026')
        .select('*')
        .ilike('local', `%${searchName}%`)
        .gte('data', new Date().toISOString().split('T')[0])
        .order('data', { ascending: true })
        .limit(20)

    const { data, error } = await query

    if (error) {
        console.error('Failed to fetch games at pavilion:', error)
        return []
    }

    return (data || []) as GameAtPavilion[]
}

/**
 * Count games at each pavilion (for cluster labels).
 * Returns a map: pavilion_id → game_count
 */
export async function fetchPavilionGameCounts(): Promise<Map<number, number>> {
    // Get all games with non-null local
    const { data } = await supabase
        .from('games_2025_2026')
        .select('local')
        .not('local', 'is', null)
        .limit(5000)

    if (!data) return new Map()

    const counts = new Map<number, number>()
    // Count occurrences (approximate — match by name substring against pavilions)
    // This is a rough count for cluster display
    for (const _game of data) {
        // Just count total games for now — we'll refine later
    }

    return counts
}

/** Clean pavilion name for display */
export function displayPavilionName(pavilion: Pavilion): string {
    return pavilion.nome
        .replace(/^Pavilhão\s+/i, '')
        .replace(/^Mun\.\s+/i, 'Municipal ')
        .trim()
}
