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

    // Featured games: upcoming + recent Liga Betclic games
    useEffect(() => {
        Promise.all([
            supabase
                .from('games_2025_2026')
                .select('*')
                .ilike('competicao', '%Liga Betclic%')
                .eq('status', 'FINALIZADO')
                .order('data', { ascending: false })
                .limit(6),
            supabase
                .from('games_2025_2026')
                .select('*')
                .ilike('competicao', '%Liga Betclic%')
                .neq('status', 'FINALIZADO')
                .gte('data', new Date().toISOString().split('T')[0])
                .order('data', { ascending: true })
                .limit(8),
        ]).then(([{ data: recent }, { data: upcoming }]) => {
            const recentGames = (recent || []) as Match[]
            const upcomingGames = (upcoming || []) as Match[]
            setGames([...recentGames, ...upcomingGames])
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
