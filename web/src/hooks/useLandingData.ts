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

    // Featured games: only FINALIZADO Liga Betclic (Masculina, ID 10902) results, varied across rounds
    useEffect(() => {
        // Get exact competition name(s) from the competitions table first
        supabase
            .from('competitions')
            .select('competition_name')
            .eq('competition_id', 10902)
            .eq('season', '2025/2026')
            .then(({ data: comps }) => {
                const names: string[] = (comps || []).map((c: { competition_name: string }) => c.competition_name)
                // Fallback: also match the short name used by Tugabasket
                if (!names.includes('Liga Betclic')) names.push('Liga Betclic')

                return supabase
                    .from('games_2025_2026')
                    .select('*')
                    .in('competicao', names)
                    .eq('status', 'FINALIZADO')
                    .order('data', { ascending: false })
                    .limit(18)
            })
            .then(({ data }) => {
                const all = (data || []) as Match[]
                // Pick at most 2 games per date for variety across rounds
                // Normalize data to YYYY-MM-DD (slice first 10 chars) in case some sources
                // store full timestamps, which would break the per-date grouping
                const seen = new Map<string, number>()
                const seenSlugs = new Set<string>()
                const varied: Match[] = []
                for (const m of all) {
                    // Dedup: skip duplicate games (same slug or same teams+date)
                    const dedupKey = m.slug || `${m.data.slice(0, 10)}-${m.equipa_casa}-${m.equipa_fora}`
                    if (seenSlugs.has(dedupKey)) continue
                    seenSlugs.add(dedupKey)

                    const dateKey = m.data.slice(0, 10) // YYYY-MM-DD
                    const count = seen.get(dateKey) || 0
                    if (count < 2) {
                        seen.set(dateKey, count + 1)
                        varied.push(m)
                    }
                    if (varied.length >= 14) break
                }
                setGames(varied)
                setGamesLoading(false)
            })
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
