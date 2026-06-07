import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchFPBGames } from '../lib/fpbApi'
import type { Match } from '../components/types'
import type { AdminClub } from '../lib/adminApi'

const CONCURRENCY = 4
const AVAILABLE_SEASONS = ['2025/2026', '2024/2025', '2023/2024', '2022/2023']

function seasonToTable(season: string): string {
    return 'games_' + season.replace('/', '_')
}

export interface ScrapeProgress {
    current: number
    total: number
    clubName: string
    newGames: number
}

export interface ScrapeResult {
    club: string
    games: number
    errors: string[]
}

export interface ScrapeSummary {
    totalClubs: number
    totalGames: number
    errors: number
    durationSec: number
}

export interface LastScrapeDates {
    [clubId: number]: string | null // ISO date string of most recent game
}

export function useScraper(clubs: AdminClub[]) {
    const [selected, setSelected] = useState<Set<number>>(new Set())
    const [progress, setProgress] = useState<ScrapeProgress | null>(null)
    const [running, setRunning] = useState(false)
    const [results, setResults] = useState<ScrapeResult[]>([])
    const [summary, setSummary] = useState<ScrapeSummary | null>(null)
    const [season, setSeason] = useState(AVAILABLE_SEASONS[0])
    const [cleanBefore, setCleanBefore] = useState(false)
    const [lastScrapeDates, setLastScrapeDates] = useState<LastScrapeDates>({})
    const abortRef = useRef(false)

    const toggleClub = useCallback((id: number) => {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }, [])

    const selectAll = useCallback(() => {
        setSelected(new Set(clubs.map(c => c.id)))
    }, [clubs])

    const deselectAll = useCallback(() => {
        setSelected(new Set())
    }, [])

    const selectPopular = useCallback(async () => {
        // Get top 20 clubs by follow count
        const { data } = await supabase
            .from('user_follows')
            .select('entity_id')
            .eq('entity_type', 'club')

        if (!data) return

        const counts: Record<number, number> = {}
        for (const row of data) {
            counts[row.entity_id] = (counts[row.entity_id] || 0) + 1
        }

        const top20 = Object.entries(counts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 20)
            .map(([id]) => parseInt(id))

        setSelected(new Set(top20))
    }, [])

    const loadLastScrapeDates = useCallback(async () => {
        const table = seasonToTable(season)
        const dates: LastScrapeDates = {}

        // For each club, find the most recent game date
        const promises = clubs.slice(0, 50).map(async (club) => {
            try {
                const { data } = await supabase
                    .from(table)
                    .select('data')
                    .or(`equipa_casa.ilike.%${club.name}%,equipa_fora.ilike.%${club.name}%`)
                    .order('data', { ascending: false })
                    .limit(1)

                if (data && data.length > 0) {
                    dates[club.id] = (data[0] as { data: string }).data
                }
            } catch { /* ignore */ }
        })

        await Promise.all(promises)
        setLastScrapeDates(dates)
    }, [clubs, season])

    const startScrape = useCallback(async () => {
        const targets = clubs.filter(c => selected.has(c.id))
        if (targets.length === 0) return

        setRunning(true)
        abortRef.current = false
        setResults([])
        setSummary(null)

        const allResults: ScrapeResult[] = []
        let done = 0
        let totalGames = 0
        let totalErrors = 0
        const table = seasonToTable(season)
        const startTime = Date.now()

        for (let i = 0; i < targets.length; i += CONCURRENCY) {
            if (abortRef.current) break
            const batch = targets.slice(i, i + CONCURRENCY)

            const batchResults = await Promise.all(
                batch.map(async (club) => {
                    const errors: string[] = []
                    let gameCount = 0

                    try {
                        // Optionally clean before scraping
                        if (cleanBefore) {
                            const name = club.name.replace(/'/g, "''")
                            await supabase
                                .from(table)
                                .delete()
                                .or(`equipa_casa.ilike.%${name}%,equipa_fora.ilike.%${name}%`)
                        }

                        const games: Match[] = await fetchFPBGames(season, club.id)
                        gameCount = games.length

                        for (const game of games) {
                            if (abortRef.current) break
                            try {
                                await supabase.from(table).upsert(
                                    {
                                        slug: game.slug || game.id,
                                        data: game.data,
                                        hora: game.hora || null,
                                        equipa_casa: game.equipa_casa,
                                        equipa_fora: game.equipa_fora,
                                        resultado_casa: game.resultado_casa,
                                        resultado_fora: game.resultado_fora,
                                        escalao: game.escalao || null,
                                        competicao: game.competicao || null,
                                        local: game.local || null,
                                        status: game.status || 'AGENDADO',
                                        logotipo_casa: game.logotipo_casa || null,
                                        logotipo_fora: game.logotipo_fora || null,
                                        epoca: season,
                                    },
                                    { onConflict: 'slug' },
                                )
                            } catch (e) {
                                errors.push(`Erro ao guardar: ${(e as Error).message}`)
                            }
                        }
                    } catch (e) {
                        errors.push(`Erro FPB: ${(e as Error).message}`)
                    }

                    done++
                    totalGames += gameCount
                    if (errors.length > 0) totalErrors++

                    setProgress({
                        current: done,
                        total: targets.length,
                        clubName: club.name,
                        newGames: gameCount,
                    })

                    return { club: club.name, games: gameCount, errors }
                }),
            )

            allResults.push(...batchResults)
        }

        setResults(allResults)
        setSummary({
            totalClubs: done,
            totalGames,
            errors: totalErrors,
            durationSec: Math.round((Date.now() - startTime) / 1000),
        })
        setProgress(null)
        setRunning(false)
    }, [clubs, selected, season, cleanBefore])

    const abort = useCallback(() => {
        abortRef.current = true
        setRunning(false)
        setProgress(null)
    }, [])

    return {
        selected,
        progress,
        running,
        results,
        summary,
        season,
        cleanBefore,
        lastScrapeDates,
        toggleClub,
        selectAll,
        deselectAll,
        selectPopular,
        setSeason,
        setCleanBefore,
        loadLastScrapeDates,
        startScrape,
        abort,
    }
}
