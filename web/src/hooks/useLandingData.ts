import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import type { Match } from '../components/types'

export interface LandingAssociation {
    association_id: number
    association_name: string
}

export interface LandingCompetition {
    competition_id: number
    competition_name: string
    association_id: number
    association_name: string
}

export interface CompMeta {
    name: string
    logo: string | null
}

/**
 * Hook that fetches all landing page data from Supabase.
 * Centralizes the 3 inline queries that were in Landing.tsx.
 */
export function useLandingData() {
    const [games, setGames] = useState<Match[]>([])
    const [gamesLoading, setGamesLoading] = useState(true)
    const [associations, setAssociations] = useState<LandingAssociation[]>([])
    const [allComps, setAllComps] = useState<LandingCompetition[]>([])
    const [compMetaMap, setCompMetaMap] = useState<Map<number, CompMeta>>(new Map())

    // Featured games: upcoming games from most-followed clubs (or fallback)
    useEffect(() => {
        async function fetchFeatured() {
            // 1. Get top followed clubs
            const { data: follows } = await supabase
                .from('user_follows')
                .select('entity_id')
                .eq('entity_type', 'club')

            let clubNames: string[] = []

            if (follows && follows.length > 0) {
                // Count follows per club — only clubs with ≥3 follows
                const counts: Record<number, number> = {}
                for (const f of follows) counts[f.entity_id] = (counts[f.entity_id] || 0) + 1
                const topIds = Object.entries(counts)
                    .filter(([, n]) => n >= 3)
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([id]) => parseInt(id))

                // Get names for those clubs
                const { data: topClubs } = await supabase
                    .from('clubs')
                    .select('name')
                    .in('id', topIds)

                if (topClubs && topClubs.length > 0) {
                    clubNames = topClubs.map((c: { name: string }) => c.name)
                }
            }

            // Fallback: 3 grandes
            if (clubNames.length === 0) {
                clubNames = [
                    'Futebol Clube do Porto',
                    'SL Benfica',
                    'Sporting Clube Portugal',
                ]
            }

            // 2. Build patterns: use full name + extract keyword (last significant word)
            const patterns = new Set<string>()
            for (const name of clubNames) {
                patterns.add(name)
                // Extract keyword: last word, skip common short prefixes
                const cleaned = name.replace(/^(FC|SL|SC|CD|UD|AD|GD|AC|CF|OS|CP)\s+/i, '')
                const words = cleaned.split(/\s+/)
                const keyword = words[words.length - 1]
                if (keyword && keyword.length >= 4 && keyword !== 'Clube' && keyword !== 'Sport') {
                    patterns.add(keyword)
                }
            }
            const patternArr = [...patterns]
            const orClauses = patternArr
                .map(n => `equipa_casa.ilike.%${n}%,equipa_fora.ilike.%${n}%`)
                .join(',')

            // 3. Query games
            const { data } = await supabase
                .from('games_2025_2026')
                .select('*')
                .or(orClauses)
                .neq('status', 'FINALIZADO')
                .gte('data', new Date().toISOString().split('T')[0])
                .order('data', { ascending: true })

            if (data) {
                let arr = data as Match[]
                // Cap per-club: max 3 games each, identified by the keyword match
                const perClub: Record<string, number> = {}
                arr = arr
                    .filter(m => {
                        const full = (m.equipa_casa + ' ' + m.equipa_fora).toUpperCase()
                        // Find which pattern matched
                        const matched = patternArr.find(p =>
                            full.includes(p.toUpperCase())
                        )
                        if (!matched) return false
                        perClub[matched] = (perClub[matched] || 0) + 1
                        return perClub[matched] <= 3
                    })
                    .sort(() => Math.random() - 0.5)
                    .slice(0, 12)
                setGames(arr)
            }
            setGamesLoading(false)
        }
        fetchFeatured()
    }, [])

    // Associations
    useEffect(() => {
        supabase
            .from('competitions')
            .select('association_id,association_name')
            .eq('season', '2025/2026')
            .order('association_name')
            .then(({ data }: { data: LandingAssociation[] | null }) => {
                if (data) {
                    const seen = new Map<number, LandingAssociation>()
                    ;data.forEach(a => {
                        if (!seen.has(a.association_id))
                            seen.set(a.association_id, a)
                    })
                    const uniq = Array.from(seen.values())
                    const shuffled = uniq.sort(() => Math.random() - 0.5)
                    setAssociations(shuffled)
                }
            })
    }, [])

    // All competitions + meta for search
    useEffect(() => {
        supabase
            .from('competitions')
            .select(
                'competition_id, competition_name, association_id, association_name'
            )
            .eq('season', '2025/2026')
            .then(({ data }: { data: LandingCompetition[] | null }) => {
                if (data) {
                    const seen: Record<number, LandingCompetition> = {}
                    ;data.forEach(r => {
                        if (!seen[r.competition_id])
                            seen[r.competition_id] = r
                    })
                    setAllComps(Object.values(seen))
                }
            })
        supabase
            .from('competitions_meta')
            .select('id, name, logo_url')
            .then(
                ({ data: md }: { data: Record<string, unknown>[] | null }) => {
                    if (md) {
                        const cm = new Map<number, CompMeta>()
                        ;(md as { id: number; name: string; logo_url: string | null }[]).forEach((r) =>
                            cm.set(r.id, { name: r.name, logo: r.logo_url })
                        )
                        setCompMetaMap(cm)
                    }
                },
                () => {}
            )
    }, [])

    return { games, gamesLoading, associations, allComps, compMetaMap }
}
