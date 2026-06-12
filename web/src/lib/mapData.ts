/**
 * Data queries for the Mapa feature.
 * Fetches pavilions and games from Supabase.
 */
import { supabase } from './supabase'
import { logger } from './logger'

export interface OpeningHoursDay {
    day: string
    hours: string
}

export interface AdditionalInfo {
    Acessibilidade?: { [key: string]: boolean }[]
    Serviços?: { [key: string]: boolean }[]
    Crianças?: { [key: string]: boolean }[]
    Estacionamento?: { [key: string]: boolean }[]
    Pagamentos?: { [key: string]: boolean }[]
    [key: string]: { [key: string]: boolean }[] | undefined
}

export interface PeopleAlsoSearchItem {
    category: string
    title: string
    reviewsCount: number
    totalScore: number
}

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
    // Google Places fields
    google_place_id: string | null
    image_url: string | null
    image_urls: string[] | null
    website: string | null
    phone: string | null
    google_rating: number | null
    reviews_count: number | null
    images_count: number | null
    opening_hours: OpeningHoursDay[] | null
    additional_info: AdditionalInfo | null
    people_also_search: PeopleAlsoSearchItem[] | null
    google_maps_url: string | null
    search_string: string | null
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
 * Normalize a pavilion or game-local name for fuzzy matching:
 * lowercase, strip accents, remove common prefixes and filler words.
 */
function normalizeName(name: string): string {
    return name
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
        .replace(/^pavilhao\s+(municipal\s+)?/i, '')
        .replace(/^pav\.\s*/i, '')
        .replace(/^mun\.\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim()
}

/**
 * Count games at each pavilion (for cluster labels).
 * Matches game.local against pavilion names via normalized substring matching.
 * Returns a map: pavilion_id → game_count
 */
export async function fetchPavilionGameCounts(): Promise<Map<number, number>> {
    // Fetch pavilions and games in parallel
    const [pavRes, gamesRes] = await Promise.all([
        supabase.from('pavilions').select('id, nome').not('lat', 'is', null),
        supabase.from('games_2025_2026').select('local').not('local', 'is', null).limit(5000),
    ])

    const pavilions = (pavRes.data || []) as { id: number; nome: string }[]
    const games = (gamesRes.data || []) as { local: string }[]

    if (pavilions.length === 0 || games.length === 0) return new Map()

    // Pre-normalize pavilion names
    const normPavs = pavilions.map(p => ({ id: p.id, norm: normalizeName(p.nome) }))

    const counts = new Map<number, number>()
    for (const game of games) {
        if (!game.local) continue
        const normLocal = normalizeName(game.local)
        if (normLocal.length < 3) continue

        // Try exact match first, then substring containment
        let bestId: number | null = null
        for (const p of normPavs) {
            if (p.norm === normLocal) { bestId = p.id; break }
            if (p.norm.includes(normLocal) || normLocal.includes(p.norm)) {
                bestId = p.id // last match wins (longest name is most precise)
            }
        }
        if (bestId !== null) {
            counts.set(bestId, (counts.get(bestId) || 0) + 1)
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
